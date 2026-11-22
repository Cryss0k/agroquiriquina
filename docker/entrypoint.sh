#!/usr/bin/env sh
set -e
# El repo puede no versionar migraciones: se generan solo si faltan.
for app in users inventory sales hr; do
  if ! ls "apps/$app/migrations/0"*.py >/dev/null 2>&1; then
    python manage.py makemigrations --noinput "$app"
  fi
done
python manage.py migrate --noinput
exec "$@"
