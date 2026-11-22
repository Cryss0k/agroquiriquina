from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True

# En desarrollo la documentación de la API es pública (Swagger en /api/docs/).
SPECTACULAR_SETTINGS = {**SPECTACULAR_SETTINGS,  # noqa: F405
                        "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"]}
