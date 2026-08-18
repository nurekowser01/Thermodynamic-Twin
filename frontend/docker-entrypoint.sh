#!/bin/sh
set -e
export PORT="${PORT:-80}"
export BACKEND_URL="${BACKEND_URL:-http://backend:8749}"
export LLM_URL="${LLM_URL:-http://llm-advisor:11435}"
# Strip trailing slash so proxy_pass ${URL}/ is valid
BACKEND_URL="${BACKEND_URL%/}"
LLM_URL="${LLM_URL%/}"
envsubst '${PORT} ${BACKEND_URL} ${LLM_URL}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
