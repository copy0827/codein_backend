#!/bin/sh
set -e

if [ ! -d "/app/frontend" ]; then
  echo "Frontend source not mounted."
  exit 1
fi

cd /app/frontend

if [ ! -d "node_modules" ]; then
  npm ci
fi

npm run build

rm -rf /usr/share/nginx/html/*
cp -r dist/* /usr/share/nginx/html/

exec "$@"
