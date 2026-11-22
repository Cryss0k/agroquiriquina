from drf_spectacular.extensions import OpenApiAuthenticationExtension


class AppJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.users.authentication.AppJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
