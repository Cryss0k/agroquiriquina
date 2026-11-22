from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User

LOCKED_ACCOUNT = "Cuenta bloqueada. Contacta a un administrador para desbloquearla."


class AppJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.bloqueado:
            raise AuthenticationFailed(LOCKED_ACCOUNT, code="user_locked")
        return user


class AppTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        try:
            user = User.objects.get(
                **{api_settings.USER_ID_FIELD: refresh[api_settings.USER_ID_CLAIM]}
            )
        except (KeyError, User.DoesNotExist) as exc:
            raise InvalidToken("Token de renovación inválido.") from exc
        if user.bloqueado:
            raise InvalidToken(LOCKED_ACCOUNT)
        return super().validate(attrs)
