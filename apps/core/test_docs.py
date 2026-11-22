from rest_framework.test import APITestCase

from apps.users.models import Rol, User


class DocumentacionApiTests(APITestCase):
    def test_esquema_openapi_solo_admin(self):
        self.assertIn(self.client.get("/api/schema/").status_code, (401, 403))
        User.objects.create_superuser("root_doc", password="x12345678", rol=Rol.ADMINISTRADOR)
        self.client.force_authenticate(User.objects.get(username="root_doc"))
        r = self.client.get("/api/schema/")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"AgroQuiriquina API", r.content)
