from datetime import date

from rest_framework.test import APITestCase

from apps.users.models import Rol, Trabajador, User

from .models import Remuneracion


class ExportarRemuneracionesTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("adm_hr", password="x12345678", rol=Rol.ADMINISTRADOR)
        self.vendedor = User.objects.create_user("vend_hr", password="x12345678", rol=Rol.VENDEDOR)
        t = Trabajador.objects.create(rut="11111111-1", nombre="=CMD Peligroso", tarifa_diaria=25000)
        Remuneracion.objects.create(trabajador=t, periodo_inicio=date(2026, 1, 1),
                                    periodo_fin=date(2026, 1, 31))

    def test_admin_descarga_csv(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/v1/remuneraciones/exportar/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])
        texto = r.content.decode("utf-8-sig")
        lineas = texto.strip().splitlines()
        self.assertEqual(len(lineas), 2)
        self.assertTrue(lineas[0].startswith("Trabajador;RUT"))
        self.assertIn("'=CMD Peligroso", lineas[1])  # fórmula neutralizada

    def test_vendedor_no_puede_exportar(self):
        self.client.force_authenticate(self.vendedor)
        self.assertEqual(self.client.get("/api/v1/remuneraciones/exportar/").status_code, 403)
