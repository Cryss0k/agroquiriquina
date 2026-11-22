from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.users.views import AppTokenRefreshView, LoginView


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Ping liviano para que la app móvil detecte si hay conexión con el servidor."""
    return Response({"status": "ok"})


def front(name, *, built=False):
    """Sirve el build de Vite y los recursos PWA que deben colgar de la raíz."""
    root = settings.BASE_DIR / "frontend"
    if built:
        root /= "dist"
    return lambda request: serve(request, name, document_root=root)


urlpatterns = [
    path("", front("index.html", built=True), name="app"),
    path("sw.js", front("sw.js"), name="sw"),
    path("manifest.json", front("manifest.json"), name="manifest"),
    path("admin/", admin.site.urls),
    path("api/v1/health/", health, name="health"),
    path("api/v1/auth/token/", LoginView.as_view(), name="token_obtain"),
    path("api/v1/auth/token/refresh/", AppTokenRefreshView.as_view(), name="token_refresh"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/v1/sync/", include("apps.sync.urls")),
    path("api/v1/", include("apps.users.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.sales.urls")),
    path("api/v1/", include("apps.hr.urls")),
]
