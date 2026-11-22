import os

from .base import *  # noqa
from .base import env_bool, env_list

DEBUG = False

if SECRET_KEY == "dev-insecure-key-change-me":  # noqa: F405
    raise RuntimeError("Define DJANGO_SECRET_KEY en producción.")

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

# Con HTTPS (por defecto) todo es "secure". Para probar en http local: SECURE_SSL_REDIRECT=False.
_SSL = env_bool("SECURE_SSL_REDIRECT", True)
SECURE_SSL_REDIRECT = _SSL
SESSION_COOKIE_SECURE = _SSL
CSRF_COOKIE_SECURE = _SSL
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if _SSL:
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "3600"))
