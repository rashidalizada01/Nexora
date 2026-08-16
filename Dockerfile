FROM nginx:alpine

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy static frontend assets directly to Nginx web root
COPY . /usr/share/nginx/html

# Remove the Dockerfile itself and entrypoint from served web assets
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Entrypoint runs as root to substitute env vars, then nginx worker drops to nginx user
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
