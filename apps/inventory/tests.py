from decimal import Decimal

from rest_framework.test import APITestCase

from .models import ProductoVenta
from apps.users.models import Rol, User


class ProductoVentaEdicionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin_inventory", password="x12345678", rol=Rol.ADMINISTRADOR)
        self.client.force_authenticate(self.admin)
        self.producto = ProductoVenta.objects.create(
            nombre="Papa", categoria="PAPA", variedad="Desirée",
            precio_referencia=10000, costo_unitario=5000,
        )

    def test_admin_actualiza_datos_comerciales_y_costo_del_producto(self):
        response = self.client.patch(f"/api/v1/productos/{self.producto.pk}/", {
            "nombre": "Papa nueva", "categoria": "PAPA", "variedad": "Cardinal",
            "precio_referencia": 12000, "costo_unitario": 6500,
            "unidad_medida": "SACO", "stock_minimo": "4",
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, "Papa nueva")
        self.assertEqual(self.producto.precio_referencia, Decimal("12000"))
        self.assertEqual(self.producto.costo_unitario, Decimal("6500"))
