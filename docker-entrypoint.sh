#!/bin/sh
set -e

if [ -n "$PUBLIC_HOST" ]; then
  find /usr/share/nginx/html -type f \( -name "*.html" -o -name "*.js" \) \
    -exec sed -i "s|__PUBLIC_HOST__|${PUBLIC_HOST}|g" {} +
fi

exec "$@"
