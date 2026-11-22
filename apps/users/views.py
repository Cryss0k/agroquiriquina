from django.db.models import BooleanField, Case, F, IntegerField, Value, When
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.core.permissions import HasRole, SUPERVISOR, VENDEDOR
from apps.core.viewsets import SyncModelViewSet

from .authentication import AppTokenRefreshSerializer, LOCKED_ACCOUNT
from .models import Cliente, Proveedor, Trabajador, User
from .serializers import (
    ClienteSerializer,
    LoginSerializer,
    LoginTokenSerializer,
    ProveedorSerializer,
    TrabajadorSerializer,
    UserSerializer,
)

MAX_LOGIN_ATTEMPTS = 3
INVALID_CREDENTIALS = "Usuario o contraseña incorrectos."


class ClienteViewSet(SyncModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    read_roles = [VENDEDOR]
    write_roles = [VENDEDOR]
    search_fields = ["nombre", "rut", "razon_social"]
    filterset_fields = ["tipo", "comuna"]


class ProveedorViewSet(SyncModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    read_roles = [VENDEDOR]
    write_roles = []          # solo administrador
    search_fields = ["nombre", "rut", "rubro"]


class TrabajadorViewSet(SyncModelViewSet):
    queryset = Trabajador.objects.all()
    serializer_class = TrabajadorSerializer
    read_roles = [SUPERVISOR]
    write_roles = [SUPERVISOR]
    search_fields = ["nombre", "rut"]
    filterset_fields = ["tipo_contrato", "activo"]


class UserViewSet(viewsets.ModelViewSet):
    """Gestión de usuarios del sistema: solo administrador."""
    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasRole]
    read_roles = []
    write_roles = []

    @action(detail=True, methods=["post"], url_path="desbloquear")
    def desbloquear(self, request, pk=None):
        user = self.get_object()
        user.intentos_fallidos = 0
        user.bloqueado = False
        user.save(update_fields=["intentos_fallidos", "bloqueado"])
        return Response(UserSerializer(user).data)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: LoginTokenSerializer,
            401: OpenApiResponse(description="Usuario o contraseña incorrectos."),
            423: OpenApiResponse(description="La cuenta está bloqueada."),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": INVALID_CREDENTIALS}, status=status.HTTP_401_UNAUTHORIZED)
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        user = User.objects.filter(username=username).first()
        if user is None or not user.is_active:
            return Response({"detail": INVALID_CREDENTIALS}, status=status.HTTP_401_UNAUTHORIZED)
        if user.bloqueado:
            return Response({"detail": LOCKED_ACCOUNT}, status=status.HTTP_423_LOCKED)
        if not user.check_password(password):
            User.objects.filter(pk=user.pk, bloqueado=False).update(
                intentos_fallidos=Case(
                    When(intentos_fallidos__gte=MAX_LOGIN_ATTEMPTS - 1, then=Value(MAX_LOGIN_ATTEMPTS)),
                    default=F("intentos_fallidos") + 1,
                    output_field=IntegerField(),
                ),
                bloqueado=Case(
                    When(intentos_fallidos__gte=MAX_LOGIN_ATTEMPTS - 1, then=Value(True)),
                    default=Value(False),
                    output_field=BooleanField(),
                ),
            )
            user.refresh_from_db(fields=["intentos_fallidos", "bloqueado"])
            if user.bloqueado:
                return Response({"detail": LOCKED_ACCOUNT}, status=status.HTTP_423_LOCKED)
            return Response({"detail": INVALID_CREDENTIALS}, status=status.HTTP_401_UNAUTHORIZED)

        User.objects.filter(pk=user.pk, bloqueado=False).update(intentos_fallidos=0)
        user.refresh_from_db(fields=["intentos_fallidos", "bloqueado"])
        if user.bloqueado:
            return Response({"detail": LOCKED_ACCOUNT}, status=status.HTTP_423_LOCKED)

        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class AppTokenRefreshView(TokenRefreshView):
    serializer_class = AppTokenRefreshSerializer


class MeView(APIView):
    """Datos del usuario autenticado (la app lo usa para decidir qué pantallas mostrar)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "id": u.id,
            "username": u.username,
            "nombre": u.get_full_name() or u.username,
            "rol": u.rol,
            "persona": str(u.persona_id) if u.persona_id else None,
        })
