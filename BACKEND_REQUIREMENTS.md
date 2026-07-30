# Nexora Academy — inteqrasiya auditi və Backend Tələbləri

Tarix: 2026-07-25

Əsas mənbələr:

- `D:\Downloads\Nexora Academy Public Website .docx`
- `D:\Downloads\Nexora Academy Frontend.docx`
- `D:\Downloads\Nexora Academy Student Cabinet.docx`

Bu layihədə backend mənbə kodu yoxdur. Aşağıdakı nəticələr sənədlərdə audit edilmiş faktiki controller, DTO, servis və security davranışına əsaslanır. Frontend filtri müdafiə qatıdır, təhlükəsizlik sərhədi deyil.

## Tətbiq edilən təhlükəsiz frontend əhatəsi

| Ekran/axın | Sənəd statusu | Bu dəyişiklikdə edilən |
|---|---|---|
| Home kurs/kateqoriya preview | Partial | Public görünürlük guard-ından keçən kurs və kateqoriyalar mövcud dizayn komponentləri ilə göstərilir |
| Course Catalog/Search | Guarded | `published=true`, `active=true`, URL filter/page state, `archived=false`, validity və aktiv category ancestor yoxlaması tətbiq edildi |
| Category Directory | Guarded | Aktiv parent chain, orphan və cycle müdafiəsi ilə yaradıldı |
| Category Detail | Partial | Numeric `id` lookup, aktivlik guard-ı, alt kateqoriya və public kurs aggregation-u yaradıldı |
| Course Detail | Partial/Guarded | UUID nəticəsi render-dən əvvəl public guard-dan keçirilir; daxili visibility səbəbi açıqlanmır |
| Related Courses | Composite | Maksimum üç `relatedCourseIds` ayrıca çağırılır və hər biri public guard-dan keçirilir |
| Public Reviews | Blocked | Unsafe qlobal review fetch və uyğunluğu sübut olunmayan review submit dayandırıldı |
| Enrollment Start | Partial | Student role/status gate, məlum group ID utility-si, versioned consent və davamlı idempotency key tətbiq edildi |
| Student Overview | Partial/Composite | Profil, public kurslar və yalnız yadda saxlanmış/ownership-safe enrollment ID-ləri birləşdirildi |
| Profile | Supported/Partial | Email read-only edildi, email PATCH-dən çıxarıldı, raw profile JSON gizlədildi və PATCH-dən çıxarıldı |
| Account status states | Frontend-required | `PENDING_VERIFICATION`, `SUSPENDED`, `DEACTIVATED`, `BANNED` üçün təhlükəsiz gate yaradıldı |
| Role landing | Composite | Student, Sales CRM, Content Manager, Admin və System Admin üçün rol əsaslı yönləndirmə yaradıldı |
| Contact/newsletter/application | Blocked | Backend təsdiqi olmadan localStorage-a yazma və saxta uğur mesajları dayandırıldı |

## Public Website ekran inventarı

| Modul | Status | Qərar |
|---|---|---|
| Home | P0 Partial | Kurs/kateqoriya hissəsi dinamikdir; CMS-siz legacy məzmun dəyişdirilmədi |
| Course Catalog | P0 Guarded | Tətbiq edildi; server-side enforcement yenə P0 tələbdir |
| Course Search Results | P0 Guarded | Kataloq daxilində query/filter/page URL state ilə tətbiq edildi |
| Category Directory | P1 Guarded | Tətbiq edildi |
| Category Detail | P1 Partial | Numeric ID ilə tətbiq edildi; slug route backend tələbidir |
| Course Detail | P0 Partial/Guarded | UUID ilə guard edilmiş variant tətbiq edildi; slug route backend tələbidir |
| Course Availability/Cohorts | P0 Blocked | UI axını qurulmadı; public-safe group contract yoxdur |
| Enrollment Start | P0 Partial | Yalnız məlum group ID utility-si saxlanıldı; normal cohort seçimi kimi təqdim edilmir |
| Course Comparison | P2 Composite/Optional | Bu paketə daxil edilmədi |
| About | P1 Static/CMS-blocked | Mövcud statik məzmun saxlanıldı |
| FAQ | P1 Static/CMS-blocked | Təsdiqli məzmun verilmədiyi üçün yeni mətn yaradılmadı |
| Instructor Directory/Detail | P1 Blocked | Yaradılmadı |
| Public Reviews | P1 Blocked | Yaradılmadı; unsafe inteqrasiya deaktiv edildi |
| Graduate Outcomes | P1/P2 Blocked | Yaradılmadı |
| Scholarships | P1 Blocked | Yaradılmadı |
| Campaign Landing | P2 Blocked | Yaradılmadı |
| Contact | P0 Blocked submission | Forma saxlanıldı, lakin məlumat göndərilmiş kimi göstərilmir |
| Demo/Syllabus/Newsletter | P1/P2 Blocked | Simulyasiya edilmir |
| Legal Center/Privacy/Terms/Policy | Static | Təsdiqlənmiş hüquqi mətn verilmədiyi üçün məzmun uydurulmadı |
| Cookie Preferences | Frontend/static | Bu paketə daxil edilmədi |
| 404/offline/error/rate-limit/no-results | Frontend | Mövcud axınlarda təhlükəsiz error/no-result state-ləri tətbiq edildi; ayrıca route-lar yaradılmadı |

Public kurs görünürlük qaydası:

```text
published === true
active === true
archived === false
validFrom yoxdur və ya artıq çatıb
validUntil yoxdur və ya keçməyib
category və bütün parent-ləri active === true
```

## Student Cabinet ekran inventarı

| Modul | Status | Qərar |
|---|---|---|
| Foundation bootstrap/role/status | Supported + frontend-only | Refresh → `/users/me` → role/status gate tətbiq edildi |
| Overview | Partial/Composite | Təhlükəsiz mövcud məlumatlarla minimal overview yaradıldı |
| Action Center/Important Dates | Blocked/Composite | Saxta aggregation/calendar yaradılmadı |
| Browse Courses | Supported/Guarded | Public course guard ilə mövcuddur |
| Course Detail | Partial/Guarded | Public-safe sahələr və guard ilə mövcuddur |
| Group List/Detail | P0 Blocked | Student üçün endpoint/icazə yoxdur; UI yaradılmadı |
| Create Enrollment | Partial | Yalnız etibarlı məlum group ID ilə utility; idempotency retry qorunur |
| Enrollment Review/Success | Partial | Enriched course/group/payment məlumatı olmadığı üçün genişləndirilmədi |
| My Enrollments | Blocked | `/enrollments/me` olmadığı üçün yalnız local məlum ID-lər ownership-safe detail ilə göstərilir |
| Enrollment Detail/Cancel | Supported/Partial | Known ID detail və konservativ cancellation allowlist tətbiq edildi |
| Waitlist/Hold | Incomplete | Status göstərilə bilər; workflow uydurulmadı |
| Payments | Blocked | Checkout/history/detail/refund/receipt UI-si yaradılmadı |
| My Reviews | Unsafe/Blocked | Qlobal list və arbitrary review create istifadə edilmir |
| Notifications | Blocked | Yaradılmadı |
| Scholarships | Blocked | Yaradılmadı |
| Profile | Supported/Partial | Təhlükəsiz sahələr və password change mövcuddur |
| Security sessions/devices | Blocked | Yaradılmadı |
| Help/Policies | Frontend/static/Partial | Təsdiqli hüquqi məzmun olmadığı üçün uydurulmadı |

Student Cabinet LMS deyil. Dərs player-i, tapşırıq, quiz/imtahan, qiymət, davamiyyət, sertifikat, learning progress, forum, direct chat, AI tutor və canlı sinif funksiyaları qəsdən əlavə edilməyib.

## Rol əsaslı panel inventarı

### Content Manager

- Qlobal enrollment UI-si qəsdən yoxdur.
- Categories, Courses, Teaching Assignments və Course Groups: Supported/Composite.
- Instructors və Graduate Outcomes: linked-user/student lookup səbəbindən Partial.
- CMS və Knowledge Base CRUD: Supported; public preview Partial/Blocked.
- Reviews CRUD: Supported/unsafe list; publish/unpublish Blocked.

### Sales CRM

- Leads, Contact Submissions, Chat Sessions və Campaigns: əsas CRUD/list/detail Supported/Partial.
- Lead status və End Chat: controller endpoint-i olmadığı üçün Blocked.
- Global enrollments: rol üçün Supported, lakin user/group lookup olmadığı üçün create və ad resolution Partial.
- Global user/course-group/instructor/assignable-staff seçiciləri qəsdən göstərilmir.

### Admin/System Admin

- Users: Supported; self-demotion/deactivation və yüksək rol guard-ları tələb olunur.
- Payments: CRUD/Capture Supported; Refund Blocked.
- Scholarships: staff CRUD Supported; student application lifecycle Blocked.
- Notifications: record CRUD Supported; real send/read əməliyyatları Blocked.
- OAuth/session record create/edit: internal/high-risk, adi UI-də qəsdən göstərilmir.
- Audit list/detail: Supported; manual mutation governance təsdiqi olmadan göstərilmir.
- Health: Supported; diagnostics Composite/Internal.

## Backend Tələbləri

### P0 — əsas public və student journey

1. Server tərəfindən enforce edilən public course list/detail:
   - yalnız published, active, non-archived və qüvvədə olan kurslar;
   - yalnız aktiv category ancestor chain;
   - public-safe DTO;
   - allowlisted sort/filter;
   - gizli kurs üçün vahid `404`.
2. `GET /api/v1/public/courses/{slug}` — exact public course-by-slug.
3. `GET /api/v1/public/categories/{slug}` — exact public category-by-slug və active ancestor enforcement.
4. Student/public-safe course-group collection/detail:
   - course filter;
   - yalnız enrollable/OPEN groups;
   - deadline, timezone, stabil schedule DTO;
   - remaining seats;
   - pagination/bounded response.
5. `GET /api/v1/enrollments/me` — ownership-safe, paginated və course/group summary ilə enriched.
6. Student checkout/payment:
   - server-calculated amount;
   - payment method discovery/initiation;
   - owned history/detail;
   - signed provider callback;
   - payment capture ilə enrollment confirmation-un transactional/event-driven əlaqəsi.
7. Anonymous contact endpoint:
   - rate limit, CAPTCHA/anti-bot;
   - consent version/time;
   - source attribution;
   - duplicate/IP-abuse qoruması;
   - PII-safe response.
8. Public-safe published review endpoint:
   - course filter və pagination;
   - safe reviewer identity;
   - verified marker;
   - rating aggregate/distribution;
   - unpublished/internal sahələrin response-dan çıxarılması.

### P1 — enrollment bütövlüyü və public trust

1. Enrollment zamanı group status `OPEN`, course visibility/validity, eligibility və prerequisites enforcement.
2. Formal enrollment transition state machine.
3. Seat hold expiry, cleanup, seat release, notification və payment revalidation.
4. Versioned consent endpoint-i və enrollment üçün məcburi consent sahələri.
5. Public instructor list/detail/assignments — `userId`-siz safe DTO və stabil slug.
6. Public graduate outcomes — yalnız `publicStory=true`, private story üçün `404`.
7. Applications array-sız public scholarship DTO.
8. Published-only CMS by exact key/type/locale, sanitization və internal `updatedBy`-sız response.
9. Stabil course-content və media schema-ları.
10. Demo, syllabus və newsletter lifecycle endpoint-ləri.

### P2 — Student Cabinet

1. `GET /api/v1/course-reviews/me`.
2. Owner-safe review detail və immutable identity DTO.
3. Review yaratmada enrollment owner, course match, `COMPLETED` və duplicate yoxlaması.
4. My Notifications, unread count, mark-one/all-read və stabil payload contract.
5. Formal scholarship application entity/workflow, document upload və ownership.
6. My active login sessions, revoke-one və revoke-all-other.
7. Secure email change + re-verification.
8. Password change-dən sonra digər session-ların revoke edilməsi.
9. Typed profile schema və partial nested update.
10. Dashboard/action/date aggregation.
11. Student receipt və refund request/eligibility.

### P3 — staff əməliyyatları

1. Sales CRM/Content Manager üçün scope-lanmış safe user lookup.
2. Sales CRM üçün enrollable course-group lookup.
3. Assignable staff və instructor/graduate lookup-ları.
4. Lead status controller endpoint-i.
5. End Chat controller endpoint-i.
6. Review publish/unpublish endpoint-ləri.
7. Payment refund endpoint-i.
8. Notification mark-sent/mark-read endpoint-ləri.
9. Dedicated session revoke endpoint-i.
10. Böyük listlər üçün pagination/search/filter.
11. Typed JSON field schema-ları və media upload.
12. Immutable audit-log governance siyasəti.

## Qəsdən edilməyənlər

- Backend kodu workspace-də olmadığı və ayrıca icazə verilmədiyi üçün backend dəyişdirilməyib.
- Blocked ekranlar uğurlu işləyirmiş kimi simulyasiya edilməyib.
- Internal payment callback, OAuth token mutation, session record mutation və audit mutation UI-ləri yaradılmayıb.
- Legacy Projects/News/Careers naviqasiyası silinməyib və məzmunu yenidən qurulmayıb; bu, mövcud struktur və dizayna toxunmamaq tələbi ilə ziddiyyət təşkil edərdi.
- Heç bir CSS, theme token, breakpoint, ölçü, rəng, font və animasiya dəyişdirilməyib.
