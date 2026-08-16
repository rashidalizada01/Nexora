(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const MOCK_IMAGE_FALLBACKS = Object.freeze({
    "hero-networking": {
      src: "assets/mock/mock-hero-networking.svg",
      alt: "Şəbəkə infrastrukturu üzrə nümunəvi hero vizualı",
    },
    "course-networking": {
      src: "assets/mock/mock-course-networking.svg",
      alt: "Şəbəkə texnologiyaları kursu üçün nümunəvi vizual",
    },
    "course-cybersecurity": {
      src: "assets/mock/mock-course-cybersecurity.svg",
      alt: "Kibertəhlükəsizlik kursu üçün nümunəvi vizual",
    },
    "course-cloud-devops": {
      src: "assets/mock/mock-course-cloud-devops.svg",
      alt: "Cloud və DevOps kursu üçün nümunəvi vizual",
    },
    "instructor-1": {
      src: "assets/mock/mock-instructor-networking-1.svg",
      alt: "Şəbəkə texnologiyaları müəllimi üçün nümunəvi portret",
    },
    "instructor-2": {
      src: "assets/mock/mock-instructor-networking-2.svg",
      alt: "IT sertifikasiya müəllimi üçün nümunəvi portret",
    },
    "instructor-3": {
      src: "assets/mock/mock-instructor-networking-3.svg",
      alt: "Cloud texnologiyaları müəllimi üçün nümunəvi portret",
    },
    "blog-networking": {
      src: "assets/mock/mock-blog-networking.svg",
      alt: "Şəbəkə texnologiyaları bloqu üçün nümunəvi vizual",
    },
    "blog-cybersecurity": {
      src: "assets/mock/mock-blog-cybersecurity.svg",
      alt: "Kibertəhlükəsizlik bloqu üçün nümunəvi vizual",
    },
    "blog-cloud-devops": {
      src: "assets/mock/mock-blog-cloud-devops.svg",
      alt: "Cloud və DevOps bloqu üçün nümunəvi vizual",
    },
    "scholarship-certification": {
      src: "assets/mock/mock-scholarship-certification.svg",
      alt: "IT sertifikasiyası təqaüdü üçün nümunəvi vizual",
    },
    "service-networking": {
      src: "assets/mock/mock-service-networking.svg",
      alt: "Şəbəkə laboratoriyası xidməti üçün nümunəvi ikon",
    },
    "gallery-network-lab": {
      src: "assets/mock/mock-gallery-network-lab.svg",
      alt: "Şəbəkə laboratoriyası üçün nümunəvi qalereya vizualı",
    },
    "career-network-engineer": {
      src: "assets/mock/mock-career-network-engineer.svg",
      alt: "Şəbəkə mühəndisliyi karyerası üçün nümunəvi vizual",
    },
    "faq-networking-guide": {
      src: "assets/mock/mock-faq-networking-guide.svg",
      alt: "Şəbəkə sertifikasiyası bələdçisi üçün nümunəvi vizual",
    },
    "decoration-network-nodes": {
      src: "assets/mock/mock-decoration-network-nodes.svg",
      alt: "Şəbəkə qovşaqlarını göstərən dekorativ vizual",
    },
    "project-networking": {
      src: "assets/mock/mock-project-networking.svg",
      alt: "Şəbəkə avtomatlaşdırması layihəsi üçün nümunəvi vizual",
    },
    "project-cloud-devops": {
      src: "assets/mock/mock-project-cloud-devops.svg",
      alt: "Cloud platforması layihəsi üçün nümunəvi vizual",
    },
    "project-cybersecurity": {
      src: "assets/mock/mock-project-cybersecurity.svg",
      alt: "Kibertəhlükəsizlik layihəsi üçün nümunəvi vizual",
    },
  });
  const PAGES = readPageTemplates();
  const DEFAULT_ROUTE = "home";
  const IS_LEGACY_ROUTER =
    document.body.dataset.router === "legacy" && Boolean(PAGES[DEFAULT_ROUTE]);
  const API_BASE_URL = resolveApiBaseUrl(
    document.querySelector('meta[name="nexora-api-base"]')?.content,
  );
  const CHATBOT_API_BASE_URL = resolveChatbotApiBaseUrl(API_BASE_URL);
  const ACCESS_TOKEN_KEY = "nexora_access_token";
  const REFRESH_TOKEN_KEY = "nexora_refresh_token";
  const AUTH_USER_KEY = "nexora_auth_user";
  const STAFF_ROLES = new Set([
    "SALES_CRM",
    "CONTENT_MANAGER",
    "ADMIN",
    "SYSTEM_ADMIN",
  ]);
  const ROLE_DESTINATIONS = {
    STUDENT: "student.html",
    SALES_CRM: "staff.html",
    CONTENT_MANAGER: "staff.html",
    ADMIN: "staff.html",
    SYSTEM_ADMIN: "staff.html",
  };
  let pageController = null;
  let accessToken = readStorage(sessionStorage, ACCESS_TOKEN_KEY);
  let refreshPromise = null;
  let currentUserCache = null;
  let coursesRequestId = 0;

  function readPageTemplates() {
    const manifestNode = document.getElementById("legacy-page-manifest");
    if (!manifestNode) return {};
    let manifest = {};
    try {
      manifest = JSON.parse(manifestNode.textContent || "{}");
    } catch (_) {
      manifest = {};
    }
    return Object.fromEntries(
      Array.from(document.querySelectorAll("template[data-page-route]")).map(
        (template) => {
          const route = template.dataset.pageRoute;
          return [
            route,
            { ...(manifest[route] || {}), html: template.innerHTML },
          ];
        },
      ),
    );
  }

  function resolveApiBaseUrl(value) {
    const raw = String(value || "")
      .trim()
      .replace(/\/+$/, "");
    if (location.protocol === "file:") return raw;
    try {
      const configured = new URL(raw, location.href);
      const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
      if (
        loopback.has(configured.hostname) &&
        !loopback.has(location.hostname)
      ) {
        return location.origin.replace(/\/+$/, "");
      }
    } catch (_) {
      return location.origin.replace(/\/+$/, "");
    }
    return raw;
  }

  function resolveChatbotApiBaseUrl(platformBase) {
    try {
      const parsed = new URL(platformBase, location.href);
      const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
      if (loopback.has(parsed.hostname) && parsed.port === "8081") {
        parsed.port = "8000";
        return parsed.origin;
      }
    } catch (_) {
      // Deployed traffic uses the same-origin reverse proxy.
    }
    return platformBase;
  }

  function applyDataImageFallbacks(root = document) {
    $$('img[data-image-fallback]', root).forEach((image) => {
      const fallback = MOCK_IMAGE_FALLBACKS[image.dataset.imageFallback];
      if (!fallback) return;
      const dataSource = safeCourseDetailUrl(image.dataset.imageSrc);
      const dataAlt = String(image.dataset.imageAlt || "").trim();
      const existingAlt = String(image.getAttribute("alt") || "").trim();

      if (dataSource) {
        image.addEventListener(
          "error",
          () => {
            image.src = fallback.src;
            image.alt = fallback.alt;
          },
          { once: true },
        );
        image.src = dataSource;
        image.alt = dataAlt || existingAlt || fallback.alt;
        return;
      }

      image.src = fallback.src;
      image.alt = fallback.alt;
    });
  }

  function readStorage(storage, key) {
    try {
      return storage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  function writeStorage(storage, key, value) {
    try {
      if (value) storage.setItem(key, value);
      else storage.removeItem(key);
    } catch (_) {
      // Storage can be unavailable in strict privacy modes; the current page still works.
    }
  }

  function parseBodyAttributes(raw) {
    const attrs = {};
    String(raw || "").replace(
      /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
      (_, name, dq, sq, bare) => {
        attrs[name.toLowerCase()] = dq ?? sq ?? bare ?? "";
        return "";
      },
    );
    return attrs;
  }

  function routeFromHash() {
    const hash = location.hash || "";
    const match = hash.match(/^#\/nav\/([^?]+)(?:\?(.*))?$/);
    if (!match) return { route: DEFAULT_ROUTE, target: "" };
    const route = decodeURIComponent(match[1]);
    const params = new URLSearchParams(match[2] || "");
    return {
      route: PAGES[route] ? route : DEFAULT_ROUTE,
      target: params.get("target") || "",
    };
  }

  function setMeta(meta) {
    document.title = meta.title || "Nexora Academy";
    const desc = document.querySelector('meta[name="description"]');
    const keywords = document.querySelector('meta[name="keywords"]');
    if (desc) desc.content = meta.description || "";
    if (keywords) keywords.content = meta.keywords || "";
  }

  const CHAT_WIDGET_HTML = '<button class="chat-fab" id="chat-fab" aria-label="Open AI chat"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button><div class="chat-widget" id="chat-widget" hidden><div class="chat-widget__header"><div class="chat-widget__identity"><div class="chat-widget__avatar">✦</div><div><h3>Nexora AI</h3><p>Academy guidance assistant</p></div></div><button class="chat-widget__close" id="chat-close" aria-label="Close chat">&times;</button></div><div class="chat-widget__messages" id="chat-messages" role="log" aria-live="polite"></div><div class="chat-widget__composer"><form class="chat-widget__form" id="chat-form" novalidate><textarea class="chat-widget__input" id="chat-input" name="message" rows="1" maxlength="2000" placeholder="Ask Nexora AI anything..." autocomplete="off" required></textarea><button class="chat-widget__send" id="chat-send" type="submit" aria-label="Send" disabled><svg viewBox="0 0 24 24"><path d="m5 12 14-7-4.4 14-2.5-5.1L5 12Z"/><path d="m12.1 13.9 3.6-3.7"/></svg></button></form></div></div>';

  function injectChatWidget() {
    if (document.getElementById("chat-fab")) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = CHAT_WIDGET_HTML;
    while (tmp.firstChild) document.body.appendChild(tmp.firstChild);
    window.__rebindChatWidget?.();
  }

  function renderRoute({ route, target = "" }, options = {}) {
    const page = PAGES[route] || PAGES[DEFAULT_ROUTE];
    pageController?.abort();
    pageController = new AbortController();
    const signal = pageController.signal;

    const attrs = parseBodyAttributes(page.bodyAttrs);
    document.body.className = attrs.class || "__variable_7fc4d2 antialiased";
    document.body.setAttribute("style", attrs.style || "overflow:auto");
    document.body.dataset.page = route;
    document.body.innerHTML = page.html;
    injectChatWidget();
    setMeta(page.meta);
    initPage(signal);

    const finishPosition = () => {
      if (target) {
        const node = document.getElementById(target);
        if (node) {
          node.scrollIntoView({ block: "center" });
          node.classList.remove("naic-target-flash");
          requestAnimationFrame(() => node.classList.add("naic-target-flash"));
          return;
        }
      }
      if (!options.keepScroll) window.scrollTo(0, 0);
    };
    requestAnimationFrame(() => requestAnimationFrame(finishPosition));
  }

  function navigate(route, target = "") {
    const next = `#/nav/${encodeURIComponent(route)}${target ? `?target=${encodeURIComponent(target)}` : ""}`;
    if (location.hash === next) renderRoute({ route, target });
    else location.hash = next;
  }

  function announce(form, message, state = "success") {
    let node = $(".naic-form-message", form);
    if (!node) {
      node = document.createElement("p");
      node.className = "naic-form-message";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      form.appendChild(node);
    }
    node.dataset.state = state;
    node.textContent = message;
  }

  function clearInvalid(form) {
    $$(".naic-field-invalid", form).forEach((field) =>
      field.classList.remove("naic-field-invalid"),
    );
  }

  function markInvalid(field) {
    if (!field) return;
    field.classList.add("naic-field-invalid");
    field.addEventListener(
      "input",
      () => field.classList.remove("naic-field-invalid"),
      { once: true },
    );
  }

  function showLegacyFormError(form, error) {
    const aliases = {
      firstName: "fullName",
      lastName: "fullName",
      message: "letter",
    };
    Object.keys(error?.errors || {}).forEach((name) =>
      markInvalid(form.elements.namedItem(aliases[name] || name)),
    );
    announce(form, apiErrorMessage(error), "error");
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function validPhone(value, required = false) {
    const phone = String(value || "").trim();
    if (!phone) return !required;
    const digits = phone.replace(/\D/g, "").length;
    return (
      phone.length <= 20 &&
      digits >= 7 &&
      digits <= 15 &&
      /^\+?\(?\d[\d ()-]*\d$/.test(phone)
    );
  }

  function personNameParts(value) {
    const normalized = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = normalized.split(" ").filter(Boolean);
    if (parts.length < 2) return null;
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    const validPart = (part) =>
      part.length >= 2 &&
      part.length <= 40 &&
      /^\p{L}[\p{L}\p{M}]*(?:[ '’\-][\p{L}\p{M}]+)*$/u.test(part);
    return validPart(firstName) && validPart(lastName)
      ? { firstName, lastName }
      : null;
  }

  function safeStoredValue(value) {
    if (value instanceof File) {
      return { name: value.name, size: value.size, type: value.type };
    }
    return value;
  }

  function saveOffline(kind, form) {
    const key = `naic_${kind}_submissions`;
    let current = [];
    try {
      current = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (_) {
      current = [];
    }
    const data = {};
    for (const [name, value] of new FormData(form).entries()) {
      data[name] = safeStoredValue(value);
    }
    current.push({ ...data, stored_at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(current));
    return { ok: true, offline: true };
  }

  function validPassword(value) {
    const password = String(value || "");
    return (
      password.length >= 8 &&
      password.length <= 72 &&
      /[A-Za-z]/.test(password) &&
      /\d/.test(password)
    );
  }

  class ApiError extends Error {
    constructor(status, message, body = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
      this.errors =
        body?.errors && typeof body.errors === "object" ? body.errors : null;
    }
  }

  function decodeAccessToken(token = accessToken) {
    try {
      const payload = String(token || "").split(".")[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(
        Math.ceil(normalized.length / 4) * 4,
        "=",
      );
      const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
      return null;
    }
  }

  function setTokens(tokens) {
    accessToken = tokens?.accessToken || "";
    writeStorage(sessionStorage, ACCESS_TOKEN_KEY, accessToken);
    if (tokens?.refreshToken)
      writeStorage(localStorage, REFRESH_TOKEN_KEY, tokens.refreshToken);
    const identity = decodeAccessToken(accessToken);
    writeStorage(
      sessionStorage,
      AUTH_USER_KEY,
      identity
        ? JSON.stringify({
            id: identity.sub || "",
            role: identity.role || "",
          })
        : "",
    );
    currentUserCache = null;
  }

  function clearTokens() {
    const identity = authIdentity();
    if (identity?.id)
      writeStorage(
        sessionStorage,
        `nexora_enrollment_attempt_${identity.id}`,
        "",
      );
    accessToken = "";
    currentUserCache = null;
    writeStorage(sessionStorage, ACCESS_TOKEN_KEY, "");
    writeStorage(sessionStorage, AUTH_USER_KEY, "");
    writeStorage(localStorage, REFRESH_TOKEN_KEY, "");
  }

  function authIdentity() {
    const decoded = decodeAccessToken();
    if (decoded) return { id: decoded.sub || "", role: decoded.role || "" };
    try {
      return JSON.parse(readStorage(sessionStorage, AUTH_USER_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function apiErrorMessage(error) {
    if (error?.status === 429)
      return "Çox sayda cəhd edildi. Bir az sonra yenidən yoxlayın.";
    if (error?.status === 0)
      return "Serverlə əlaqə yaratmaq mümkün olmadı. Server tərəfinin işlədiyini və CORS ayarlarını yoxlayın.";
    if (error?.status === 401)
      return "Sessiya etibarsızdır. Yenidən daxil olun.";
    if (error?.status === 403)
      return "Bu əməliyyat üçün icazəniz yoxdur.";
    return error?.message || "Sorğu zamanı xəta baş verdi.";
  }

  async function refreshAccessToken() {
    const refreshToken = readStorage(localStorage, REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) {
          clearTokens();
          return false;
        }
        const tokens = await response.json();
        setTokens(tokens);
        return Boolean(accessToken);
      } catch (_) {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }

  async function apiFetch(path, options = {}, canRefresh = true) {
    const headers = new Headers(options.headers || {});
    if (
      options.body != null &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new ApiError(0, "Server tərəfi ilə əlaqə yaradılmadı.");
    }

    if (
      response.status === 401 &&
      canRefresh &&
      !path.startsWith("/api/v1/auth/")
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return apiFetch(path, options, false);
    }

    let body;
    if (response.status !== 204) {
      const raw = await response.text();
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (_) {
          body = { message: raw };
        }
      }
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        body?.message || response.statusText || "Sorğu uğursuz oldu.",
        body,
      );
    }
    return body;
  }

  async function chatbotApiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body != null && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");

    let response;
    try {
      response = await fetch(`${CHATBOT_API_BASE_URL}${path}`, {
        ...options,
        headers,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new ApiError(0, "Sorğu xidməti ilə əlaqə yaradılmadı.");
    }

    let body;
    const raw = await response.text();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (_) {
        body = { message: raw };
      }
    }
    if (!response.ok) {
      throw new ApiError(
        response.status,
        body?.message || body?.reply || response.statusText || "Sorğu uğursuz oldu.",
        body,
      );
    }
    return body;
  }

  function setFormMessage(form, message, state = "") {
    const node = $(".Nexora_formMessage", form);
    if (!node) return;
    node.textContent = message;
    if (state) node.dataset.state = state;
    else delete node.dataset.state;
  }

  function clearFormErrors(form) {
    $$(".Nexora_fieldInvalid", form).forEach((field) => {
      field.classList.remove("Nexora_fieldInvalid");
      field.removeAttribute("aria-invalid");
    });
    setFormMessage(form, "");
  }

  function markFormField(field) {
    if (!field) return;
    field.classList.add("Nexora_fieldInvalid");
    field.setAttribute("aria-invalid", "true");
    field.addEventListener(
      "input",
      () => {
        field.classList.remove("Nexora_fieldInvalid");
        field.removeAttribute("aria-invalid");
      },
      { once: true },
    );
  }

  function showFormError(form, error) {
    if (error?.errors) {
      const aliases = {
        firstName: "fullName",
        lastName: "fullName",
        message: "letter",
      };
      Object.entries(error.errors).forEach(([name]) =>
        markFormField(form.elements.namedItem(aliases[name] || name)),
      );
    }
    setFormMessage(form, apiErrorMessage(error), "error");
  }

  function setFormBusy(form, busy) {
    form.setAttribute("aria-busy", String(busy));
    $$('button[type="submit"]', form).forEach((button) => {
      button.disabled = busy;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  }

  const enumLabels = {
    GUEST: "Qonaq",
    STUDENT: "Tələbə",
    SALES_CRM: "Satış / CRM",
    CONTENT_MANAGER: "Kontent meneceri",
    ADMIN: "Administrator",
    SYSTEM_ADMIN: "Sistem administratoru",
    PENDING_VERIFICATION: "Təsdiq gözlənilir",
    ACTIVE: "Aktiv",
    SUSPENDED: "Dayandırılıb",
    DEACTIVATED: "Deaktiv edilib",
    BANNED: "Bloklanıb",
    BEGINNER: "Başlanğıc",
    INTERMEDIATE: "Orta",
    ADVANCED: "İrəli",
    ONLINE: "Onlayn",
    OFFLINE: "Əyani",
    HYBRID: "Hibrid",
    WAITLISTED: "Gözləmə siyahısı",
    HELD: "Rezerv edilib",
    PENDING_PAYMENT: "Ödəniş gözlənilir",
    CONFIRMED: "Təsdiqlənib",
    COMPLETED: "Tamamlanıb",
    CANCELLED: "Ləğv edilib",
    REFUNDED: "Geri qaytarılıb",
  };

  function enumLabel(value) {
    return (
      enumLabels[value] ||
      String(value || "")
        .replaceAll("_", " ")
        .toLocaleLowerCase("az")
    );
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const months = [
      "yanvar",
      "fevral",
      "mart",
      "aprel",
      "may",
      "iyun",
      "iyul",
      "avqust",
      "sentyabr",
      "oktyabr",
      "noyabr",
      "dekabr",
    ];
    return `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  function formatPrice(value, currency = "AZN") {
    if (value == null || value === "") return "Qiymət üçün müraciət et";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    try {
      return new Intl.NumberFormat("az-AZ", {
        style: "currency",
        currency: currency || "AZN",
      }).format(amount);
    } catch (_) {
      return `${amount} ${currency || "AZN"}`;
    }
  }

  function currentReturnTarget() {
    const file = location.pathname.split("/").pop() || "index.html";
    return `${file}${location.search}`;
  }

  function createIdempotencyKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }

  function loginUrl(returnTarget = currentReturnTarget()) {
    return `login.html?return=${encodeURIComponent(returnTarget)}`;
  }

  function normalizedEnum(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  }

  function userRole(user) {
    return normalizedEnum(user?.role || authIdentity()?.role);
  }

  function userAccountStatus(user) {
    return normalizedEnum(user?.accountStatus || user?.status);
  }

  function roleDestination(role) {
    return ROLE_DESTINATIONS[normalizedEnum(role)] || "profile.html";
  }

  function returnTargetAllowed(target, role) {
    const file = target.pathname.split("/").pop()?.toLowerCase() || "index.html";
    if (/^(?:login|register|password|account-status)\.html$/.test(file))
      return false;
    if (/^(?:student|enrollments)\.html$/.test(file))
      return normalizedEnum(role) === "STUDENT";
    if (file === "staff.html") return STAFF_ROLES.has(normalizedEnum(role));
    return true;
  }

  async function redirectAfterLogin(signal) {
    const user = await loadCurrentUser(signal);
    const status = userAccountStatus(user);
    if (status && status !== "ACTIVE") {
      location.assign("account-status.html");
      return;
    }
    const role = userRole(user);
    const requested = new URLSearchParams(location.search).get("return");
    if (requested) {
      try {
        const target = new URL(requested, location.href);
        if (
          target.origin === location.origin &&
          returnTargetAllowed(target, role)
        ) {
          location.assign(target.href);
          return;
        }
      } catch (_) {
        // Fall back to the role landing page.
      }
    }
    location.assign(roleDestination(role));
  }

  async function ensureAuthenticated() {
    if (accessToken || (await refreshAccessToken())) return true;
    location.replace(loginUrl());
    return false;
  }

  async function loadCurrentUser(signal) {
    if (currentUserCache) return currentUserCache;
    currentUserCache = await apiFetch("/api/v1/users/me", { signal });
    return currentUserCache;
  }

  async function requireUser(signal, allowedRoles = null, allowInactive = false) {
    if (!(await ensureAuthenticated()) || signal.aborted) return null;
    const user = await loadCurrentUser(signal);
    if (signal.aborted) return null;
    const status = userAccountStatus(user);
    if (!allowInactive && status && status !== "ACTIVE") {
      location.replace("account-status.html");
      return null;
    }
    const role = userRole(user);
    if (allowedRoles && !allowedRoles.includes(role)) {
      location.replace(roleDestination(role));
      return null;
    }
    return user;
  }

  function createCourseMenuLink(course, className = "") {
    const link = document.createElement("a");
    if (className) link.className = className;
    link.href = course?.id
      ? `course-details.html?id=${encodeURIComponent(course.id)}`
      : "courses.html";
    link.textContent = course?.title || "Bütün kurslar";
    return link;
  }

  async function initCourseMenus(signal, closeMobileMenu) {
    const desktopMenus = $$(".Header_header__menu__drowpdown__KnfZg");
    const mobileCourseBodies = $$(
      '.HeaderMobile_menu__accordion__item__lNOEz[type="button"]',
    )
      .filter((button) => {
        const title = $(
          '[class*="menu__accordion__item__header__title"]',
          button,
        );
        return title?.textContent.replace(/\s+/g, " ").trim() === "Kurslar";
      })
      .map((button) => $('[class*="menu__accordion__item__body"]', button))
      .filter(Boolean);
    if (!desktopMenus.length && !mobileCourseBodies.length) return;

    try {
      const { courses } = await loadPublicCourseCatalog(signal);
      if (signal.aborted) return;
      const visibleCourses = courses.filter(
        (course) => course?.id && String(course.title || "").trim(),
      );

      desktopMenus.forEach((menu) => {
        const categoryLinks = Array.from(menu.children).filter(
          (node) =>
            node.tagName === "A" &&
            node.getAttribute("href") === "categories.html",
        );
        const links = visibleCourses.map((course) =>
          createCourseMenuLink(
            course,
            "Header_header__menu__drowpdown__item__jIbqp",
          ),
        );
        links.push(
          createCourseMenuLink(
            null,
            "Header_header__menu__drowpdown__item__jIbqp",
          ),
        );
        menu.replaceChildren(...links);
        categoryLinks.forEach((link) => menu.append(link));
      });

      mobileCourseBodies.forEach((body) => {
        const categoryLinks = Array.from(body.children).filter(
          (node) =>
            node.tagName === "A" &&
            node.getAttribute("href") === "categories.html",
        );
        const links = visibleCourses.map((course) =>
          createCourseMenuLink(course),
        );
        links.push(createCourseMenuLink(null));
        if (closeMobileMenu) {
          links.forEach((link) =>
            link.addEventListener("click", closeMobileMenu, { signal }),
          );
        }
        body.replaceChildren(...links);
        categoryLinks.forEach((link) => {
          if (closeMobileMenu)
            link.addEventListener("click", closeMobileMenu, { signal });
          body.append(link);
        });
      });
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      // Keep the static "Bütün kurslar" link as a resilient fallback.
    }
  }

  function headerUserDisplayName(user) {
    return (
      String(user?.fullName || "").trim() ||
      [user?.firstName, user?.lastName]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ") ||
      String(user?.email || "").trim()
    );
  }

  async function initHeaderUser(signal, header, mobileMenu) {
    const loginLinks = [
      ...(header
        ? $$('a.Header_header__menu__link__i1AD1[href="login.html"]', header)
        : []),
      ...(mobileMenu
        ? $$(
            'a.HeaderMobile_menu__accordion__item__header__title__m4g5z[href="login.html"]',
            mobileMenu,
          )
        : []),
    ];
    const hasSession = Boolean(
      accessToken || readStorage(localStorage, REFRESH_TOKEN_KEY),
    );
    if (!loginLinks.length || !hasSession) return;

    const setPending = (pending) => {
      loginLinks.forEach((link) => {
        const label = $("span", link) || link;
        label.classList.toggle("naic-auth-pending", pending);
      });
    };

    setPending(true);
    try {
      const user = await loadCurrentUser(signal);
      if (signal.aborted) return;
      setPending(false);
      const displayName = headerUserDisplayName(user);
      if (!displayName) return;
      loginLinks.forEach((link) => {
        link.setAttribute("href", "profile.html");
        const label = $("span", link) || link;
        label.textContent = displayName;
        link.setAttribute("aria-label", `${displayName} profilinə keç`);
      });
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      setPending(false);
      // Keep the static "Daxil ol" link when the session cannot be restored.
    }
  }

  function initHeader(signal) {
    const header = $('.Header_header__8yaFd');
    if (header) {
      const update = () => header.classList.toggle('Header_fixed__CRpV_', window.scrollY > 12);
      update();
      window.addEventListener('scroll', update, { passive: true, signal });
    }
    const mobileMenu = $('.HeaderMobile_header_mobile_menu__b38W_');
    const menuButtons = $$('.header__menu__btn');
    let closeMobileMenu = null;
    if (mobileMenu && menuButtons.length) {
      const open = () => {
        mobileMenu.classList.add('HeaderMobile_show__tPAoO');
        document.documentElement.classList.add('naic-menu-open');
        document.body.classList.add('naic-menu-open');
        menuButtons[0]?.setAttribute('aria-expanded', 'true');
      };
      const close = () => {
        mobileMenu.classList.remove('HeaderMobile_show__tPAoO');
        document.documentElement.classList.remove('naic-menu-open');
        document.body.classList.remove('naic-menu-open');
        menuButtons[0]?.setAttribute('aria-expanded', 'false');
      };
      closeMobileMenu = close;
      menuButtons[0]?.setAttribute('aria-label', 'Open menu');
      menuButtons[0]?.setAttribute('aria-expanded', 'false');
      menuButtons[0]?.addEventListener('click', open, { signal });
      menuButtons[1]?.setAttribute('aria-label', 'Close menu');
      menuButtons[1]?.addEventListener('click', close, { signal });
      $$('a', mobileMenu).forEach((a) => a.addEventListener('click', close, { signal }));
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape')
        close(); }, { signal });
    }
    $$('.HeaderMobile_menu__accordion__item__lNOEz[type="button"]').forEach((button) => {
      const body = $('[class*="menu__accordion__item__body"]', button);
      if (!body)
        return;
      button.setAttribute('aria-expanded', 'false');
      body.hidden = true;
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        button.classList.toggle('HeaderMobile_active__Y_T4I', !expanded);
        body.hidden = expanded;
      }, { signal });
    });
    void initHeaderUser(signal, header, mobileMenu);
    void initCourseMenus(signal, closeMobileMenu);
  }

  function initHeroMedia(signal) {
    const video = $(".HeroSection_video__GVdk5");
    const playButton = $('[data-hero-control="playback"]');
    const muteButton = $('[data-hero-control="sound"]');
    const hasSource = Boolean(
      video?.querySelector("source[src]") || video?.getAttribute("src"),
    );
    if (!video || !hasSource) {
      playButton?.setAttribute("aria-disabled", "true");
      muteButton?.setAttribute("aria-disabled", "true");
      return;
    }
    const icons = {
      play: '<path d="M8 5.75v12.5L18 12 8 5.75Z"></path>',
      pause:
        '<path d="M8 5V19M16 5V19" style="fill:none" stroke="var(--neutral-1)" stroke-linecap="round" stroke-width="2"></path>',
      muted:
        '<path d="M4 9h3l4-4v14l-4-4H4V9Z"></path><path d="m15 9 5 6m0-6-5 6" style="fill:none" stroke="var(--neutral-1)" stroke-linecap="round" stroke-width="2"></path>',
      sound:
        '<path d="M4 9h3l4-4v14l-4-4H4V9Z"></path><path d="M14.5 8.5C16.4 10.4 16.4 13.6 14.5 15.5M17 6C20.3 9.3 20.3 14.7 17 18" style="fill:none" stroke="var(--neutral-1)" stroke-linecap="round" stroke-width="1.8"></path>',
    };
    const setButtonIcon = (button, icon) => {
      const svg = $("svg", button);
      if (!svg) return;
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.innerHTML = icons[icon];
    };
    const syncPlaybackControl = () => {
      if (!playButton) return;
      const isPaused = video.paused || video.ended;
      playButton.dataset.mediaState = isPaused ? "paused" : "playing";
      playButton.setAttribute(
        "aria-label",
        isPaused ? "Videonu oynat" : "Videonu dayandır",
      );
      setButtonIcon(playButton, isPaused ? "play" : "pause");
    };
    const syncSoundControl = () => {
      if (!muteButton) return;
      const isMuted = video.muted || video.volume === 0;
      muteButton.dataset.mediaState = isMuted ? "muted" : "unmuted";
      muteButton.setAttribute("aria-label", isMuted ? "Səsi aç" : "Səsi bağla");
      setButtonIcon(muteButton, isMuted ? "muted" : "sound");
    };
    playButton?.addEventListener(
      "click",
      async () => {
        try {
          if (video.paused) await video.play();
          else video.pause();
          syncPlaybackControl();
        } catch (_) {
          playButton.setAttribute("aria-disabled", "true");
        }
      },
      { signal },
    );
    muteButton?.addEventListener(
      "click",
      () => {
        video.muted = !video.muted;
        syncSoundControl();
      },
      { signal },
    );
    ["play", "pause", "ended"].forEach((eventName) =>
      video.addEventListener(eventName, syncPlaybackControl, { signal }),
    );
    video.addEventListener("volumechange", syncSoundControl, { signal });
    video.addEventListener(
      "loadedmetadata",
      () => {
        syncPlaybackControl();
        syncSoundControl();
      },
      { signal },
    );
    syncPlaybackControl();
    syncSoundControl();
  }

  function initHeroTypewriter(signal) {
    const TYPE_SPEED_MS = 80;
    const DELETE_SPEED_MS = 45;
    const HOLD_AFTER_TYPE_MS = 1700;
    const PAUSE_AFTER_DELETE_MS = 400;
    const START_DELAY_MS = 250;
    const title = $(".HeroSection_content__title__Wr5gI");
    const parts = title ? $$(":scope > span", title) : [];
    if (!title || parts.length !== 2) return;

    const pause = (delay) =>
      new Promise((resolve) => {
        if (signal.aborted) {
          resolve(false);
          return;
        }

        let settled = false;
        const finish = (completed) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", cancel);
          resolve(completed);
        };
        const timer = window.setTimeout(() => finish(true), delay);
        const cancel = () => {
          window.clearTimeout(timer);
          finish(false);
        };
        signal.addEventListener("abort", cancel, { once: true });
      });

    const waitForBanner = () =>
      new Promise((resolve) => {
        if (document.body.dataset.page !== "home") {
          resolve(true);
          return;
        }
        if (signal.aborted) {
          resolve(false);
          return;
        }

        let settled = false;
        const finish = (completed) => {
          if (settled) return;
          settled = true;
          document.removeEventListener("nexora:home-banner-ready", ready);
          signal.removeEventListener("abort", cancel);
          resolve(completed);
        };
        const ready = () => finish(true);
        const cancel = () => finish(false);
        document.addEventListener("nexora:home-banner-ready", ready, {
          once: true,
        });
        signal.addEventListener("abort", cancel, { once: true });
      });

    const run = async () => {
      if (!(await waitForBanner())) return;

      const originalParts = parts.map((part) =>
        part.textContent.replace(/\s+/g, " ").trim(),
      );
      if (originalParts.some((part) => !part)) return;

      const exactText = originalParts.join(" ");
      title.setAttribute("aria-label", exactText);
      parts.forEach((part) => {
        part.textContent = "";
        part.setAttribute("aria-hidden", "true");
      });
      const characters = originalParts.map((part) => Array.from(part));

      if (!(await pause(START_DELAY_MS))) return;

      while (!signal.aborted) {
        for (let partIndex = 0; partIndex < characters.length; partIndex += 1) {
          for (const character of characters[partIndex]) {
            if (signal.aborted) return;
            parts[partIndex].textContent += character;
            if (!(await pause(TYPE_SPEED_MS))) return;
          }
        }

        if (!(await pause(HOLD_AFTER_TYPE_MS))) return;

        for (
          let partIndex = characters.length - 1;
          partIndex >= 0;
          partIndex -= 1
        ) {
          while (parts[partIndex].textContent.length > 0) {
            if (signal.aborted) return;
            parts[partIndex].textContent = Array.from(
              parts[partIndex].textContent,
            )
              .slice(0, -1)
              .join("");
            if (!(await pause(DELETE_SPEED_MS))) return;
          }
        }

        if (!(await pause(PAUSE_AFTER_DELETE_MS))) return;
      }
    };

    void run();
  }

  function initApplicationForm(signal) {
    const form = $("form#applicationForm");
    if (!form) return;
    form.noValidate = true;
    const steps = $$('[class*="ai-form__step_"]', form).filter((el) =>
      el.className.includes("SendApplicationSection_ai-form__step___"),
    );
    if (steps.length < 2) return;
    const activeClass = "SendApplicationSection_active__5RPzX";
    const next = $(".ai-form__step__btn-next", form);
    const back = steps[1].querySelector('button[type="button"]');

    const showStep = (index) => {
      steps.forEach((step, i) =>
        step.classList.toggle(activeClass, i === index),
      );
      steps[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    next?.addEventListener(
      "click",
      () => {
        const selected = $('input[name="applicationType"]:checked', form);
        if (!selected) {
          announce(form, "Davam etmək üçün müraciət məqsədini seçin.", "error");
          return;
        }
        announce(form, "", "success");
        showStep(1);
      },
      { signal },
    );
    back?.addEventListener("click", () => showStep(0), { signal });

    const file = $('input[name="cv"]', form);
    const fileLabel = file
      ? $(`label[for="${file.id}"] [class*="label__text"]`, form)
      : null;
    const fileLabelDefault = fileLabel?.textContent || "CV əlavə et";
    file?.addEventListener(
      "change",
      () => {
        if (file.files?.[0] && fileLabel)
          fileLabel.textContent = file.files[0].name;
      },
      { signal },
    );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearInvalid(form);
        const type = $('input[name="applicationType"]:checked', form);
        const fullname = $('input[name="fullname"]', form);
        const email = $('input[name="email"]', form);
        const phone = $('input[name="phone"]', form);
        const letter = $('[name="letter"]', form);
        const cv = $('input[name="cv"]', form);
        const invalid = [];
        if (!type) invalid.push(...$$('input[name="applicationType"]', form));
        if (!fullname?.value.trim()) invalid.push(fullname);
        if (!email?.value || !validEmail(email.value)) invalid.push(email);
        if (
          !phone?.value.trim() ||
          !/^[+\d\s()-]{7,30}$/.test(phone.value.trim())
        )
          invalid.push(phone);
        if (
          !letter?.value.trim() ||
          letter.value.trim().length < 50 ||
          letter.value.length > 2000
        )
          invalid.push(letter);
        const selectedFile = cv?.files?.[0];
        if (
          !selectedFile ||
          selectedFile.size > 10 * 1024 * 1024 ||
          !/\.(pdf|doc|docx)$/i.test(selectedFile.name)
        )
          invalid.push(cv);
        invalid.filter(Boolean).forEach(markInvalid);
        if (invalid.length) {
          announce(
            form,
            "Məlumatları yoxlayın: bütün xanalar, etibarlı e-poçt, ən azı 50 simvolluq motivasiya məktubu və 10 MB-dan kiçik PDF/Word CV tələb olunur.",
            "error",
          );
          return;
        }
        setFormBusy(form, true);
        try {
          const data = {
            applicationType: Number(type.value),
            fullname: fullname.value.trim(),
            email: email.value.trim(),
            phone: phone.value.trim(),
            letter: letter.value.trim(),
          };
          const body = new FormData();
          body.append(
            "data",
            new Blob([JSON.stringify(data)], { type: "application/json" }),
          );
          body.append("cv", selectedFile, selectedFile.name);
          await apiFetch("/api/v1/applications", {
            method: "POST",
            signal,
            body,
          });
          form.reset();
          if (fileLabel) fileLabel.textContent = fileLabelDefault;
          showStep(0);
          announce(form, "Müraciətiniz uğurla göndərildi.", "success");
        } catch (error) {
          if (error?.name !== "AbortError")
            showLegacyFormError(form, error);
        } finally {
          setFormBusy(form, false);
        }
      },
      { signal },
    );
  }

  function initSimpleForms(signal) {
    $$("form[data-form-kind]").forEach((form) => {
      form.noValidate = true;
      form.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
          clearInvalid(form);
          const kind = form.dataset.formKind;
          const invalid = [];
          if (kind === "subscribe") {
            const email = $('input[name="email"]', form);
            if (!email?.value || !validEmail(email.value)) invalid.push(email);
          } else {
            $$("[required]", form).forEach((field) => {
              if (!field.value?.trim()) invalid.push(field);
            });
            const email = $('input[name="email"]', form);
            if (email && !validEmail(email.value)) invalid.push(email);
            const phone = $('input[name="phone"]', form);
            if (phone && !validPhone(phone.value, true)) invalid.push(phone);
            const letter = $('[name="letter"]', form);
            if (letter && letter.value.trim().length < 10) invalid.push(letter);
          }
          invalid.filter(Boolean).forEach(markInvalid);
          if (invalid.length) {
            announce(
              form,
              kind === "subscribe"
                ? "Etibarlı e-poçt ünvanı daxil edin."
                : "Bütün xanaları düzgün doldurun.",
              "error",
            );
            return;
          }
          if (kind === "subscribe") {
            const submit = $('button[type="submit"]', form);
            submit?.setAttribute("disabled", "disabled");
            try {
              saveOffline(kind, form);
              announce(
                form,
                "E-poçt bu cihazda saxlanıldı.",
                "success",
              );
              form.reset();
            } catch (_) {
              announce(
                form,
                "Məlumatı brauzer yaddaşında saxlamaq mümkün olmadı.",
                "error",
              );
            } finally {
              submit?.removeAttribute("disabled");
            }
            return;
          }
          if (kind === "contact") {
            const submit = $('button[type="submit"]', form);
            const fullName = form.elements.full_name.value.trim();
            const email = form.elements.email.value.trim();
            const phone = form.elements.phone.value.trim();
            const note = form.elements.letter.value.trim();
            submit?.setAttribute("disabled", "disabled");
            form.setAttribute("aria-busy", "true");
            try {
              const response = await chatbotApiFetch("/api/lead", {
                method: "POST",
                signal,
                body: JSON.stringify({
                  name: fullName,
                  phone,
                  email,
                  interest: "academy-contact",
                  note,
                  source: "website-contact",
                }),
              });
              if (response?.success !== true)
                throw new ApiError(0, "Müraciət qeydə alınmadı.");
              form.reset();
              announce(form, "Müraciətiniz uğurla göndərildi.", "success");
            } catch (error) {
              if (error?.name !== "AbortError")
                showLegacyFormError(form, error);
            } finally {
              form.removeAttribute("aria-busy");
              submit?.removeAttribute("disabled");
            }
          }
        },
        { signal },
      );
    });
  }

  function initVacancies(signal) {
    const input = $("#searchVacancies");
    if (!input) return;
    const tabs = $$(".Vacancies_ai-tabs__item__l5MN4");
    const activeClass = "Vacancies_ai-tabs__item--active__dqm_Y";
    const locale = "az";
    const filter = () => {
      const query = input.value.trim().toLocaleLowerCase(locale);
      const activeTab = tabs.find((tab) => tab.classList.contains(activeClass));
      const availableOnly = /mövcud|available/i.test(
        activeTab?.textContent || "",
      );
      const cards = $$(".Vacancies_ai-vacancies__item__MWNY2");
      cards.forEach((card) => {
        const matchesQuery = card.textContent
          .toLocaleLowerCase(locale)
          .includes(query);
        const matchesAvailability =
          !availableOnly || card.dataset.scholarshipAvailable !== "false";
        card.hidden = !matchesQuery || !matchesAvailability;
      });
    };
    input.addEventListener("input", filter, { signal });
    tabs.forEach((tab) =>
      tab.addEventListener(
        "click",
        () => {
          tabs.forEach((x) => x.classList.remove(activeClass));
          tab.classList.add(activeClass);
          filter();
        },
        { signal },
      ),
    );
    filter();
  }

  function setupCoverflow(
    {
      containerSelector,
      prevSelector,
      nextSelector,
      depth = 220,
      centerFromLayout = false,
      autoplayMs = 0,
    },
    signal,
  ) {
    const container = $(containerSelector);
    if (!container) return;
    const wrapper = $(".swiper-wrapper", container);
    const slides = $$(".swiper-slide", container);
    if (!wrapper || !slides.length) return;
    let active = Math.max(
      0,
      slides.findIndex((slide) =>
        slide.classList.contains("swiper-slide-active"),
      ),
    );
    let currentOffset = 0;
    const render = (animate = true) => {
      if (centerFromLayout) {
        slides.forEach((slide, index) => {
          const distance = index - active;
          slide.classList.toggle("swiper-slide-active", distance === 0);
          slide.classList.toggle("swiper-slide-prev", distance === -1);
          slide.classList.toggle("swiper-slide-next", distance === 1);
          slide.classList.toggle(
            "swiper-slide-visible",
            Math.abs(distance) <= 2,
          );
        });
      }
      const containerWidth = container.clientWidth || window.innerWidth;
      const activeSlide = slides[active];
      const slideWidth = activeSlide?.getBoundingClientRect().width || 315;
      const margin =
        parseFloat(getComputedStyle(activeSlide).marginRight) || 0;
      const offset = centerFromLayout
        ? containerWidth / 2 -
          ((activeSlide?.offsetLeft || 0) + (activeSlide?.offsetWidth || slideWidth) / 2)
        : containerWidth / 2 -
          slideWidth / 2 -
          active * (slideWidth + margin);
      currentOffset = offset;
      wrapper.style.transition = animate ? "transform 480ms ease" : "none";
      wrapper.style.transform = `translate3d(${offset}px, 0, 0)`;
      slides.forEach((slide, index) => {
        const distance = index - active;
        if (!centerFromLayout) {
          slide.classList.toggle("swiper-slide-active", distance === 0);
          slide.classList.toggle("swiper-slide-prev", distance === -1);
          slide.classList.toggle("swiper-slide-next", distance === 1);
          slide.classList.toggle(
            "swiper-slide-visible",
            Math.abs(distance) <= 2,
          );
        }
        slide.style.transition = animate
          ? "transform 480ms ease, opacity 480ms ease"
          : "none";
        slide.style.transform = `translate3d(${distance * -10}px, 0, ${-Math.abs(distance) * depth}px) scale(1)`;
        slide.style.zIndex = String(slides.length - Math.abs(distance));
        slide.style.opacity =
          Math.abs(distance) > 3 ? "0.25" : distance === 0 ? "1" : "0.55";
      });
    };
    const move = (delta) => {
      active = (active + delta + slides.length) % slides.length;
      render(true);
    };
    let autoplayTimer = null;
    let dragState = null;
    const stopAutoplay = () => {
      if (autoplayTimer === null) return;
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    };
    const restartAutoplay = () => {
      stopAutoplay();
      autoplayTimer =
        autoplayMs > 0 && slides.length > 1
          ? window.setInterval(() => move(1), autoplayMs)
          : null;
    };
    const manualMove = (delta) => {
      dragState = null;
      move(delta);
      restartAutoplay();
    };
    $(prevSelector)?.addEventListener("click", () => manualMove(-1), {
      signal,
    });
    $(nextSelector)?.addEventListener("click", () => manualMove(1), {
      signal,
    });

    const getRenderedOffset = () => {
      const transform = window.getComputedStyle(wrapper).transform;
      if (!transform || transform === "none") return currentOffset;
      const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
      if (matrix3d) {
        const values = matrix3d[1].split(",").map(Number);
        return Number.isFinite(values[12]) ? values[12] : currentOffset;
      }
      const matrix = transform.match(/^matrix\((.+)\)$/);
      if (matrix) {
        const values = matrix[1].split(",").map(Number);
        return Number.isFinite(values[4]) ? values[4] : currentOffset;
      }
      return currentOffset;
    };
    const getDragThreshold = () => {
      const activeSlide = slides[active];
      const slideWidth = activeSlide?.getBoundingClientRect().width || 315;
      return Math.min(80, Math.max(45, slideWidth * 0.12));
    };
    const startDrag = (clientX, clientY, inputType) => {
      stopAutoplay();
      const baseOffset = getRenderedOffset();
      dragState = {
        inputType,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        axis: inputType === "mouse" ? "horizontal" : null,
        baseOffset,
      };
      wrapper.style.transition = "none";
      wrapper.style.transform = `translate3d(${baseOffset}px, 0, 0)`;
    };
    const updateDrag = (clientX, clientY, event) => {
      if (!dragState) return;
      const deltaX = clientX - dragState.startX;
      const deltaY = clientY - dragState.startY;
      if (dragState.axis === null && Math.hypot(deltaX, deltaY) >= 6) {
        dragState.axis =
          Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
      }
      dragState.lastX = clientX;
      if (dragState.axis !== "horizontal") return;
      event.preventDefault();
      wrapper.style.transform = `translate3d(${dragState.baseOffset + deltaX}px, 0, 0)`;
    };
    const finishDrag = (clientX, allowSnap = true) => {
      if (!dragState) return;
      const completedDrag = dragState;
      const endX = Number.isFinite(clientX) ? clientX : completedDrag.lastX;
      const deltaX = endX - completedDrag.startX;
      dragState = null;
      if (
        allowSnap &&
        completedDrag.axis === "horizontal" &&
        Math.abs(deltaX) >= getDragThreshold()
      ) {
        move(deltaX > 0 ? -1 : 1);
      } else {
        render(true);
      }
      restartAutoplay();
    };

    container.addEventListener(
      "mousedown",
      (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        startDrag(event.clientX, event.clientY, "mouse");
      },
      { signal },
    );
    window.addEventListener(
      "mousemove",
      (event) => {
        if (dragState?.inputType !== "mouse") return;
        updateDrag(event.clientX, event.clientY, event);
      },
      { signal },
    );
    window.addEventListener(
      "mouseup",
      (event) => {
        if (dragState?.inputType !== "mouse") return;
        finishDrag(event.clientX);
      },
      { signal },
    );
    container.addEventListener(
      "dragstart",
      (event) => event.preventDefault(),
      { signal },
    );
    container.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        startDrag(touch.clientX, touch.clientY, "touch");
      },
      { signal, passive: true },
    );
    container.addEventListener(
      "touchmove",
      (event) => {
        if (dragState?.inputType !== "touch" || event.touches.length !== 1)
          return;
        const touch = event.touches[0];
        updateDrag(touch.clientX, touch.clientY, event);
      },
      { signal, passive: false },
    );
    container.addEventListener(
      "touchend",
      (event) => {
        if (dragState?.inputType !== "touch") return;
        finishDrag(event.changedTouches[0]?.clientX);
      },
      { signal, passive: true },
    );
    container.addEventListener(
      "touchcancel",
      () => {
        if (dragState?.inputType !== "touch") return;
        finishDrag(dragState.lastX, false);
      },
      { signal, passive: true },
    );
    window.addEventListener(
      "blur",
      () => {
        if (dragState?.inputType !== "mouse") return;
        finishDrag(dragState.lastX, false);
      },
      { signal },
    );
    window.addEventListener(
      "resize",
      () => {
        dragState = null;
        render(false);
        restartAutoplay();
      },
      { signal },
    );
    signal?.addEventListener(
      "abort",
      () => {
        stopAutoplay();
      },
      { once: true },
    );
    requestAnimationFrame(() => render(false));
    restartAutoplay();
  }

  function initSliders(signal) {
    const SCHOLARSHIPS_SLIDER_AUTOPLAY_MS = 4500;
    setupCoverflow(
      {
        containerSelector: ".SuccessStories_ai-success--stories__vv5bs .swiper",
        prevSelector:
          ".SuccessStories_section__header__controller__prev__aQ8hL",
        nextSelector:
          ".SuccessStories_section__header__controller__next__A3AXv",
        depth: 290,
        centerFromLayout: true,
        autoplayMs: SCHOLARSHIPS_SLIDER_AUTOPLAY_MS,
      },
      signal,
    );
    setupCoverflow(
      {
        containerSelector: ".ViewsFromNaic_ai-views--from--naic__Zd_6I .swiper",
        prevSelector: ".ViewsFromNaic_section__header__controller__prev__cyPxK",
        nextSelector: ".ViewsFromNaic_section__header__controller__next__wERDV",
        depth: 125,
        centerFromLayout: true,
        autoplayMs: SCHOLARSHIPS_SLIDER_AUTOPLAY_MS,
      },
      signal,
    );
  }

  function initPagination(signal) {
    const FAQ_PAGE_SIZE = 6;
    const activeClass = "Pagination_active__qQWfE";
    $$(".Pagination_ai-pagination__mtI7X").forEach((pagination) => {
      const buttons = $$(".Pagination_ai-pagination__item___y0si", pagination);
      const pageButtons = buttons.filter((button) =>
        /^\d+$/.test(button.textContent.trim()),
      );
      const section = pagination.closest(".section");
      const cards = section
        ? $$(".BlogCard_ai-blogs__item__4ILGi", section)
        : [];
      if (!pageButtons.length || !cards.length) return;
      const totalPages = Math.min(
        pageButtons.length,
        Math.ceil(cards.length / FAQ_PAGE_SIZE),
      );
      const prev = buttons.find((button) => {
        const label = button.getAttribute("aria-label") || "";
        return label.includes("Əvvəlki") || label.includes("Previous");
      });
      const next = buttons.find((button) => {
        const label = button.getAttribute("aria-label") || "";
        return label.includes("Növbəti") || label.includes("Next");
      });
      let active = clamp(
        pageButtons.findIndex((button) => button.classList.contains(activeClass)),
        0,
        totalPages - 1,
      );
      const setPage = (index, shouldScroll = true) => {
        active = clamp(index, 0, totalPages - 1);
        pageButtons.forEach((button, i) => {
          button.classList.toggle(activeClass, i === active);
          if (i === active) button.setAttribute("aria-current", "page");
          else button.removeAttribute("aria-current");
        });
        cards.forEach((card, i) => {
          card.hidden =
            i < active * FAQ_PAGE_SIZE ||
            i >= (active + 1) * FAQ_PAGE_SIZE;
        });
        if (prev) prev.disabled = active === 0;
        if (next) next.disabled = active === totalPages - 1;
        if (shouldScroll) {
          section.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      };
      pageButtons.forEach((button, i) =>
        button.addEventListener("click", () => setPage(i), { signal }),
      );
      prev?.addEventListener("click", () => setPage(active - 1), { signal });
      next?.addEventListener("click", () => setPage(active + 1), { signal });
      setPage(active, false);
    });
  }

  function faqSortOrder(item) {
    const direct = Number(item?.sortOrder);
    if (item?.sortOrder != null && Number.isFinite(direct)) return direct;
    const nested = Number(item?.data?.sort_order);
    return item?.data?.sort_order != null && Number.isFinite(nested)
      ? nested
      : Number.MAX_SAFE_INTEGER;
  }

  function faqCard(template, item, fallback, index) {
    const card = template.cloneNode(true);
    const key = String(item?.key || item?.id || `faq-${index + 1}`);
    const title = $(".BlogCard_ai-blogs__item__title__HICp5", card);
    const description = $(".BlogCard_ai-blogs__item__desc__OS_Ov", card);
    const fallbackTitle = $(
      ".BlogCard_ai-blogs__item__title__HICp5",
      fallback,
    )?.textContent.trim();
    const fallbackDescription = $(
      ".BlogCard_ai-blogs__item__desc__OS_Ov",
      fallback,
    )?.textContent.trim();
    const itemTitle = String(item?.title || "").trim();
    const itemBody = String(item?.body || "").trim();
    card.hidden = false;
    card.id = key;
    card.setAttribute("data-summary-only", "true");
    card.setAttribute("data-target-fragment", key);
    card.href = IS_LEGACY_ROUTER
      ? `#/nav/faq?target=${encodeURIComponent(key)}`
      : `faq.html?target=${encodeURIComponent(key)}`;
    if (title) title.textContent = itemTitle || fallbackTitle || "FAQ";
    if (description) {
      description.textContent =
        itemBody ||
        fallbackDescription ||
        "Bu sualın cavabı daha sonra əlavə ediləcək.";
    }
    return card;
  }

  function faqStateCard(template, titleText, descriptionText) {
    const card = template.cloneNode(true);
    const title = $(".BlogCard_ai-blogs__item__title__HICp5", card);
    const description = $(".BlogCard_ai-blogs__item__desc__OS_Ov", card);
    const button = $("button", card);
    card.hidden = false;
    card.removeAttribute("id");
    card.removeAttribute("href");
    card.removeAttribute("data-summary-only");
    card.removeAttribute("data-target-fragment");
    card.setAttribute("aria-disabled", "true");
    card.setAttribute("tabindex", "-1");
    if (title) title.textContent = titleText;
    if (description) description.textContent = descriptionText;
    if (button) button.disabled = true;
    return card;
  }

  function rebuildFaqPagination(signal, cardCount) {
    const current = $(".Pagination_ai-pagination__mtI7X");
    if (!current) return;
    const pagination = current.cloneNode(true);
    const buttons = $$(".Pagination_ai-pagination__item___y0si", pagination);
    const pageButtons = buttons.filter((button) =>
      /^\d+$/.test(button.textContent.trim()),
    );
    const next = buttons.find((button) => {
      const label = button.getAttribute("aria-label") || "";
      return label.includes("Növbəti") || label.includes("Next");
    });
    const template = pageButtons[0];
    if (!template || !next) return;
    pageButtons.forEach((button) => button.remove());
    const totalPages = Math.max(1, Math.ceil(cardCount / 6));
    Array.from({ length: totalPages }, (_, index) => {
      const button = template.cloneNode(true);
      button.textContent = String(index + 1);
      button.classList.toggle("Pagination_active__qQWfE", index === 0);
      if (index === 0) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
      next.before(button);
    });
    current.replaceWith(pagination);
    initPagination(signal);
  }

  async function initFaqPage(signal) {
    const grid = $(".Blogs_ai-blogs__RyLaX");
    if (!grid) return;
    const currentCards = $$(".BlogCard_ai-blogs__item__4ILGi", grid);
    const template = currentCards[0];
    if (!template) return;
    const fallbackCards = currentCards.map((card) => card.cloneNode(true));
    grid.setAttribute("aria-busy", "true");
    grid.dataset.faqSource = "loading";

    try {
      const content = await apiFetch("/api/v1/content/cms-content", {
        signal,
      });
      if (!Array.isArray(content))
        throw new ApiError(0, "FAQ məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const items = content
        .filter(
          (item) =>
            String(item?.type || "").toUpperCase() === "FAQ" &&
            item?.published === true,
        )
        .sort(
          (left, right) =>
            faqSortOrder(left) - faqSortOrder(right) ||
            String(left?.key || "").localeCompare(String(right?.key || "")),
        );
      if (!items.length) {
        grid.replaceChildren(
          faqStateCard(
            template,
            "FAQ tapılmadı",
            "Hazırda dərc olunmuş sual-cavab mövcud deyil.",
          ),
        );
        grid.dataset.faqSource = "api-empty";
        rebuildFaqPagination(signal, 1);
        return;
      }
      grid.replaceChildren(
        ...items.map((item, index) =>
          faqCard(
            template,
            item,
            fallbackCards[index % fallbackCards.length],
            index,
          ),
        ),
      );
      grid.dataset.faqSource = "api";
      applyDataImageFallbacks(grid);
      rebuildFaqPagination(signal, items.length);
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      grid.replaceChildren(...fallbackCards);
      grid.dataset.faqSource = "fallback";
      rebuildFaqPagination(signal, fallbackCards.length);
    } finally {
      if (!signal.aborted) grid.removeAttribute("aria-busy");
    }
  }

  function academyMetric(value, suffix = "") {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return suffix && !text.endsWith(suffix) ? `${text}${suffix}` : text;
  }

  function setAcademyInstructorCount(root, value) {
    const heading = $(".section--work .section__header__title", root);
    const count = academyMetric(value, "+");
    if (!heading || !count) return;
    const leadingText = Array.from(heading.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
    );
    if (leadingText) leadingText.textContent = `\n         ${count}\n         `;
  }

  function setAcademyHeroImage(root, value) {
    const image = $(
      ".WhoWeAreSection_ai-who-we-are__media__image__cNM9o img",
      root,
    );
    const source = safeCourseDetailUrl(value);
    if (!image || !source) return;
    const fallback = image.currentSrc || image.getAttribute("src") || "";
    image.addEventListener(
      "error",
      () => {
        if (fallback) image.src = fallback;
      },
      { once: true },
    );
    image.src = source;
  }

  function applyAcademyContent(root, page) {
    const title = String(page?.title || "").trim();
    const body = String(page?.body || "").trim();
    const data =
      page?.data && typeof page.data === "object" ? page.data : {};
    const stats =
      data.stats && typeof data.stats === "object" ? data.stats : {};
    const breadcrumb = $(".NavigateSection_current__x72AF", root);
    const info = $(".WhoWeAreSection_ai-who-we-are__info__XGRRl p", root);
    const infoTitle = info ? $("strong", info) : null;
    const statItems = $$(
      ".WhoWeAreSection_ai-who-we-are__stats__item__W5tzn",
      root,
    );
    const statValues = [
      {
        count: academyMetric(stats.graduates, "+"),
        label: "Məzunlar",
      },
      {
        count: academyMetric(stats.employmentRate, "%"),
        label: "İlk 6 ayda işlə təminat",
      },
    ];

    if (breadcrumb && title) breadcrumb.textContent = title;
    if (info && body) {
      if (infoTitle && title) infoTitle.textContent = title;
      Array.from(info.childNodes)
        .filter((node) => node !== infoTitle)
        .forEach((node) => node.remove());
      info.append(document.createTextNode(` ${body}`));
    }
    statItems.forEach((item, index) => {
      const metric = statValues[index];
      if (!metric?.count) return;
      const count = $(
        ".WhoWeAreSection_ai-who-we-are__stats__item__count__j8gSP",
        item,
      );
      const label = $(
        ".WhoWeAreSection_ai-who-we-are__stats__item__title__3BeOo",
        item,
      );
      if (count) count.textContent = metric.count;
      if (label) label.textContent = metric.label;
    });
    setAcademyInstructorCount(root, stats.instructors);
    setAcademyHeroImage(root, data.heroImage);
    if (title) document.title = `${title} | Nexora Academy`;
  }

  async function initAcademyPage(signal) {
    const root = $(".main--about");
    if (!root) return;
    root.setAttribute("aria-busy", "true");
    root.dataset.academySource = "loading";
    try {
      const content = await apiFetch("/api/v1/content/cms-content", {
        signal,
      });
      if (!Array.isArray(content))
        throw new ApiError(0, "Academy məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const page = content.find(
        (item) =>
          String(item?.type || "").toUpperCase() === "PAGE" &&
          item?.key === "page.about" &&
          item?.published === true,
      );
      if (!page) {
        root.dataset.academySource = "fallback";
        return;
      }
      applyAcademyContent(root, page);
      root.dataset.academySource = "api";
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      root.dataset.academySource = "fallback";
    } finally {
      if (!signal.aborted) root.removeAttribute("aria-busy");
    }
  }

  function scholarshipAvailable(item, now = Date.now()) {
    return Boolean(
      item?.active === true &&
        publicDateAllows(item.validFrom, "from", now) &&
        publicDateAllows(item.validUntil, "until", now),
    );
  }

  function scholarshipNumber(value, suffix = "") {
    if (value == null || value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    const formatted = new Intl.NumberFormat("az-AZ", {
      maximumFractionDigits: 2,
    }).format(number);
    return `${formatted}${suffix}`;
  }

  function scholarshipCard(template, item, fallback, index) {
    const card = template.cloneNode(true);
    const title = $(".Vacancies_ai-vacancies__item__title__n3bnL", card);
    const description = $(
      ".Vacancies_ai-vacancies__item__desc__A0Adm",
      card,
    );
    const fallbackTitle = $(
      ".Vacancies_ai-vacancies__item__title__n3bnL",
      fallback,
    )?.textContent.trim();
    const fallbackDescription = $(
      ".Vacancies_ai-vacancies__item__desc__A0Adm",
      fallback,
    )?.textContent.trim();
    const name = String(item?.name || "").trim();
    const body = String(item?.description || "").trim();
    const details = [];
    const discount = scholarshipNumber(item?.discountPct, "%");
    const recipients = scholarshipNumber(item?.maxRecipients);
    const validFrom = item?.validFrom ? formatDate(item.validFrom) : "";
    const validUntil = item?.validUntil ? formatDate(item.validUntil) : "";
    if (discount) details.push(`${discount} dəstək`);
    if (recipients) details.push(`${recipients} yer`);
    if (validFrom && validUntil) details.push(`${validFrom} – ${validUntil}`);
    else if (validUntil) details.push(`${validUntil} tarixinədək`);
    else if (validFrom) details.push(`${validFrom} tarixindən`);
    const key = `scholarship-${String(item?.id ?? index + 1)}`;

    card.hidden = false;
    card.id = key;
    card.dataset.scholarshipAvailable = String(scholarshipAvailable(item));
    card.setAttribute("data-summary-only", "true");
    card.setAttribute("data-target-fragment", key);
    card.href = `scholarships.html?target=${encodeURIComponent(key)}`;
    if (title) title.textContent = name || fallbackTitle || "Təqaüd";
    if (description) {
      const base = body || fallbackDescription || "Təqaüd məlumatı.";
      description.textContent = details.length
        ? `${base} ${details.join(" · ")}`
        : base;
    }
    return card;
  }

  function scholarshipStateCard(template) {
    const card = template.cloneNode(true);
    const title = $(".Vacancies_ai-vacancies__item__title__n3bnL", card);
    const description = $(
      ".Vacancies_ai-vacancies__item__desc__A0Adm",
      card,
    );
    const button = $("button", card);
    card.hidden = false;
    card.removeAttribute("id");
    card.removeAttribute("href");
    card.removeAttribute("data-summary-only");
    card.removeAttribute("data-target-fragment");
    card.dataset.scholarshipAvailable = "true";
    card.setAttribute("aria-disabled", "true");
    card.setAttribute("tabindex", "-1");
    if (title) title.textContent = "Təqaüd tapılmadı";
    if (description) {
      description.textContent =
        "Hazırda göstərilə bilən təqaüd proqramı mövcud deyil.";
    }
    if (button) button.disabled = true;
    return card;
  }

  function refreshScholarshipFilters(signal) {
    const current = $(".Vacancies_section__search__FSfJg");
    if (!current) return;
    const replacement = current.cloneNode(true);
    current.replaceWith(replacement);
    initVacancies(signal);
  }

  async function initScholarshipsPage(signal) {
    const grid = $(".Vacancies_ai-vacancies__qEBqV");
    if (!grid) return;
    const currentCards = $$(".Vacancies_ai-vacancies__item__MWNY2", grid);
    const template = currentCards[0];
    if (!template) return;
    const fallbackCards = currentCards.map((card) => card.cloneNode(true));
    grid.setAttribute("aria-busy", "true");
    grid.dataset.scholarshipsSource = "loading";
    try {
      const scholarships = await apiFetch("/api/v1/scholarships", { signal });
      if (!Array.isArray(scholarships))
        throw new ApiError(0, "Təqaüd məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const items = [...scholarships].sort(
        (left, right) =>
          Number(left?.id ?? Number.MAX_SAFE_INTEGER) -
            Number(right?.id ?? Number.MAX_SAFE_INTEGER) ||
          String(left?.name || "").localeCompare(
            String(right?.name || ""),
            "az",
          ),
      );
      if (!items.length) {
        grid.replaceChildren(scholarshipStateCard(template));
        grid.dataset.scholarshipsSource = "api-empty";
        refreshScholarshipFilters(signal);
        return;
      }
      grid.replaceChildren(
        ...items.map((item, index) =>
          scholarshipCard(
            template,
            item,
            fallbackCards[index % fallbackCards.length],
            index,
          ),
        ),
      );
      grid.dataset.scholarshipsSource = "api";
      refreshScholarshipFilters(signal);
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      grid.replaceChildren(...fallbackCards);
      grid.dataset.scholarshipsSource = "fallback";
      refreshScholarshipFilters(signal);
    } finally {
      if (!signal.aborted) grid.removeAttribute("aria-busy");
    }
  }

  function applyHomeBanner(root, banner) {
    const title = $(".HeroSection_content__title__Wr5gI", root);
    const titleParts = title ? $$(":scope > span", title) : [];
    const video = $(".HeroSection_video__GVdk5", root);
    const bannerTitle = String(banner?.title || "").trim();
    const data =
      banner?.data &&
      typeof banner.data === "object" &&
      !Array.isArray(banner.data)
        ? banner.data
        : {};
    const image = safeCourseDetailUrl(data.image, "");

    if (bannerTitle && titleParts.length === 2) {
      titleParts[1].textContent = bannerTitle;
    }
    if (image && video) video.poster = image;
  }

  async function initHomeBanner(signal) {
    const root = $(".HeroSection_heroSection__FTiId");
    const announceReady = () => {
      if (!signal.aborted)
        document.dispatchEvent(new Event("nexora:home-banner-ready"));
    };
    if (!root) {
      announceReady();
      return;
    }

    root.setAttribute("aria-busy", "true");
    root.dataset.bannerSource = "loading";
    try {
      const content = await apiFetch("/api/v1/content/cms-content", { signal });
      if (!Array.isArray(content))
        throw new ApiError(0, "Banner məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;

      const banner = content.find(
        (item) =>
          String(item?.type || "").toUpperCase() === "BANNER" &&
          item?.key === "banner.home-hero" &&
          item?.published === true,
      );
      if (!banner) {
        root.dataset.bannerSource = "fallback";
        return;
      }

      applyHomeBanner(root, banner);
      root.dataset.bannerSource = "api";
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      root.dataset.bannerSource = "fallback";
    } finally {
      if (!signal.aborted) {
        root.removeAttribute("aria-busy");
        announceReady();
      }
    }
  }

  function applyContactContent(root, page) {
    const title = $(
      ".InfoSection_ai-contact__content__info__title__zykdV",
      root,
    );
    const items = $$(
      ".InfoSection_ai-contact__content__info__contact__item__pX_uX",
      root,
    );
    const data =
      page?.data && typeof page.data === "object" && !Array.isArray(page.data)
        ? page.data
        : {};
    const values = [data.phone, data.email, data.address];

    if (title && String(page?.title || "").trim())
      title.textContent = String(page.title).trim();
    values.forEach((value, index) => {
      const text = String(value || "").trim();
      const node = items[index]
        ? $(":scope > span:last-child", items[index])
        : null;
      if (node && text) node.textContent = text;
    });
  }

  async function initContactPage(signal) {
    const root = $(".ContactContainer_ai-contact__Fur87");
    if (!root) return;
    root.setAttribute("aria-busy", "true");
    root.dataset.contactSource = "loading";
    try {
      const content = await apiFetch("/api/v1/content/cms-content", { signal });
      if (!Array.isArray(content))
        throw new ApiError(0, "Əlaqə məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const page = content.find(
        (item) =>
          String(item?.type || "").toUpperCase() === "PAGE" &&
          item?.key === "page.contact" &&
          item?.published === true,
      );
      if (!page) {
        root.dataset.contactSource = "fallback";
        return;
      }
      applyContactContent(root, page);
      root.dataset.contactSource = "api";
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      root.dataset.contactSource = "fallback";
    } finally {
      if (!signal.aborted) root.removeAttribute("aria-busy");
    }
  }

  function initPhoneInputs(signal) {
    $$('input[name="phone"]').forEach((input) => {
      input.setAttribute("inputmode", "tel");
      input.setAttribute("autocomplete", "tel");
      input.addEventListener(
        "input",
        () => {
          input.value = input.value.replace(/[^0-9+()\-\s]/g, "").slice(0, 20);
        },
        { signal },
      );
    });
  }

  function publicCategoryState(categories) {
    const byId = new Map();
    (Array.isArray(categories) ? categories : []).forEach((category) => {
      if (category?.id != null) byId.set(String(category.id), category);
    });
    const memo = new Map();
    const visiting = new Set();
    const isPublic = (id) => {
      const key = String(id);
      if (memo.has(key)) return memo.get(key);
      if (visiting.has(key)) {
        memo.set(key, false);
        return false;
      }
      const category = byId.get(key);
      if (!category || category.active !== true) {
        memo.set(key, false);
        return false;
      }
      visiting.add(key);
      const parentId = category.parentId;
      const valid =
        parentId == null || parentId === ""
          ? true
          : byId.has(String(parentId)) && isPublic(parentId);
      visiting.delete(key);
      memo.set(key, valid);
      return valid;
    };
    const visible = [...byId.values()]
      .filter((category) => isPublic(category.id))
      .sort(
        (a, b) =>
          (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
          String(a.name || a.slug || "").localeCompare(
            String(b.name || b.slug || ""),
            "az",
          ),
      );
    return {
      byId,
      visible,
      visibleIds: new Set(visible.map((category) => String(category.id))),
    };
  }

  function publicDateAllows(value, boundary, now = Date.now()) {
    if (value == null || value === "") return true;
    const raw = String(value);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const timestamp = Date.parse(
      dateOnly
        ? `${raw}${boundary === "until" ? "T23:59:59.999" : "T00:00:00"}`
        : raw,
    );
    if (!Number.isFinite(timestamp)) return false;
    return boundary === "until" ? timestamp >= now : timestamp <= now;
  }

  function isPublicCourse(course, visibleCategoryIds, now = Date.now()) {
    return Boolean(
      course &&
        course.published === true &&
        course.active === true &&
        course.archived === false &&
        visibleCategoryIds.has(String(course.categoryId)) &&
        publicDateAllows(course.validFrom, "from", now) &&
        publicDateAllows(course.validUntil, "until", now),
    );
  }

  function courseViewModel(course) {
    const content =
      course?.content &&
      typeof course.content === "object" &&
      !Array.isArray(course.content)
        ? course.content
        : {};
    return { ...content, ...(course || {}) };
  }

  function renderCourseCard(course, categoryNames) {
    course = courseViewModel(course);
    const category = categoryNames.get(String(course.categoryId)) || "Kurs";
    const description =
      course.shortDescription ||
      course.targetAudience ||
      "Ətraflı məlumat üçün kurs səhifəsinə keçin.";
    const duration = course.durationWeeks
      ? `${escapeHtml(course.durationWeeks)} həftə`
      : "";
    return `<article class="Nexora_courseCard">
      <div class="Nexora_courseCardTop">
        <span class="Nexora_badge">${escapeHtml(category)}</span>
        <span class="Nexora_coursePrice">${escapeHtml(formatPrice(course.basePrice, course.currency))}</span>
      </div>
      <div class="Nexora_courseCardBody">
        <h3>${escapeHtml(course.title || "Adsız kurs")}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="Nexora_courseMeta">
        <span>${escapeHtml(enumLabel(course.difficulty))}</span>
        <span>${escapeHtml(enumLabel(course.deliveryFormat))}</span>
        ${duration ? `<span>${duration}</span>` : ""}
      </div>
      <a class="ai-btn ai-btn--text" href="course-details.html?id=${encodeURIComponent(course.id || "")}">Ətraflı bax</a>
    </article>`;
  }

  function renderCoursesPagination(container, current, hasNext) {
    if (current <= 0 && !hasNext) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      <button type="button" data-course-page="${current - 1}" aria-label="Əvvəlki səhifə" ${current <= 0 ? "disabled" : ""}>‹</button>
      <button type="button" class="Nexora_paginationActive" aria-current="page" disabled>${current + 1}</button>
      <button type="button" data-course-page="${current + 1}" aria-label="Növbəti səhifə" ${hasNext ? "" : "disabled"}>›</button>`;
  }

  function projectCourseStateCard(template, title, description, action = null) {
    const card = template.cloneNode(true);
    card.removeAttribute("id");
    $$('[id]', card).forEach((node) => node.removeAttribute("id"));
    const titleNode = $(".ProjectCard_ai-projects__item__title__mSuta", card);
    const descriptionNode = $(
      ".ProjectCard_ai-projects__item__desc__DQd6_",
      card,
    );
    const link = $(".ProjectCard_ai-projects__item__cta__t2MnB", card);
    const image = $("img", card);
    if (titleNode) titleNode.textContent = title;
    if (descriptionNode) descriptionNode.textContent = description;
    if (link) {
      link.removeAttribute("data-summary-only");
      link.removeAttribute("data-target-fragment");
      if (action) {
        link.href = action.href;
        link.removeAttribute("aria-disabled");
        link.removeAttribute("tabindex");
        const label = $("span", link);
        if (label) label.textContent = action.label;
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        link.setAttribute("tabindex", "-1");
      }
    }
    if (image) {
      const fallback = MOCK_IMAGE_FALLBACKS["course-networking"];
      image.removeAttribute("data-image-src");
      image.removeAttribute("data-image-fallback");
      image.src = fallback.src;
      image.alt = fallback.alt;
    }
    return card;
  }

  function projectCourseCard(template, course, categoryNames) {
    course = courseViewModel(course);
    const card = template.cloneNode(true);
    $$('[id]', card).forEach((node) => node.removeAttribute("id"));
    card.id = String(course.slug || course.id || "");
    const title = $(".ProjectCard_ai-projects__item__title__mSuta", card);
    const description = $(
      ".ProjectCard_ai-projects__item__desc__DQd6_",
      card,
    );
    const link = $(".ProjectCard_ai-projects__item__cta__t2MnB", card);
    const image = $("img", card);
    const categoryName = categoryNames.get(String(course.categoryId)) || "";
    const detailUrl = `course-details.html?id=${encodeURIComponent(course.id || "")}`;
    if (title) title.textContent = course.title || "Adsız kurs";
    if (description) {
      description.textContent =
        course.shortDescription ||
        course.targetAudience ||
        course.fullDescription ||
        "Ətraflı məlumat üçün kurs səhifəsinə keçin.";
    }
    if (link) {
      link.href = detailUrl;
      link.removeAttribute("data-summary-only");
      link.removeAttribute("data-target-fragment");
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
      const label = $("span", link);
      if (label) label.textContent = "Kursa bax";
    }
    card.setAttribute("role", "link");
    card.setAttribute("tabIndex", "0");
    card.style.cursor = "pointer";
    card.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.target.closest("a")) return;
      event.preventDefault();
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        window.open(detailUrl, "_blank", "noopener");
      } else {
        window.location.assign(detailUrl);
      }
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.assign(detailUrl);
    });
    if (image) {
      const fallback = courseMockFallback({ ...course, categoryName });
      image.removeAttribute("data-image-src");
      image.removeAttribute("data-image-fallback");
      image.src = fallback.src;
      image.alt = fallback.alt;
    }
    return card;
  }

  async function loadPublicCourseCatalog(signal) {
    const categories = await apiFetch("/api/v1/categories", { signal });
    if (!Array.isArray(categories))
      throw new ApiError(0, "Kateqoriya məlumatı əlçatan deyil.");
    const categoryState = publicCategoryState(categories);
    const categoryNames = new Map(
      categoryState.visible.map((category) => [
        String(category.id),
        category.name || category.slug || String(category.id),
      ]),
    );
    const baseParams = new URLSearchParams({
      size: "100",
      sort: "title,asc",
      published: "true",
      active: "true",
    });
    const firstParams = new URLSearchParams(baseParams);
    firstParams.set("page", "0");
    const firstPage = await apiFetch(`/api/v1/courses?${firstParams}`, {
      signal,
    });
    const totalPages = Math.min(
      100,
      Math.max(1, Number.parseInt(firstPage?.totalPages, 10) || 1),
    );
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => {
        const params = new URLSearchParams(baseParams);
        params.set("page", String(index + 1));
        return apiFetch(`/api/v1/courses?${params}`, { signal });
      }),
    );
    const courses = [firstPage, ...remainingPages]
      .flatMap((page) => (Array.isArray(page?.content) ? page.content : []))
      .filter((course) =>
        isPublicCourse(course, categoryState.visibleIds),
      );
    return { courses, categoryNames };
  }

  function featuredCourseTimestamp(course) {
    const timestamp = Date.parse(course?.updatedAt || course?.createdAt || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  async function initHomeFeaturedCourses(signal) {
    const container = $(".ProjectsSection_ai-projects__NQP37");
    if (!container) return;
    const template = $(".ProjectCard_ai-projects__item__oGKFx", container);
    if (!template) return;

    container.setAttribute("aria-busy", "true");
    container.replaceChildren(
      projectCourseStateCard(
        template,
        "Kurslar yüklənir…",
        "Seçilmiş kurslar serverdən alınır.",
      ),
    );

    try {
      const { courses, categoryNames } = await loadPublicCourseCatalog(signal);
      if (signal.aborted) return;
      const featuredCourses = [...courses]
        .sort(
          (left, right) =>
            featuredCourseTimestamp(right) - featuredCourseTimestamp(left) ||
            String(left?.title || "").localeCompare(
              String(right?.title || ""),
              "az",
            ),
        )
        .slice(0, 3);
      if (!featuredCourses.length) {
        container.replaceChildren(
          projectCourseStateCard(
            template,
            "Seçilmiş kurs tapılmadı",
            "Hazırda göstərilə bilən aktiv kurs yoxdur.",
            { href: "courses.html", label: "Bütün kurslara bax" },
          ),
        );
        return;
      }
      container.replaceChildren(
        ...featuredCourses.map((course) =>
          projectCourseCard(template, course, categoryNames),
        ),
      );
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      container.replaceChildren(
        projectCourseStateCard(
          template,
          "Kurslar hazırda əlçatan deyil",
          apiErrorMessage(error),
          { href: "courses.html", label: "Bütün kurslara bax" },
        ),
      );
    } finally {
      if (!signal.aborted) container.removeAttribute("aria-busy");
    }
  }

  function initProjectCoursesPage(signal) {
    const container = $(".ProjectsSection_ai-projects__Djj2c");
    if (!container) return;
    const template = $(".ProjectCard_ai-projects__item__oGKFx", container);
    if (!template) return;
    container.setAttribute("aria-busy", "true");
    container.replaceChildren(
      projectCourseStateCard(
        template,
        "Kurslar yüklənir…",
        "Açıq kurslar serverdən alınır.",
      ),
    );
    loadPublicCourseCatalog(signal)
      .then(({ courses, categoryNames }) => {
        if (signal.aborted) return;
        if (!courses.length) {
          container.replaceChildren(
            projectCourseStateCard(
              template,
              "Açıq kurs tapılmadı",
              "Kurs kataloqunda hazırda göstərilə bilən aktiv kurs yoxdur.",
              { href: "categories.html", label: "Kateqoriyalara bax" },
            ),
          );
          return;
        }
        container.replaceChildren(
          ...courses.map((course) =>
            projectCourseCard(template, course, categoryNames),
          ),
        );
      })
      .catch((error) => {
        if (error?.name === "AbortError" || signal.aborted) return;
        container.replaceChildren(
          projectCourseStateCard(
            template,
            "Kurslar hazırda əlçatan deyil",
            apiErrorMessage(error),
            { href: "courses.html", label: "Yenidən yoxla" },
          ),
        );
      })
      .finally(() => {
        if (!signal.aborted) container.removeAttribute("aria-busy");
      });
  }

  function initCoursesPage(signal) {
    const form = $("#courseFilters");
    const grid = $("#coursesGrid");
    const status = $("#coursesStatus");
    const pagination = $("#coursesPagination");
    if (!form || !grid || !status || !pagination) {
      initProjectCoursesPage(signal);
      return;
    }

    const categorySelect = $("#courseCategory", form);
    const categoryNames = new Map();
    let visibleCategoryIds = new Set();
    let categoriesReady = false;
    const initialParams = new URLSearchParams(location.search);
    let currentPage = Math.max(
      0,
      Number.parseInt(initialParams.get("page") || "0", 10) || 0,
    );
    let searchTimer = null;

    const applyUrlState = () => {
      ["q", "categoryId", "difficulty", "deliveryFormat"].forEach((name) => {
        const field = form.elements[name];
        if (field) field.value = initialParams.get(name) || "";
      });
    };

    const syncUrlState = () => {
      const values = new FormData(form);
      const params = new URLSearchParams();
      ["q", "categoryId", "difficulty", "deliveryFormat"].forEach((name) => {
        const value = String(values.get(name) || "").trim();
        if (value) params.set(name, value);
      });
      if (currentPage > 0) params.set("page", String(currentPage));
      history.replaceState(
        null,
        "",
        `${location.pathname}${params.size ? `?${params}` : ""}`,
      );
    };

    const loadCategories = async () => {
      const categories = await apiFetch("/api/v1/categories", { signal });
      if (!Array.isArray(categories) || signal.aborted)
        throw new ApiError(0, "Kateqoriya məlumatı əlçatan deyil.");
      const publicState = publicCategoryState(categories);
      visibleCategoryIds = publicState.visibleIds;
      publicState.visible.forEach((category) => {
        categoryNames.set(
          String(category.id),
          category.name || category.slug || String(category.id),
        );
        const option = document.createElement("option");
        option.value = String(category.id);
        option.textContent =
          category.name || category.slug || String(category.id);
        categorySelect.appendChild(option);
      });
      categoriesReady = true;
      applyUrlState();
    };

    const loadCourses = async (pageNumber = 0) => {
      const requestId = ++coursesRequestId;
      currentPage = Math.max(0, pageNumber);
      syncUrlState();
      status.textContent = "Kurslar yüklənir…";
      status.dataset.state = "loading";
      grid.setAttribute("aria-busy", "true");

      const values = new FormData(form);
      const params = new URLSearchParams({
        page: String(currentPage),
        size: "9",
        sort: "title,asc",
        published: "true",
        active: "true",
      });
      ["q", "categoryId", "difficulty", "deliveryFormat"].forEach((name) => {
        const value = String(values.get(name) || "").trim();
        if (value) params.set(name, value);
      });

      try {
        if (!categoriesReady)
          throw new ApiError(
            0,
            "Kurs görünürlüyünü yoxlamaq üçün kateqoriya məlumatı əlçatan deyil.",
          );
        const page = await apiFetch(`/api/v1/courses?${params}`, { signal });
        if (signal.aborted || requestId !== coursesRequestId) return;
        const rawCourses = Array.isArray(page?.content) ? page.content : [];
        const courses = rawCourses.filter((course) =>
          isPublicCourse(course, visibleCategoryIds),
        );
        grid.innerHTML = courses
          .map((course) => renderCourseCard(course, categoryNames))
          .join("");
        if (!courses.length) {
          grid.innerHTML =
            '<div class="Nexora_emptyState"><h3>Uyğun kurs tapılmadı</h3><p>Filtrləri dəyişərək yenidən yoxlayın.</p></div>';
        }
        status.textContent = courses.length
          ? `Bu səhifədə ${courses.length} açıq kurs göstərilir`
          : "Açıq kurs tapılmadı";
        status.dataset.state = "success";
        renderCoursesPagination(
          pagination,
          currentPage,
          page?.last === false || rawCourses.length >= 9,
        );
      } catch (error) {
        if (error?.name === "AbortError" || requestId !== coursesRequestId)
          return;
        grid.innerHTML = `<div class="Nexora_emptyState"><h3>Kursları göstərmək mümkün olmadı</h3><p>${escapeHtml(apiErrorMessage(error))}</p></div>`;
        status.textContent = "Kurs kataloqu əlçatan deyil";
        status.dataset.state = "error";
        pagination.innerHTML = "";
      } finally {
        if (requestId === coursesRequestId) grid.removeAttribute("aria-busy");
      }
    };

    form.addEventListener(
      "input",
      (event) => {
        if (event.target.name !== "q") return;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadCourses(0), 300);
      },
      { signal },
    );
    form.addEventListener(
      "change",
      (event) => {
        if (event.target.name === "q") return;
        loadCourses(0);
      },
      { signal },
    );
    form.addEventListener(
      "reset",
      () => setTimeout(() => loadCourses(0), 0),
      { signal },
    );
    pagination.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button[data-course-page]");
        if (!button || button.disabled) return;
        const nextPage = Number(button.dataset.coursePage);
        if (!Number.isInteger(nextPage) || nextPage < 0) return;
        loadCourses(nextPage);
        $(".Nexora_catalogSection")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      },
      { signal },
    );
    signal.addEventListener("abort", () => clearTimeout(searchTimer), {
      once: true,
    });

    loadCategories()
      .then(() => loadCourses(currentPage))
      .catch((error) => {
        if (error?.name === "AbortError") return;
        grid.innerHTML = `<div class="Nexora_emptyState"><h3>Kursları göstərmək mümkün olmadı</h3><p>${escapeHtml(apiErrorMessage(error))}</p></div>`;
        status.textContent = "Kurs kataloqu əlçatan deyil";
        status.dataset.state = "error";
        pagination.innerHTML = "";
      });
  }

  function renderCategoryCard(category, categoryState) {
    const parent = categoryState.byId.get(String(category.parentId));
    const parentText = parent
      ? `Üst kateqoriya: ${parent.name || parent.slug || parent.id}`
      : "Əsas kateqoriya";
    return `<article class="Nexora_courseCard">
      <div class="Nexora_courseCardBody">
        <h3>${escapeHtml(category.name || category.slug || "Kateqoriya")}</h3>
        <p>${escapeHtml(parentText)}</p>
      </div>
      <a class="ai-btn ai-btn--text" href="category.html?id=${encodeURIComponent(category.id)}">Kateqoriyaya bax</a>
    </article>`;
  }

  async function initCategoriesPage(signal) {
    const grid = $("#categoriesGrid");
    const status = $("#categoriesStatus");
    if (!grid || !status) return;
    try {
      const categories = await apiFetch("/api/v1/categories", { signal });
      if (signal.aborted) return;
      const categoryState = publicCategoryState(categories);
      grid.innerHTML = categoryState.visible.length
        ? categoryState.visible
            .map((category) => renderCategoryCard(category, categoryState))
            .join("")
        : '<div class="Nexora_emptyState"><h3>Açıq kateqoriya yoxdur</h3><p>Kataloqu bir az sonra yenidən yoxlayın.</p></div>';
      status.textContent = `${categoryState.visible.length} açıq kateqoriya`;
      status.dataset.state = "success";
    } catch (error) {
      if (error?.name === "AbortError") return;
      grid.innerHTML =
        '<div class="Nexora_emptyState"><h3>Kateqoriyalar əlçatan deyil</h3><p>Məlumatları hazırda yükləmək mümkün olmadı.</p></div>';
      status.textContent = apiErrorMessage(error);
      status.dataset.state = "error";
    }
  }

  async function initCategoryPage(signal) {
    const details = $("#categoryDetails");
    const childrenContainer = $("#categoryChildren");
    const childrenStatus = $("#categoryChildrenStatus");
    const coursesContainer = $("#categoryCourses");
    const coursesStatus = $("#categoryCoursesStatus");
    if (
      !details ||
      !childrenContainer ||
      !childrenStatus ||
      !coursesContainer ||
      !coursesStatus
    )
      return;
    const categoryId =
      new URLSearchParams(location.search).get("id")?.trim() || "";
    if (!/^\d+$/.test(categoryId)) {
      details.innerHTML =
        '<div class="Nexora_emptyState"><h1>Kateqoriya seçilməyib</h1><p>Kateqoriya kataloqundan seçim edin.</p></div>';
      return;
    }
    try {
      const [category, categories] = await Promise.all([
        apiFetch(`/api/v1/categories/${encodeURIComponent(categoryId)}`, {
          signal,
        }),
        apiFetch("/api/v1/categories", { signal }),
      ]);
      if (signal.aborted) return;
      const categoryState = publicCategoryState(categories);
      if (
        !category ||
        String(category.id) !== categoryId ||
        !categoryState.visibleIds.has(categoryId)
      )
        throw new ApiError(404, "Kateqoriya əlçatan deyil.");
      const name = category.name || category.slug || "Kateqoriya";
      const parent = categoryState.byId.get(String(category.parentId));
      details.innerHTML = `<div class="section__header__content">
        <p class="Nexora_eyebrow">${escapeHtml(parent?.name || "Kurs kataloqu")}</p>
        <h1 class="Nexora_pageTitle">${escapeHtml(name)}</h1>
        <p class="Nexora_pageLead">Bu kateqoriyaya aid açıq kurslar və aktiv alt kateqoriyalar.</p>
      </div>`;
      document.title = `${name} | Nexora Academy`;
      const children = categoryState.visible.filter(
        (item) => String(item.parentId) === categoryId,
      );
      childrenContainer.innerHTML = children
        .map((item) => renderCategoryCard(item, categoryState))
        .join("");
      childrenStatus.textContent = children.length
        ? `${children.length} alt kateqoriya`
        : "Aktiv alt kateqoriya yoxdur";

      const params = new URLSearchParams({
        page: "0",
        size: "24",
        sort: "title,asc",
        categoryId,
        published: "true",
        active: "true",
      });
      const page = await apiFetch(`/api/v1/courses?${params}`, { signal });
      if (signal.aborted) return;
      const categoryNames = new Map(
        categoryState.visible.map((item) => [
          String(item.id),
          item.name || item.slug || String(item.id),
        ]),
      );
      const courses = (Array.isArray(page?.content) ? page.content : []).filter(
        (course) =>
          String(course.categoryId) === categoryId &&
          isPublicCourse(course, categoryState.visibleIds),
      );
      coursesContainer.innerHTML = courses.length
        ? courses
            .map((course) => renderCourseCard(course, categoryNames))
            .join("")
        : '<div class="Nexora_emptyState"><h3>Açıq kurs tapılmadı</h3><p>Bu kateqoriyada hazırda açıq kurs yoxdur.</p></div>';
      coursesStatus.textContent = `${courses.length} açıq kurs`;
    } catch (error) {
      if (error?.name === "AbortError") return;
      details.innerHTML =
        '<div class="Nexora_emptyState"><h1>Kateqoriya hazırda əlçatan deyil</h1><p>Kateqoriya kataloquna qayıdaraq yenidən seçim edin.</p></div>';
      childrenContainer.innerHTML = "";
      coursesContainer.innerHTML = "";
      childrenStatus.textContent = "";
      coursesStatus.textContent = "";
    }
  }

  function safeCourseDetailUrl(value, fallback = "") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("//"))
      return raw;
    try {
      const parsed = new URL(raw, location.href);
      return ["http:", "https:"].includes(parsed.protocol) ? raw : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function courseDetailTextList(value) {
    return (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  function renderCourseModules(modules) {
    const items = (Array.isArray(modules) ? modules : [])
      .map((module, index) => {
        const objectModule =
          module && typeof module === "object" && !Array.isArray(module)
            ? module
            : null;
        const title = String(
          objectModule ? objectModule.title || "" : module || "",
        ).trim();
        const topics = courseDetailTextList(objectModule?.topics);
        if (!title && !topics.length) return "";
        return `<article class="Nexora_courseDetailV2__module">
          <span class="Nexora_courseDetailV2__moduleIndex">${String(index + 1).padStart(2, "0")}</span>
          <div>
            ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
            ${
              topics.length
                ? `<ul>${topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")}</ul>`
                : ""
            }
          </div>
        </article>`;
      })
      .filter(Boolean);
    return items.length
      ? `<section class="Nexora_courseDetailV2__contentSection">
          <div class="Nexora_courseDetailV2__sectionHeading">
            <p class="Nexora_eyebrow">Tədris planı</p>
            <h2>Kurs proqramı</h2>
          </div>
          <div class="Nexora_courseDetailV2__modules">${items.join("")}</div>
        </section>`
      : "";
  }

  function renderCourseRequirements(requirements) {
    const items = courseDetailTextList(requirements);
    return items.length
      ? `<section class="Nexora_courseDetailV2__contentSection">
          <div class="Nexora_courseDetailV2__sectionHeading">
            <p class="Nexora_eyebrow">Başlamazdan əvvəl</p>
            <h2>Tələblər</h2>
          </div>
          <ul class="Nexora_courseDetailV2__checkList">
            ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </section>`
      : "";
  }

  function courseMockFallback(course) {
    const context = `${course.title || ""} ${course.categoryName || ""}`.toLocaleLowerCase(
      "az",
    );
    if (/cloud|bulud|devops/.test(context))
      return MOCK_IMAGE_FALLBACKS["course-cloud-devops"];
    if (/cyber|kiber|security|təhlükəsizlik/.test(context))
      return MOCK_IMAGE_FALLBACKS["course-cybersecurity"];
    return MOCK_IMAGE_FALLBACKS["course-networking"];
  }

  function renderCourseInstructor(instructor) {
    if (!instructor || typeof instructor !== "object") return "";
    const name = String(instructor.name || "").trim();
    if (!name) return "";
    const title = String(instructor.title || "").trim();
    const fallbackIndex = (name.codePointAt(0) || 0) % 3;
    const fallback =
      MOCK_IMAGE_FALLBACKS[`instructor-${fallbackIndex + 1}`];
    const realImageUrl = safeCourseDetailUrl(instructor.imageUrl);
    const imageUrl = realImageUrl || fallback.src;
    const imageAlt = realImageUrl
      ? instructor.imageAlt || name
      : fallback.alt;
    return `<section class="Nexora_courseDetailV2__contentSection">
      <div class="Nexora_courseDetailV2__sectionHeading">
        <p class="Nexora_eyebrow">Təlimçi</p>
        <h2>Müəllim haqqında</h2>
      </div>
      <div class="Nexora_courseDetailV2__instructor">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy" />
        <div>
          <h3>${escapeHtml(name)}</h3>
          ${title ? `<p>${escapeHtml(title)}</p>` : ""}
        </div>
      </div>
    </section>`;
  }

  function renderCourseDetails(course, options = {}) {
    course = courseViewModel(course);
    const title = course.title || "Kurs";
    const description =
      course.fullDescription ||
      course.description ||
      course.shortDescription ||
      "Bu kurs haqqında ətraflı məlumat hazırlanır.";
    const shortDescription =
      course.shortDescription || course.description || course.fullDescription || "";
    const deliveryFormat = enumLabel(course.deliveryFormat);
    const duration = course.durationWeeks
      ? `${course.durationWeeks} həftə`
      : "";
    const difficulty = enumLabel(course.difficulty);
    const courseFallback = courseMockFallback(course);
    const realImageUrl = safeCourseDetailUrl(course.imageUrl);
    const imageUrl = realImageUrl || courseFallback.src;
    const imageAlt = realImageUrl
      ? course.imageAlt || `${title} kursunun əsas vizualı`
      : courseFallback.alt;
    const categoryName = options.categoryName || "Nexora Academy";
    const metaItems = [difficulty, deliveryFormat, duration].filter(Boolean);
    const courseId = String(course.id || "").trim();
    const explicitRegistrationUrl = safeCourseDetailUrl(course.registrationUrl);
    const role = userRole();
    const enrollmentTarget = courseId
      ? `enrollments.html?courseId=${encodeURIComponent(courseId)}`
      : "";
    const accountLink = explicitRegistrationUrl
      ? explicitRegistrationUrl
      : courseId
        ? accessToken
          ? role === "STUDENT"
            ? enrollmentTarget
            : roleDestination(role)
          : loginUrl(enrollmentTarget)
        : "contact.html";
    const accountLabel = explicitRegistrationUrl
      ? "Qeydiyyatdan keç"
      : courseId
        ? accessToken
          ? role === "STUDENT"
            ? "Qeydiyyatlarım"
            : "Panelə keç"
          : "Daxil ol və qeydiyyatdan keç"
        : "Qeydiyyat barədə məlumat al";
    const requirements = renderCourseRequirements(course.requirements);
    const modules = renderCourseModules(course.modules);
    const instructor = renderCourseInstructor(course.instructor);
    const certificateText = String(course.certificateText || "").trim();
    const relatedIds = Array.isArray(course.relatedCourseIds)
      ? course.relatedCourseIds.filter(
          (id) => id && String(id) !== String(course.id || ""),
        )
      : [];
    const detailRows = [
      ["Tədris formatı", deliveryFormat || "Məlumat dəqiqləşdirilir"],
      ["Müddət", duration || "Məlumat dəqiqləşdirilir"],
      ...(difficulty ? [["Səviyyə", difficulty]] : []),
      ...(course.locationText ? [["Məkan", course.locationText]] : []),
      ...(course.pricePeriod ? [["Ödəniş dövrü", course.pricePeriod]] : []),
    ];

    return `<div class="Nexora_courseDetailV2">
      <section class="Nexora_courseDetailV2__hero">
        <div class="Nexora_courseDetailV2__heroCopy">
          <p class="Nexora_eyebrow">${escapeHtml(categoryName)}</p>
          ${
            metaItems.length
              ? `<div class="Nexora_courseMeta">${metaItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
              : ""
          }
          <h1 class="Nexora_pageTitle">${escapeHtml(title)}</h1>
          ${shortDescription ? `<p class="Nexora_pageLead">${escapeHtml(shortDescription)}</p>` : ""}
        </div>
        <figure class="Nexora_courseDetailV2__visual">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" />
        </figure>
      </section>

      <div class="Nexora_courseDetailV2__contentLayout">
        <div class="Nexora_courseDetailV2__contentMain">
          <section class="Nexora_courseDetailV2__contentSection">
            <div class="Nexora_courseDetailV2__sectionHeading">
              <p class="Nexora_eyebrow">Ətraflı məlumat</p>
              <h2>Kurs haqqında</h2>
            </div>
            <div class="Nexora_courseDetailV2__richText"><p>${escapeHtml(description)}</p></div>
          </section>

          ${
            course.targetAudience
              ? `<section class="Nexora_courseDetailV2__contentSection">
                  <div class="Nexora_courseDetailV2__sectionHeading">
                    <p class="Nexora_eyebrow">Uyğunluq</p>
                    <h2>Kimlər üçün nəzərdə tutulub?</h2>
                  </div>
                  <p class="Nexora_courseDetailV2__bodyText">${escapeHtml(course.targetAudience)}</p>
                </section>`
              : ""
          }
          ${modules}
          ${requirements}
          ${
            certificateText
              ? `<section class="Nexora_courseDetailV2__contentSection">
                  <div class="Nexora_courseDetailV2__sectionHeading">
                    <p class="Nexora_eyebrow">Nəticə</p>
                    <h2>Sertifikat</h2>
                  </div>
                  <p class="Nexora_courseDetailV2__bodyText">${escapeHtml(certificateText)}</p>
                </section>`
              : ""
          }
          ${instructor}
        </div>

        <aside class="Nexora_panel Nexora_courseAside Nexora_courseDetailV2__aside">
          <div>
            <p class="Nexora_eyebrow">Kursun qiyməti</p>
            <strong class="Nexora_detailPrice">${escapeHtml(formatPrice(course.basePrice, course.currency))}</strong>
          </div>
          <dl class="Nexora_detailList">
            ${detailRows
              .map(
                ([label, value]) =>
                  `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
              )
              .join("")}
          </dl>
          <a class="ai-btn ai-btn--gradient Nexora_courseDetailV2__cta" href="${escapeHtml(accountLink)}">${escapeHtml(accountLabel)}</a>
          <p class="Nexora_muted">Qrup tarixləri, mövcud yerlər və yekun qeydiyyat məlumatları təsdiqləndikdə təqdim ediləcək.</p>
        </aside>
      </div>

      ${
        relatedIds.length
          ? `<section class="Nexora_courseDetailV2__related">
              <div class="Nexora_courseDetailV2__sectionHeading">
                <p class="Nexora_eyebrow">Davam et</p>
                <h2>Əlaqəli kurslar</h2>
              </div>
              <p class="Nexora_status" id="relatedCoursesStatus">Əlaqəli kurslar yüklənir…</p>
              <div class="Nexora_courseGrid" id="relatedCourses"></div>
            </section>`
          : ""
      }
    </div>`;
  }

  function initCourseDetailsPage(signal) {
    const container = $("#courseDetails");
    if (!container) return;

    const params = new URLSearchParams(location.search);
    const courseSlug = params.get("course")?.trim() || "";

    const reviewsContainer = $("#courseReviews");
    const reviewsStatus = $("#reviewsStatus");
    const reviewForm = $("#reviewForm");
    const reviewAccess = $("#reviewAccess");
    const loginLink = $("#reviewLoginLink");
    let relatedContainer = null;
    let relatedStatus = null;

    const courseId = params.get("id")?.trim() || "";
    if (!courseId && !courseSlug) {
      container.innerHTML =
        '<div class="Nexora_emptyState"><h1>Kurs seçilməyib</h1><p>Kataloqdan kurs seçərək yenidən yoxlayın.</p></div>';
      if (reviewsStatus) reviewsStatus.textContent = "";
      return;
    }

    if (loginLink) loginLink.href = loginUrl(currentReturnTarget());
    if (reviewForm) reviewForm.hidden = true;
    if (reviewAccess) reviewAccess.hidden = false;
    if (loginLink) loginLink.hidden = true;
    const accessMessage = reviewAccess ? $("p", reviewAccess) : null;
    if (accessMessage)
      accessMessage.textContent =
        "Dərc olunmuş rəylər və təhlükəsiz rəy uyğunluğu üçün açıq xidmət hələ mövcud deyil.";
    if (reviewsContainer) reviewsContainer.innerHTML = "";
    if (reviewsStatus) {
      reviewsStatus.textContent = "Rəy bölməsi server dəstəyi gözləyir.";
      reviewsStatus.dataset.state = "error";
    }

    const loadCourse = async () => {
      try {
        const courseRequest = courseId
          ? apiFetch(`/api/v1/courses/${encodeURIComponent(courseId)}`, {
              signal,
            })
          : apiFetch(
              `/api/v1/courses?${new URLSearchParams({
                q: courseSlug,
                page: "0",
                size: "20",
                published: "true",
                active: "true",
              })}`,
              { signal },
            ).then((page) => {
              const course = (Array.isArray(page?.content) ? page.content : [])
                .find((item) => String(item?.slug || "") === courseSlug);
              if (!course) throw new ApiError(404, "Kurs tapılmadı.");
              return course;
            });
        const [course, categories] = await Promise.all([
          courseRequest,
          apiFetch("/api/v1/categories", { signal }),
        ]);
        if (signal.aborted) return;
        const categoryState = publicCategoryState(categories);
        if (!isPublicCourse(course, categoryState.visibleIds))
          throw new ApiError(404, "Kurs hazırda əlçatan deyil.");
        const category = categoryState.byId.get(String(course.categoryId));
        container.innerHTML = renderCourseDetails(course || {}, {
          categoryName:
            category?.name || category?.slug || "Nexora Academy",
        });
        relatedContainer = $("#relatedCourses", container);
        relatedStatus = $("#relatedCoursesStatus", container);
        if (course?.title) document.title = `${course.title} | Nexora Academy`;
        const relatedIds = [
          ...new Set(
            (Array.isArray(course.relatedCourseIds)
              ? course.relatedCourseIds
              : []
            )
              .map(String)
              .filter((id) => id && id !== String(course.id)),
          ),
        ].slice(0, 3);
        if (!relatedContainer || !relatedStatus) return;
        if (!relatedIds.length) {
          relatedStatus.textContent = "Əlaqəli açıq kurs tapılmadı.";
          relatedContainer.innerHTML = "";
          return;
        }
        relatedStatus.textContent = "Əlaqəli kurslar yüklənir…";
        const relatedResults = await Promise.allSettled(
          relatedIds.map((id) =>
            apiFetch(`/api/v1/courses/${encodeURIComponent(id)}`, { signal }),
          ),
        );
        if (signal.aborted) return;
        const relatedCourses = relatedResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((item) => isPublicCourse(item, categoryState.visibleIds));
        const categoryNames = new Map(
          categoryState.visible.map((category) => [
            String(category.id),
            category.name || category.slug || String(category.id),
          ]),
        );
        relatedContainer.innerHTML = relatedCourses
          .map((item) => renderCourseCard(item, categoryNames))
          .join("");
        relatedStatus.textContent = relatedCourses.length
          ? `${relatedCourses.length} əlaqəli açıq kurs`
          : "Əlaqəli açıq kurs tapılmadı.";
      } catch (error) {
        if (error?.name === "AbortError") return;
        container.innerHTML =
          '<div class="Nexora_emptyState"><h1>Kurs hazırda əlçatan deyil</h1><p>Kataloqa qayıdaraq digər açıq kurslara baxın.</p></div>';
        if (relatedContainer) relatedContainer.innerHTML = "";
        if (relatedStatus) relatedStatus.textContent = "";
      }
    };

    void loadCourse();
  }

  function initLoginPage(signal) {
    const loginForm = $("#loginForm");
    const otpForm = $("#loginOtpForm");
    const otpHint = $("#loginOtpHint");
    const otpBack = $("#loginOtpBack");
    if (!loginForm || !otpForm) return;

    let pendingEmail = "";
    const showLogin = () => {
      loginForm.hidden = false;
      otpForm.hidden = true;
      setFormMessage(otpForm, "");
    };
    const showOtp = (email, expiresInSeconds) => {
      pendingEmail = email;
      loginForm.hidden = true;
      otpForm.hidden = false;
      if (otpHint) {
        const minutes = Math.max(
          1,
          Math.ceil((Number(expiresInSeconds) || 600) / 60),
        );
        otpHint.textContent = `${email} ünvanına göndərilən 6 rəqəmli kodu daxil edin. Kod təxminən ${minutes} dəqiqə etibarlıdır.`;
      }
      $("#loginOtp")?.focus();
    };

    loginForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(loginForm);
        const email = loginForm.elements.email.value.trim();
        const password = loginForm.elements.password.value;
        if (!validEmail(email)) markFormField(loginForm.elements.email);
        if (!password) markFormField(loginForm.elements.password);
        if (!validEmail(email) || !password) {
          setFormMessage(
            loginForm,
            "E-poçt və şifrəni düzgün daxil edin.",
            "error",
          );
          return;
        }

        setFormBusy(loginForm, true);
        try {
          const response = await apiFetch(
            "/api/v1/auth/login",
            {
              method: "POST",
              signal,
              body: JSON.stringify({ email, password }),
            },
            false,
          );
          if (response?.accessToken) {
            setTokens(response);
            setFormMessage(
              loginForm,
              "Giriş uğurludur. Yönləndirilirsiniz…",
              "success",
            );
            await redirectAfterLogin(signal);
            return;
          }
          showOtp(response?.email || email, response?.expiresInSeconds);
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(loginForm, error);
        } finally {
          setFormBusy(loginForm, false);
        }
      },
      { signal },
    );

    otpForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(otpForm);
        const otp = otpForm.elements.otp.value.trim();
        if (!/^\d{6}$/.test(otp)) {
          markFormField(otpForm.elements.otp);
          setFormMessage(otpForm, "6 rəqəmli kodu daxil edin.", "error");
          return;
        }

        setFormBusy(otpForm, true);
        try {
          const response = await apiFetch(
            "/api/v1/auth/login/verify-otp",
            {
              method: "POST",
              signal,
              body: JSON.stringify({ email: pendingEmail, otp }),
            },
            false,
          );
          setTokens(response);
          setFormMessage(
            otpForm,
            "Kod təsdiqləndi. Yönləndirilirsiniz…",
            "success",
          );
          await redirectAfterLogin(signal);
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(otpForm, error);
        } finally {
          setFormBusy(otpForm, false);
        }
      },
      { signal },
    );

    otpBack?.addEventListener("click", showLogin, { signal });
  }

  function initRegisterPage(signal) {
    const registerForm = $("#registerForm");
    const verifyForm = $("#verifyEmailForm");
    const verifyHint = $("#verifyEmailHint");
    const resendButton = $("#resendVerificationButton");
    if (!registerForm || !verifyForm) return;

    let pendingEmail = "";
    let pendingPassword = "";
    registerForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(registerForm);
        const fullName = registerForm.elements.fullName.value.trim();
        const nameParts = personNameParts(fullName);
        const email = registerForm.elements.email.value.trim();
        const phone = registerForm.elements.phone.value.trim();
        const phoneValid = validPhone(phone);
        const password = registerForm.elements.password.value;
        const passwordConfirm = registerForm.elements.passwordConfirm.value;
        const termsAccepted = registerForm.elements.termsAccepted.checked;
        const privacyAccepted = registerForm.elements.privacyAccepted.checked;
        if (!nameParts)
          markFormField(registerForm.elements.fullName);
        if (!validEmail(email)) markFormField(registerForm.elements.email);
        if (!phoneValid) markFormField(registerForm.elements.phone);
        if (!validPassword(password))
          markFormField(registerForm.elements.password);
        if (passwordConfirm !== password)
          markFormField(registerForm.elements.passwordConfirm);
        if (!termsAccepted) markFormField(registerForm.elements.termsAccepted);
        if (!privacyAccepted)
          markFormField(registerForm.elements.privacyAccepted);
        if (
          !nameParts ||
          !validEmail(email) ||
          !phoneValid ||
          !validPassword(password) ||
          passwordConfirm !== password ||
          !termsAccepted ||
          !privacyAccepted
        ) {
          setFormMessage(
            registerForm,
            "Ad və soyadı ayrı sözlərlə, telefon və e-poçtu düzgün formatda daxil edin; şifrələri eyniləşdirin və şərtləri qəbul edin.",
            "error",
          );
          return;
        }

        setFormBusy(registerForm, true);
        try {
          const response = await apiFetch(
            "/api/v1/auth/register",
            {
              method: "POST",
              signal,
              body: JSON.stringify({
                email,
                firstName: nameParts.firstName,
                lastName: nameParts.lastName,
                ...(phone ? { phone } : {}),
                password,
              }),
            },
            false,
          );
          pendingEmail = response?.email || email;
          pendingPassword = password;
          registerForm.hidden = true;
          verifyForm.hidden = false;
          if (verifyHint)
            verifyHint.textContent = `${pendingEmail} ünvanına göndərilən 6 rəqəmli kodu daxil edin.`;
          $("#verifyEmailOtp")?.focus();
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(registerForm, error);
        } finally {
          setFormBusy(registerForm, false);
        }
      },
      { signal },
    );

    verifyForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(verifyForm);
        const otp = verifyForm.elements.otp.value.trim();
        if (!/^\d{6}$/.test(otp)) {
          markFormField(verifyForm.elements.otp);
          setFormMessage(verifyForm, "6 rəqəmli kodu daxil edin.", "error");
          return;
        }

        setFormBusy(verifyForm, true);
        try {
          await apiFetch(
            "/api/v1/auth/verify-email",
            {
              method: "POST",
              signal,
              body: JSON.stringify({ email: pendingEmail, otp }),
            },
            false,
          );
          verifyForm.reset();
          setFormMessage(
            verifyForm,
            "E-poçt təsdiqləndi. Hesabınıza daxil edilirsiniz…",
            "success",
          );
          const emailForLogin = pendingEmail;
          const passwordForLogin = pendingPassword;
          pendingPassword = "";
          try {
            const loginResponse = await apiFetch(
              "/api/v1/auth/login",
              {
                method: "POST",
                signal,
                body: JSON.stringify({
                  email: emailForLogin,
                  password: passwordForLogin,
                }),
              },
              false,
            );
            if (loginResponse?.accessToken) {
              setTokens(loginResponse);
              location.assign("index.html");
              return;
            }
          } catch (error) {
            if (error?.name === "AbortError" || signal.aborted) return;
            showFormError(verifyForm, error);
            return;
          }
          const submit = $('button[type="submit"]', verifyForm);
          if (submit) {
            submit.textContent = "Daxil ol";
            submit.type = "button";
            submit.addEventListener(
              "click",
              () => location.assign("login.html"),
              { once: true, signal },
            );
          }
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(verifyForm, error);
        } finally {
          setFormBusy(verifyForm, false);
        }
      },
      { signal },
    );

    resendButton?.addEventListener(
      "click",
      async () => {
        if (!validEmail(pendingEmail)) {
          setFormMessage(
            verifyForm,
            "Əvvəlcə qeydiyyat e-poçtunu təsdiqləyin.",
            "error",
          );
          return;
        }
        resendButton.disabled = true;
        try {
          await apiFetch(
            "/api/v1/auth/resend-verification",
            {
              method: "POST",
              signal,
              body: JSON.stringify({ email: pendingEmail }),
            },
            false,
          );
          setFormMessage(
            verifyForm,
            "Yeni təsdiq kodu göndərildi.",
            "success",
          );
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(verifyForm, error);
        } finally {
          resendButton.disabled = false;
        }
      },
      { signal },
    );
  }

  function initPasswordPage(signal) {
    const forgotForm = $("#forgotPasswordForm");
    const resetForm = $("#resetPasswordForm");
    const title = $("#passwordPageTitle");
    const lead = $("#passwordPageLead");
    if (!forgotForm || !resetForm) return;

    const token =
      new URLSearchParams(location.search).get("token")?.trim() || "";
    if (token) {
      forgotForm.hidden = true;
      resetForm.hidden = false;
      if (title) title.textContent = "Yeni şifrə yarat";
      if (lead)
        lead.textContent =
          "E-poçtdakı keçid təsdiqləndi. Yeni şifrənizi daxil edin.";
    }

    forgotForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(forgotForm);
        const email = forgotForm.elements.email.value.trim();
        if (!validEmail(email)) {
          markFormField(forgotForm.elements.email);
          setFormMessage(
            forgotForm,
            "Etibarlı e-poçt ünvanı daxil edin.",
            "error",
          );
          return;
        }
        setFormBusy(forgotForm, true);
        try {
          await apiFetch(
            "/api/v1/auth/forgot-password",
            {
              method: "POST",
              signal,
              body: JSON.stringify({ email }),
            },
            false,
          );
          setFormMessage(
            forgotForm,
            "Hesab mövcuddursa, bərpa keçidi e-poçtunuza göndərildi.",
            "success",
          );
          forgotForm.reset();
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(forgotForm, error);
        } finally {
          setFormBusy(forgotForm, false);
        }
      },
      { signal },
    );

    resetForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(resetForm);
        const newPassword = resetForm.elements.newPassword.value;
        const newPasswordConfirm =
          resetForm.elements.newPasswordConfirm.value;
        if (!validPassword(newPassword)) {
          markFormField(resetForm.elements.newPassword);
        }
        if (newPasswordConfirm !== newPassword) {
          markFormField(resetForm.elements.newPasswordConfirm);
        }
        if (
          !validPassword(newPassword) ||
          newPasswordConfirm !== newPassword
        ) {
          setFormMessage(
            resetForm,
            "Şifrə 8–72 simvol, ən azı bir hərf və bir rəqəmdən ibarət olmalı və təsdiqlə eyni olmalıdır.",
            "error",
          );
          return;
        }
        setFormBusy(resetForm, true);
        try {
          await apiFetch(
            "/api/v1/auth/reset-password",
            {
              method: "POST",
              signal,
              body: JSON.stringify({ token, newPassword }),
            },
            false,
          );
          resetForm.reset();
          setFormMessage(
            resetForm,
            "Şifrə yeniləndi. İndi daxil ola bilərsiniz.",
            "success",
          );
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(resetForm, error);
        } finally {
          setFormBusy(resetForm, false);
        }
      },
      { signal },
    );
  }

  async function initProfilePage(signal) {
    const profileForm = $("#profileForm");
    const passwordForm = $("#changePasswordForm");
    const summary = $("#profileSummary");
    const logoutButton = $("#logoutButton");
    if (!profileForm || !passwordForm) return;
    const user = await requireUser(signal);
    if (!user || signal.aborted) return;
    let originalFullName =
      String(user.fullName || "").trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(" ");

    profileForm.elements.email.readOnly = true;
    profileForm.elements.email.title =
      "E-poçt dəyişikliyi yenidən təsdiqləmə xidməti yaradılanadək bağlıdır.";
    const rawProfileField = profileForm.elements.profile;
    if (rawProfileField) {
      rawProfileField.disabled = true;
      const rawProfileContainer = rawProfileField.closest("label");
      if (rawProfileContainer) rawProfileContainer.hidden = true;
    }

    try {
      profileForm.elements.fullName.value = originalFullName;
      profileForm.elements.email.value = user.email || "";
      profileForm.elements.phone.value = user.phone || "";
      profileForm.elements.locale.value = user.locale || "az";
      if (summary)
        summary.textContent = `${user.fullName || user.email} · ${enumLabel(user.role)} · ${enumLabel(userAccountStatus(user))}`;
    } catch (error) {
      if (error?.name !== "AbortError") {
        if (summary) {
          summary.textContent = apiErrorMessage(error);
          summary.dataset.state = "error";
        }
      }
    }

    profileForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(profileForm);
        const fullName = profileForm.elements.fullName.value.trim();
        const nameParts = personNameParts(fullName);
        const nameChanged = fullName !== originalFullName;
        const phone = profileForm.elements.phone.value.trim();
        const locale = profileForm.elements.locale.value.trim() || "az";
        const phoneValid = validPhone(phone);
        const localeValid = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale);
        if (!nameParts)
          markFormField(profileForm.elements.fullName);
        if (!phoneValid) markFormField(profileForm.elements.phone);
        if (!localeValid) markFormField(profileForm.elements.locale);
        if (!nameParts || !phoneValid || !localeValid) {
          setFormMessage(
            profileForm,
            "Ad, telefon və dil məlumatlarını düzgün formatda daxil edin.",
            "error",
          );
          return;
        }

        setFormBusy(profileForm, true);
        try {
          const updated = await apiFetch("/api/v1/users/me", {
            method: "PATCH",
            signal,
            body: JSON.stringify({
              ...(nameChanged ? nameParts : {}),
              phone,
              locale,
            }),
          });
          currentUserCache = updated || currentUserCache;
          if (updated) {
            originalFullName =
              String(updated.fullName || "").trim() ||
              [updated.firstName, updated.lastName]
                .filter(Boolean)
                .join(" ");
            profileForm.elements.fullName.value = originalFullName;
            if (summary)
              summary.textContent = `${originalFullName || updated.email} · ${enumLabel(updated.role)} · ${enumLabel(userAccountStatus(updated))}`;
          }
          setFormMessage(
            profileForm,
            "Profil məlumatları yeniləndi.",
            "success",
          );
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(profileForm, error);
        } finally {
          setFormBusy(profileForm, false);
        }
      },
      { signal },
    );

    passwordForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(passwordForm);
        const currentPassword = passwordForm.elements.currentPassword.value;
        const newPassword = passwordForm.elements.newPassword.value;
        const newPasswordConfirm =
          passwordForm.elements.newPasswordConfirm.value;
        if (!currentPassword)
          markFormField(passwordForm.elements.currentPassword);
        if (!validPassword(newPassword))
          markFormField(passwordForm.elements.newPassword);
        if (newPasswordConfirm !== newPassword)
          markFormField(passwordForm.elements.newPasswordConfirm);
        if (
          !currentPassword ||
          !validPassword(newPassword) ||
          newPasswordConfirm !== newPassword
        ) {
          setFormMessage(
            passwordForm,
            "Cari şifrəni, tələblərə uyğun yeni şifrəni və eyni təsdiqi daxil edin.",
            "error",
          );
          return;
        }

        setFormBusy(passwordForm, true);
        try {
          await apiFetch("/api/v1/users/me/password", {
            method: "POST",
            signal,
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          passwordForm.reset();
          setFormMessage(passwordForm, "Şifrə uğurla yeniləndi.", "success");
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(passwordForm, error);
        } finally {
          setFormBusy(passwordForm, false);
        }
      },
      { signal },
    );

    logoutButton?.addEventListener(
      "click",
      async () => {
        logoutButton.disabled = true;
        await logoutCurrentSession(signal);
        location.assign("login.html");
      },
      { signal },
    );
  }

  function enrollmentStorageKey(userId) {
    return `nexora_enrollment_ids_${userId}`;
  }

  function readEnrollmentIds(userId) {
    try {
      const value = JSON.parse(
        readStorage(localStorage, enrollmentStorageKey(userId)) || "[]",
      );
      return Array.isArray(value)
        ? [...new Set(value.filter(Boolean).map(String))]
        : [];
    } catch (_) {
      return [];
    }
  }

  function saveEnrollmentId(userId, enrollmentId) {
    const ids = readEnrollmentIds(userId);
    if (!ids.includes(String(enrollmentId))) ids.unshift(String(enrollmentId));
    writeStorage(
      localStorage,
      enrollmentStorageKey(userId),
      JSON.stringify(ids.slice(0, 50)),
    );
  }

  function enrollmentAttemptStorageKey(userId) {
    return `nexora_enrollment_attempt_${userId}`;
  }

  function enrollmentAttempt(userId, fingerprint) {
    const key = enrollmentAttemptStorageKey(userId);
    try {
      const saved = JSON.parse(readStorage(sessionStorage, key) || "null");
      if (
        saved?.fingerprint === fingerprint &&
        typeof saved.idempotencyKey === "string" &&
        saved.idempotencyKey &&
        typeof saved.consentGivenAt === "string" &&
        saved.consentGivenAt
      )
        return saved;
    } catch (_) {
      // A malformed attempt is replaced with a new safe key.
    }
    const idempotencyKey = createIdempotencyKey();
    const attempt = {
      fingerprint,
      idempotencyKey,
      consentGivenAt: new Date().toISOString(),
    };
    writeStorage(sessionStorage, key, JSON.stringify(attempt));
    return attempt;
  }

  function clearEnrollmentAttempt(userId) {
    writeStorage(sessionStorage, enrollmentAttemptStorageKey(userId), "");
  }

  function renderEnrollmentCard(enrollment, showActions = true) {
    const status = enrollment.status || "PENDING_PAYMENT";
    const canCancel = [
      "WAITLISTED",
      "HELD",
      "PENDING_PAYMENT",
      "CONFIRMED",
    ].includes(normalizedEnum(status));
    return `<article class="Nexora_enrollmentCard">
      <div class="Nexora_enrollmentCardTop">
        <span class="Nexora_badge">${escapeHtml(enumLabel(status))}</span>
        <time datetime="${escapeHtml(enrollment.enrolledAt || "")}">${escapeHtml(formatDate(enrollment.enrolledAt))}</time>
      </div>
      <h3>Qeydiyyat ${escapeHtml(enrollment.id)}</h3>
      <dl class="Nexora_detailList">
        <div><dt>Qrup ID-si</dt><dd>${escapeHtml(enrollment.groupId || "—")}</dd></div>
        ${enrollment.holdExpiresAt ? `<div><dt>Rezerv bitir</dt><dd>${escapeHtml(formatDate(enrollment.holdExpiresAt))}</dd></div>` : ""}
        ${enrollment.cancelReason ? `<div><dt>Ləğv səbəbi</dt><dd>${escapeHtml(enrollment.cancelReason)}</dd></div>` : ""}
      </dl>
      ${showActions && canCancel ? `<button class="ai-btn ai-btn--text" type="button" data-cancel-enrollment="${escapeHtml(enrollment.id)}">Qeydiyyatı ləğv et</button>` : ""}
    </article>`;
  }

  async function initEnrollmentsPage(signal) {
    const createForm = $("#createEnrollmentForm");
    const lookupForm = $("#lookupEnrollmentForm");
    const cancelForm = $("#cancelEnrollmentForm");
    const list = $("#enrollmentsList");
    const status = $("#enrollmentsStatus");
    const cancelHint = $("#cancelEnrollmentHint");
    const cancelClose = $("#cancelEnrollmentClose");
    if (!createForm || !lookupForm || !cancelForm || !list || !status) return;

    let user;
    try {
      user = await requireUser(signal, ["STUDENT"]);
    } catch (error) {
      if (error?.name !== "AbortError") {
        status.textContent = apiErrorMessage(error);
        status.dataset.state = "error";
      }
      return;
    }
    if (!user?.id || signal.aborted) return;
    const consentVersion =
      document.querySelector(
        'meta[name="nexora-enrollment-consent-version"]',
      )?.content || "";

    const loadSaved = async () => {
      const ids = readEnrollmentIds(user.id);
      if (!ids.length) {
        list.innerHTML =
          '<div class="Nexora_emptyState"><h3>Yadda saxlanmış qeydiyyat yoxdur</h3><p>Yeni qeydiyyat yaradın və ya mövcud qeydiyyat ID-sini daxil edin.</p></div>';
        status.textContent = "";
        return;
      }
      status.textContent = "Qeydiyyatlar yüklənir…";
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return {
              enrollment: await apiFetch(
                `/api/v1/enrollments/${encodeURIComponent(id)}`,
                { signal },
              ),
            };
          } catch (error) {
            return { id, error };
          }
        }),
      );
      if (signal.aborted) return;
      list.innerHTML = results
        .map((result) => {
          if (result.enrollment) return renderEnrollmentCard(result.enrollment);
          return `<article class="Nexora_enrollmentCard Nexora_enrollmentCard--error">
          <h3>${escapeHtml(result.id)}</h3>
          <p>${escapeHtml(apiErrorMessage(result.error))}</p>
        </article>`;
        })
        .join("");
      status.textContent = `${results.filter((result) => result.enrollment).length} qeyd göstərilir`;
    };

    createForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(createForm);
        const groupId = createForm.elements.groupId.value.trim();
        if (!groupId) markFormField(createForm.elements.groupId);
        if (!createForm.elements.consent.checked)
          markFormField(createForm.elements.consent);
        if (!groupId || !createForm.elements.consent.checked || !consentVersion) {
          setFormMessage(
            createForm,
            consentVersion
              ? "Qrup ID-sini daxil edin və şərtləri qəbul edin."
              : "Aktiv razılıq versiyası müəyyən edilməyib. Qeydiyyat göndərilmədi.",
            "error",
          );
          return;
        }

        const fingerprint = JSON.stringify({ groupId, consentVersion });
        const attempt = enrollmentAttempt(user.id, fingerprint);
        setFormBusy(createForm, true);
        try {
          const enrollment = await apiFetch("/api/v1/enrollments", {
            method: "POST",
            signal,
            body: JSON.stringify({
              userId: user.id,
              groupId,
              idempotencyKey: attempt.idempotencyKey,
              consentVersion,
              consentGivenAt: attempt.consentGivenAt,
            }),
          });
          if (enrollment?.id) saveEnrollmentId(user.id, enrollment.id);
          clearEnrollmentAttempt(user.id);
          createForm.reset();
          setFormMessage(
            createForm,
            "Qeydiyyat yaradıldı və siyahıya əlavə edildi.",
            "success",
          );
          await loadSaved();
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(createForm, error);
        } finally {
          setFormBusy(createForm, false);
        }
      },
      { signal },
    );

    lookupForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(lookupForm);
        const enrollmentId = lookupForm.elements.enrollmentId.value.trim();
        if (!enrollmentId) {
          markFormField(lookupForm.elements.enrollmentId);
          setFormMessage(lookupForm, "Qeydiyyat ID-sini daxil edin.", "error");
          return;
        }
        setFormBusy(lookupForm, true);
        try {
          const enrollment = await apiFetch(
            `/api/v1/enrollments/${encodeURIComponent(enrollmentId)}`,
            { signal },
          );
          if (enrollment?.id) saveEnrollmentId(user.id, enrollment.id);
          lookupForm.reset();
          setFormMessage(
            lookupForm,
            "Qeydiyyat tapıldı və siyahıya əlavə edildi.",
            "success",
          );
          await loadSaved();
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(lookupForm, error);
        } finally {
          setFormBusy(lookupForm, false);
        }
      },
      { signal },
    );

    list.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button[data-cancel-enrollment]");
        if (!button) return;
        const enrollmentId = button.dataset.cancelEnrollment;
        cancelForm.elements.enrollmentId.value = enrollmentId;
        if (cancelHint)
          cancelHint.textContent = `${enrollmentId} nömrəli qeydiyyat ləğv ediləcək.`;
        cancelForm.hidden = false;
        cancelForm.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      { signal },
    );

    cancelClose?.addEventListener(
      "click",
      () => {
        cancelForm.reset();
        cancelForm.hidden = true;
      },
      { signal },
    );

    cancelForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearFormErrors(cancelForm);
        const enrollmentId = cancelForm.elements.enrollmentId.value;
        const reason = cancelForm.elements.reason.value.trim();
        setFormBusy(cancelForm, true);
        try {
          await apiFetch(
            `/api/v1/enrollments/${encodeURIComponent(enrollmentId)}/cancel`,
            {
              method: "POST",
              signal,
              body: JSON.stringify(reason ? { reason } : {}),
            },
          );
          cancelForm.reset();
          cancelForm.hidden = true;
          await loadSaved();
        } catch (error) {
          if (error?.name !== "AbortError") showFormError(cancelForm, error);
        } finally {
          setFormBusy(cancelForm, false);
        }
      },
      { signal },
    );

    await loadSaved();
  }

  async function initStudentPage(signal) {
    const title = $("#studentOverviewTitle");
    const summary = $("#studentOverviewSummary");
    const list = $("#studentKnownEnrollments");
    const status = $("#studentKnownEnrollmentStatus");
    if (!title || !summary || !list || !status) return;
    const user = await requireUser(signal, ["STUDENT"]);
    if (!user || signal.aborted) return;
    title.textContent = `Salam, ${user.fullName || user.email || "tələbə"}`;
    summary.textContent =
      "Kabinet kurs, profil və məlum qeydiyyat axınlarını birləşdirir. Ödəniş, bildiriş və təqaüd modulları server xidmətləri yarananadək aktiv deyil.";
    const ids = readEnrollmentIds(user.id);
    if (!ids.length) {
      list.innerHTML =
        '<div class="Nexora_emptyState"><h3>Yadda saxlanmış qeydiyyat yoxdur</h3><p>Server tərəfində “mənim qeydiyyatlarım” xidməti hələ mövcud deyil.</p></div>';
      status.textContent = "";
      return;
    }
    status.textContent = "Məlum qeydiyyatlar yüklənir…";
    const results = await Promise.all(
      ids.slice(0, 6).map(async (id) => {
        try {
          return await apiFetch(
            `/api/v1/enrollments/${encodeURIComponent(id)}`,
            { signal },
          );
        } catch (_) {
          return null;
        }
      }),
    );
    if (signal.aborted) return;
    const enrollments = results.filter(Boolean);
    list.innerHTML = enrollments.length
      ? enrollments
          .map((enrollment) => renderEnrollmentCard(enrollment, false))
          .join("")
      : '<div class="Nexora_emptyState"><h3>Qeydiyyat məlumatı tapılmadı</h3><p>Yadda saxlanmış ID-lər üzrə əlçatan qeyd yoxdur.</p></div>';
    status.textContent = `${enrollments.length} yadda saxlanmış qeyd göstərilir`;
  }

  function staffModuleCard(module) {
    return `<article class="Nexora_courseCard">
      <div class="Nexora_courseCardBody">
        <h3>${escapeHtml(module.title)}</h3>
        <p>${escapeHtml(module.description)}</p>
      </div>
      <span class="Nexora_badge">${escapeHtml(module.status)}</span>
    </article>`;
  }

  async function initStaffPage(signal) {
    const title = $("#staffOverviewTitle");
    const summary = $("#staffOverviewSummary");
    const modulesContainer = $("#staffModules");
    const status = $("#staffModulesStatus");
    if (!title || !summary || !modulesContainer || !status) return;
    const user = await requireUser(signal, [...STAFF_ROLES]);
    if (!user || signal.aborted) return;
    const role = userRole(user);
    const contentModules = [
      {
        title: "Kateqoriya və kurs əməliyyatları",
        description:
          "Dəstəklənən CRUD axınları; təfərrüat ekranları əlaqəli xidmətlərin brauzer tərəfində birləşdirilməsini tələb edir.",
        status: "Dəstəklənir / Kombinə edilmiş",
      },
      {
        title: "Müəllimlər, tədris təyinatları və qruplar",
        description:
          "Məzmun əməliyyatları dəstəklənir; əlaqələndirilmiş istifadəçi seçimi üçün təhlükəsiz axtarış çatışmır.",
        status: "Dəstəklənir / Qismən",
      },
      {
        title: "CMS, bilik bazası və məzun nəticələri",
        description:
          "Əməkdaş CRUD-u dəstəklənir; açıq önbaxış/CMS müqaviləsi və təhlükəsiz istifadəçi axtarışı ayrıca tələb olunur.",
        status: "Dəstəklənir / Qismən",
      },
      {
        title: "Rəy idarəetməsi",
        description:
          "CRUD mövcuddur, lakin dərc etmə/dərci dayandırma nəzarətçi xidməti yoxdur.",
        status: "Qismən / Əməliyyat bloklanıb",
      },
    ];
    const crmModules = [
      {
        title: "Potensial müştəri, əlaqə və çat əməliyyatları",
        description:
          "Siyahı/təfərrüat axınları dəstəklənir; potensial müştəri statusu və çatı bitirmə əməliyyatları nəzarətçidə yoxdur.",
        status: "Dəstəklənir / Qismən",
      },
      {
        title: "Kampaniyalar",
        description:
          "Əməkdaş CRUD-u dəstəklənir; açıq kampaniya sorğusu və çevrilmə prosesi yoxdur.",
        status: "Dəstəklənir / Qismən",
      },
      {
        title: "Qlobal qeydiyyatlar",
        description:
          "Yalnız Satış CRM-i, Administrator və Sistem administratoru üçündür. Satış CRM-i istifadəçi və kurs qrupu axtarışı olmadan təhlükəsiz yaratma forması qura bilmir.",
        status: "Dəstəklənir / Qismən",
      },
    ];
    const adminModules = [
      {
        title: "İstifadəçi idarəetməsi",
        description:
          "CRUD dəstəklənir; öz rolunu aşağı salma və yüksək rol dəyişiklikləri üçün əlavə təhlükəsizlik qoruması tələb olunur.",
        status: "Supported",
      },
      {
        title: "Ödəniş və təqaüd əməliyyatları",
        description:
          "Administrator əməliyyatları mövcuddur; geriödəniş nəzarətçisi və tələbə ödənişinin həyat dövrü yoxdur.",
        status: "Dəstəklənir / Əməliyyat bloklanıb",
      },
      {
        title: "Bildiriş və sessiya qeydləri",
        description:
          "Qeyd CRUD-u mövcuddur; oxunub/göndərilib işarələmə və ayrıca ləğv xidmətləri yoxdur.",
        status: "Qismən / Əməliyyat bloklanıb",
      },
      {
        title: "Yoxlama və sistem sağlamlığı",
        description:
          "Yoxlamanın siyahı/təfərrüat və sağlamlıq funksiyaları dəstəklənir. Əl ilə yoxlama dəyişikliyi və daxili sınaq əməliyyatları istifadəçi interfeysində göstərilmir.",
        status: "Dəstəklənir / Daxili",
      },
    ];
    let modules = [];
    if (role === "CONTENT_MANAGER") {
      title.textContent = "Məzmun əməliyyatlarına ümumi baxış";
      modules = contentModules;
    } else if (role === "SALES_CRM") {
      title.textContent = "Satış CRM-inə ümumi baxış";
      modules = crmModules;
    } else {
      title.textContent =
        role === "SYSTEM_ADMIN"
          ? "Sistem idarəçiliyinə ümumi baxış"
          : "İdarəetməyə ümumi baxış";
      modules = [...contentModules, ...crmModules, ...adminModules];
    }
    summary.textContent = `${user.fullName || user.email} · ${enumLabel(role)}. Modul siyahısı faktiki rol icazələrinə görə məhdudlaşdırılıb.`;
    modulesContainer.innerHTML = modules.map(staffModuleCard).join("");
    status.textContent = `${modules.length} icazəli əməliyyat sahəsi`;
  }

  async function logoutCurrentSession(signal) {
    const refreshToken = readStorage(localStorage, REFRESH_TOKEN_KEY);
    try {
      if (refreshToken) {
        await apiFetch(
          "/api/v1/auth/logout",
          {
            method: "POST",
            signal,
            body: JSON.stringify({ refreshToken }),
          },
          false,
        );
      }
    } catch (_) {
      // Local session is still cleared when the backend is unavailable.
    } finally {
      clearTokens();
    }
  }

  async function initAccountStatusPage(signal) {
    const title = $("#accountStatusTitle");
    const message = $("#accountStatusMessage");
    const logoutButton = $("#accountStatusLogout");
    const hint = $("#accountStatusHint");
    if (!title || !message || !logoutButton) return;
    let user;
    try {
      user = await requireUser(signal, null, true);
    } catch (error) {
      if (error?.name !== "AbortError" && hint) {
        hint.textContent = apiErrorMessage(error);
        hint.dataset.state = "error";
      }
      return;
    }
    if (!user || signal.aborted) return;
    const accountStatus = userAccountStatus(user);
    if (!accountStatus || accountStatus === "ACTIVE") {
      location.replace(roleDestination(userRole(user)));
      return;
    }
    const states = {
      PENDING_VERIFICATION: [
        "E-poçt təsdiqi gözlənilir",
        "Hesabdan istifadə etmək üçün e-poçt təsdiqini tamamlayın.",
      ],
      SUSPENDED: [
        "Hesab müvəqqəti dayandırılıb",
        "Hesabınıza giriş müvəqqəti məhdudlaşdırılıb. Dəstək komandası ilə əlaqə saxlayın.",
      ],
      DEACTIVATED: [
        "Hesab deaktiv edilib",
        "Bu hesab hazırda aktiv deyil. Dəstək komandası ilə əlaqə saxlayın.",
      ],
      BANNED: [
        "Hesaba giriş bloklanıb",
        "Bu hesab üçün kabinetə giriş bağlıdır. Dəstək komandası ilə əlaqə saxlayın.",
      ],
    };
    const state = states[accountStatus] || [
      "Hesab əlçatan deyil",
      "Hesab vəziyyəti kabinetə girişə icazə vermir.",
    ];
    title.textContent = state[0];
    message.textContent = state[1];
    logoutButton.addEventListener(
      "click",
      async () => {
        logoutButton.disabled = true;
        await logoutCurrentSession(signal);
        location.assign("login.html");
      },
      { signal },
    );
  }

  function initApiPage(signal) {
    switch (document.body.dataset.page) {
      case "home":
        void initHomeBanner(signal);
        void initHomeFeaturedCourses(signal);
        break;
      case "courses":
        initCoursesPage(signal);
        break;
      case "categories":
        void initCategoriesPage(signal);
        break;
      case "category":
        void initCategoryPage(signal);
        break;
      case "course-details":
        initCourseDetailsPage(signal);
        break;
      case "faq":
        void initFaqPage(signal);
        break;
      case "haqqimizda":
        void initAcademyPage(signal);
        break;
      case "elaqe":
        void initContactPage(signal);
        break;
      case "scholarships":
        void initScholarshipsPage(signal);
        break;
      case "login":
        initLoginPage(signal);
        break;
      case "register":
        initRegisterPage(signal);
        break;
      case "password":
        initPasswordPage(signal);
        break;
      case "profile":
        void initProfilePage(signal).catch((error) => {
          if (error?.name !== "AbortError") {
            const summary = $("#profileSummary");
            if (summary) summary.textContent = apiErrorMessage(error);
          }
        });
        break;
      case "enrollments":
        void initEnrollmentsPage(signal).catch((error) => {
          if (error?.name !== "AbortError") {
            const status = $("#enrollmentsStatus");
            if (status) status.textContent = apiErrorMessage(error);
          }
        });
        break;
      case "student":
        void initStudentPage(signal).catch((error) => {
          if (error?.name !== "AbortError") {
            const status = $("#studentKnownEnrollmentStatus");
            if (status) status.textContent = apiErrorMessage(error);
          }
        });
        break;
      case "staff":
        void initStaffPage(signal).catch((error) => {
          if (error?.name !== "AbortError") {
            const status = $("#staffModulesStatus");
            if (status) status.textContent = apiErrorMessage(error);
          }
        });
        break;
      case "account-status":
        void initAccountStatusPage(signal);
        break;
      default:
        break;
    }
  }

  function initStandaloneTarget() {
    if (IS_LEGACY_ROUTER) return;
    const target = new URLSearchParams(location.search).get("target");
    if (!target) return;
    const node = document.getElementById(target);
    if (!node) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.classList.remove("naic-target-flash");
        requestAnimationFrame(() => node.classList.add("naic-target-flash"));
      }),
    );
  }

  function initPage(signal) {
    applyDataImageFallbacks();
    initStandaloneTarget();
    initHeader(signal);
    initHeroMedia(signal);
    initHeroTypewriter(signal);
    initApplicationForm(signal);
    initSimpleForms(signal);
    initVacancies(signal);
    initSliders(signal);
    initPagination(signal);
    initPhoneInputs(signal);
    initApiPage(signal);
  }

  document.addEventListener("click", (event) => {
    if (!IS_LEGACY_ROUTER) return;
    const link = event.target.closest('a[href^="#/nav/"]');
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    const href = link.getAttribute("href");
    if (location.hash === href) renderRoute(routeFromHash());
    else location.hash = href.slice(1);
  });

  if (IS_LEGACY_ROUTER) {
    window.addEventListener("hashchange", () => renderRoute(routeFromHash()));
  }
  const boot = () => {
    if (IS_LEGACY_ROUTER) {
      if (!location.hash.match(/^#\/nav\//)) {
        history.replaceState(
          null,
          "",
          `${location.pathname}${location.search}#/nav/home`,
        );
      }
      renderRoute(routeFromHash());
      return;
    }
    pageController?.abort();
    pageController = new AbortController();
    initPage(pageController.signal);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();

/* ══════════════════════════════════════════════════════════════
   Nexora AI Chat Widget
   ══════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const API_URL = "/api/chat";
  const STORAGE_KEY = "nexora-ai-session-id";
  const MAX_HISTORY = 80;

  let sessionId = getOrCreateSessionId();
  let pending = false;
  let history = [];
  let requestController = null;
  let lastRequest = null;
  let initialized = false;

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `nexora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getOrCreateSessionId() {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const created = createId();
      window.localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch (_) {
      return createId();
    }
  }

  function $(sel, root) { return (root || document).querySelector(sel); }

  const elements = {
    fab: $("#chat-fab"),
    widget: $("#chat-widget"),
    close: $("#chat-close"),
    messages: $("#chat-messages"),
    form: $("#chat-form"),
    input: $("#chat-input"),
    send: $("#chat-send"),
  };

  let { fab, widget, close: closeBtn, messages: messagesEl, form: chatForm, input: chatInput, send: chatSend } = elements;

  if (!fab || !widget) return;

  function resizeInput() {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
    });
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }

  function normalizeText(v, fb) { return typeof v === "string" ? v : (fb || ""); }

  /* ── Rebind after SPA route change ── */
  function rebindChatWidget() {
    const newFab = $("#chat-fab");
    const newWidget = $("#chat-widget");
    const newClose = $("#chat-close");
    const newForm = $("#chat-form");
    const newInput = $("#chat-input");
    const newSend = $("#chat-send");
    const newMessages = $("#chat-messages");
    if (!newFab || !newWidget) return;

    Object.assign(elements, {
      fab: newFab, widget: newWidget, close: newClose,
      form: newForm, input: newInput, send: newSend, messages: newMessages
    });
    fab = elements.fab; widget = elements.widget; closeBtn = elements.close;
    chatForm = elements.form; chatInput = elements.input; chatSend = elements.send;
    messagesEl = elements.messages;

    newFab.onclick = () => { if (isOpen) closeWidget(); else openWidget(); };
    newClose.onclick = closeWidget;
    newForm.onsubmit = (e) => {
      e.preventDefault();
      const v = newInput.value.trim();
      if (!v || pending) return;
      newInput.value = "";
      resizeInput();
      newSend.disabled = true;
      sendMessage(v);
    };
    newInput.oninput = () => { resizeInput(); newSend.disabled = pending || !newInput.value.trim(); };
    newInput.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); newForm.requestSubmit(); }
    };
  }

  /* ── Open / Close ── */
  let isOpen = false;

  function openWidget() {
    if (isOpen) { closeWidget(); return; }
    widget.hidden = false;
    isOpen = true;
    requestAnimationFrame(() => {
      widget.classList.add("open");
      fab.classList.add("chat-fab--active");
      chatInput.focus();
    });
    if (!initialized) {
      initialized = true;
      initConversation();
    }
  }

  function closeWidget() {
    isOpen = false;
    widget.classList.remove("open");
    fab.classList.remove("chat-fab--active");
    setTimeout(() => { widget.hidden = true; }, 300);
  }

  fab.addEventListener("click", openWidget);
  closeBtn.addEventListener("click", closeWidget);
  widget.addEventListener("click", (e) => {
    if (e.target === widget) closeWidget();
  });

  /* ── Messages ── */
  function addMessage(role, text, response) {
    const wrap = document.createElement("div");
    wrap.className = "chat-msg" + (role === "user" ? " chat-msg--user" : "");

    const avatar = document.createElement("div");
    avatar.className = "chat-msg__avatar";
    avatar.textContent = "✦";

    const body = document.createElement("div");

    const bubble = document.createElement("div");
    bubble.className = "chat-msg__bubble";
    bubble.textContent = normalizeText(text, "No response received.");
    body.appendChild(bubble);

    if (role === "assistant" && response) {
      const actions = response.actions || [];
      if (actions.length) {
        const actionsWrap = document.createElement("div");
        actionsWrap.className = "chat-msg__actions";
        actions.forEach((a) => {
          const label = normalizeText(a?.label).trim();
          const value = normalizeText(a?.value, label).trim();
          if (!label || !value) return;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "chat-action-btn";
          btn.textContent = label;
          btn.addEventListener("click", () => {
            if (!pending) sendMessage(value, label);
          });
          actionsWrap.appendChild(btn);
        });
        body.appendChild(actionsWrap);
      }

      const courses = response.courses || [];
      if (courses.length) {
        const coursesWrap = document.createElement("div");
        coursesWrap.className = "chat-msg__courses";
        courses.forEach((c) => {
          const card = document.createElement("div");
          card.className = "chat-course";
          card.innerHTML =
            '<div class="chat-course__top"><span class="chat-course__category"></span><span class="chat-course__price"></span></div>' +
            '<div class="chat-course__name"></div>' +
            '<div class="chat-course__meta"></div>' +
            '<div class="chat-course__tools"></div>';
          card.querySelector(".chat-course__category").textContent = normalizeText(c?.category, "Course");
          card.querySelector(".chat-course__name").textContent = normalizeText(c?.name, "Nexora course");
          card.querySelector(".chat-course__price").textContent = Number.isFinite(c?.price) ? c.price + " AZN" : "";
          const meta = card.querySelector(".chat-course__meta");
          [c?.level, c?.instructor, [c?.schedule?.days, c?.schedule?.time].filter(Boolean).join(" · ")]
            .filter(Boolean).forEach((m) => {
              const s = document.createElement("span");
              s.textContent = m;
              meta.appendChild(s);
            });
          const tools = card.querySelector(".chat-course__tools");
          (Array.isArray(c?.tools) ? c.tools.slice(0, 5) : []).forEach((t) => {
            const tag = document.createElement("span");
            tag.className = "chat-course__tool";
            tag.textContent = t;
            tools.appendChild(tag);
          });
          coursesWrap.appendChild(card);
        });
        body.appendChild(coursesWrap);
      }
    }

    wrap.appendChild(avatar);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    history.push({ role, text: normalizeText(text), response });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    scrollToBottom();
  }

  function addError(text) {
    const banner = document.createElement("div");
    banner.className = "chat-error";
    banner.innerHTML = '<span></span><button type="button">Retry</button>';
    banner.querySelector("span").textContent = text;
    banner.querySelector("button").addEventListener("click", () => {
      banner.remove();
      if (lastRequest) sendMessage(lastRequest.value, lastRequest.display, { silent: true });
    });
    messagesEl.appendChild(banner);
    scrollToBottom();
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "chat-typing";
    el.id = "chat-active-typing";
    el.innerHTML = '<div class="chat-msg__avatar">✦</div><div class="chat-typing__dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById("chat-active-typing");
    if (el) el.remove();
  }

  function setPending(v) {
    pending = v;
    chatInput.disabled = v;
    chatSend.disabled = v || !chatInput.value.trim();
    document.querySelectorAll(".chat-action-btn").forEach((b) => {
      b.disabled = v || b.dataset.used === "true";
    });
  }

  /* ── API ── */
  async function requestChat(message) {
    requestController?.abort();
    requestController = new AbortController();
    const tid = setTimeout(() => requestController.abort(), 35000);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ message, sessionId, conversationId: sessionId }),
        signal: requestController.signal,
      });
      if (!res.ok) throw new Error("Server " + res.status);
      const data = await res.json();
      if (!data || typeof data.reply !== "string") throw new Error("Invalid response");
      return data;
    } finally {
      clearTimeout(tid);
    }
  }

  async function sendMessage(value, display, opts) {
    const msg = normalizeText(value).trim();
    if (!msg || pending) return;
    lastRequest = { value: msg, display };
    document.querySelectorAll(".chat-action-btn").forEach((b) => {
      b.dataset.used = "true";
      b.disabled = true;
    });
    if (!opts?.silent) addMessage("user", display || msg);
    setPending(true);
    showTyping();
    try {
      const data = await requestChat(msg);
      hideTyping();
      addMessage("assistant", data.reply, data);
      setConnection(data.capture);
    } catch (err) {
      hideTyping();
      const aborted = err?.name === "AbortError";
      addError(aborted ? "Timeout. Try again." : "Could not reach the AI. Retry.");
    } finally {
      setPending(false);
      chatInput.focus();
    }
  }

  function setConnection(capture) {
    // placeholder — no connection status in widget version
  }

  async function initConversation() {
    setPending(true);
    showTyping();
    try {
      const data = await requestChat("/start");
      hideTyping();
      addMessage("assistant", data.reply, data);
    } catch (_) {
      hideTyping();
      addError("AI is not responding. Make sure chatbot-api is running.");
    } finally {
      setPending(false);
    }
  }

  function resetChat() {
    requestController?.abort();
    sessionId = createId();
    try { localStorage.setItem(STORAGE_KEY, sessionId); } catch (_) {}
    history = [];
    lastRequest = null;
    messagesEl.innerHTML = "";
    chatInput.value = "";
    resizeInput();
    initialized = true;
    initConversation();
  }

  /* ── Events ── */
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = chatInput.value.trim();
    if (!v || pending) return;
    chatInput.value = "";
    resizeInput();
    chatSend.disabled = true;
    sendMessage(v);
  });

  chatInput.addEventListener("input", () => {
    resizeInput();
    chatSend.disabled = pending || !chatInput.value.trim();
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  // New chat button — add to header if exists
  const newChatBtn = $("#chat-new-btn");
  if (newChatBtn) newChatBtn.addEventListener("click", resetChat);

  window.__rebindChatWidget = rebindChatWidget;
})();
