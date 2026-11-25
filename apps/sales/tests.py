from datetime import date
from decimal import Decimal
import uuid

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.inventory.models import ProductoVenta
from apps.inventory.models import InsumoAgricola
from apps.users.models import Cliente, Proveedor, Rol, User

from .models import Despacho, Pago, Venta
from .services import registrar_venta

PASSWORD = "x12345678"


class VentasFlujoTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin_t", password=PASSWORD, rol=Rol.ADMINISTRADOR)
        self.vendedor = User.objects.create_user("vend_t", password=PASSWORD, rol=Rol.VENDEDOR)
        self.cliente = Cliente.objects.create(rut="11111111-1", nombre="Cliente Test")
        self.producto = ProductoVenta.objects.create(
            nombre="Papa", categoria="PAPA", cantidad_disponible=Decimal("100"),
            precio_referencia=10000, costo_unitario=3000)
        # Venta de 10 x 10.000 = 100.000, con despacho programado
        self.venta = registrar_venta({
            "cliente": self.cliente,
            "vendedor": self.vendedor,
            "fecha": timezone.now(),
            "detalles": [{"producto": self.producto, "cantidad": Decimal("10"),
                          "precio_unitario": 10000}],
            "despacho": {"fecha": date(2026, 1, 16), "direccion": "Av. Test 123",
                         "comuna": "Chillán"},
        })

    # --- marcar-revisada -------------------------------------------------
    def test_admin_puede_marcar_revisada(self):
        Venta.objects.filter(pk=self.venta.pk).update(requiere_revision=True)
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"/api/v1/ventas/{self.venta.pk}/marcar-revisada/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIs(r.data["requiere_revision"], False)
        self.venta.refresh_from_db()
        self.assertFalse(self.venta.requiere_revision)

    def test_vendedor_no_puede_marcar_revisada(self):
        Venta.objects.filter(pk=self.venta.pk).update(requiere_revision=True)
        self.client.force_authenticate(self.vendedor)
        r = self.client.post(f"/api/v1/ventas/{self.venta.pk}/marcar-revisada/")
        self.assertEqual(r.status_code, 403)
        self.venta.refresh_from_db()
        self.assertTrue(self.venta.requiere_revision)

    # --- abonos ----------------------------------------------------------
    def test_abonos_actualizan_saldo_y_estado_pago(self):
        self.client.force_authenticate(self.vendedor)
        url = "/api/v1/pagos/"

        r1 = self.client.post(url, {"venta": str(self.venta.pk), "monto": 40000,
                                    "metodo": "EFECTIVO", "estado": "PAGADO"}, format="json")
        self.assertEqual(r1.status_code, 201, r1.data)
        v = Venta.objects.get(pk=self.venta.pk)
        self.assertEqual(v.saldo_pendiente, Decimal("60000"))
        self.assertEqual(v.estado_pago, Pago.Estado.PARCIAL)
        det = self.client.get(f"/api/v1/ventas/{v.pk}/")
        self.assertEqual(det.data["estado_pago"], "PARCIAL")
        self.assertEqual(Decimal(det.data["saldo_pendiente"]), Decimal("60000"))

        r2 = self.client.post(url, {"venta": str(self.venta.pk), "monto": 60000,
                                    "metodo": "TRANSFERENCIA", "estado": "PAGADO"}, format="json")
        self.assertEqual(r2.status_code, 201, r2.data)
        v = Venta.objects.get(pk=self.venta.pk)
        self.assertEqual(v.saldo_pendiente, Decimal("0"))
        self.assertEqual(v.estado_pago, Pago.Estado.PAGADO)
        det = self.client.get(f"/api/v1/ventas/{v.pk}/")
        self.assertEqual(det.data["estado_pago"], "PAGADO")
        self.assertEqual(Decimal(det.data["saldo_pendiente"]), Decimal("0"))

    # --- despachos -------------------------------------------------------
    def test_patch_despacho_cambia_estado_y_transportista(self):
        self.client.force_authenticate(self.vendedor)
        despacho = Despacho.objects.get(venta=self.venta)
        self.assertEqual(despacho.estado, Despacho.Estado.PROGRAMADO)

        r = self.client.patch(f"/api/v1/despachos/{despacho.pk}/", {
            "estado": "EN_RUTA", "transportista": "Transportes Sur", "patente": "AB1234",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, Despacho.Estado.EN_RUTA)
        self.assertEqual(despacho.transportista, "Transportes Sur")
        self.assertEqual(despacho.patente, "AB1234")

        r = self.client.patch(f"/api/v1/despachos/{despacho.pk}/",
                              {"estado": "ENTREGADO"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, Despacho.Estado.ENTREGADO)

    def test_venta_con_despacho_exige_hora_y_vincula_receptor(self):
        self.client.force_authenticate(self.vendedor)
        payload = {
            "id": str(uuid.uuid4()), "cliente": str(self.cliente.pk),
            "fecha": timezone.now().isoformat(),
            "detalles": [{"producto": str(self.producto.pk), "cantidad": "1", "precio_unitario": 10000}],
            "despacho": {"id": str(uuid.uuid4()), "fecha": "2026-02-10",
                         "direccion": "Av. Central 123", "comuna": "Chillán"},
        }
        missing_time = self.client.post("/api/v1/ventas/", payload, format="json")
        self.assertEqual(missing_time.status_code, 400, missing_time.data)

        payload["despacho"]["hora"] = "14:30"
        response = self.client.post("/api/v1/ventas/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        dispatch = Despacho.objects.get(venta_id=payload["id"])
        self.assertEqual(dispatch.fecha, date(2026, 2, 10))
        self.assertEqual(dispatch.hora.strftime("%H:%M"), "14:30")
        self.assertEqual(dispatch.venta.cliente_id, self.cliente.pk)

    def test_reporte_por_periodo_cruza_ventas_compras_y_margen_por_producto(self):
        self.client.force_authenticate(self.admin)
        report_date = timezone.localdate(self.venta.fecha)
        proveedor = Proveedor.objects.create(rut="22345678-5", nombre="Proveedor de prueba")
        insumo = InsumoAgricola.objects.create(nombre="Fertilizante", tipo="FERTILIZANTE")
        purchase_response = self.client.post("/api/v1/compras/", {
            "proveedor": str(proveedor.pk), "fecha": self.venta.fecha.isoformat(),
            "detalles": [{"insumo": str(insumo.pk), "cantidad": "2", "costo_unitario": "10000"}],
        }, format="json")
        self.assertEqual(purchase_response.status_code, 201, purchase_response.data)

        response = self.client.get(
            f"/api/v1/finanzas/rentabilidad/?desde={report_date}&hasta={report_date}")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Decimal(response.data["ventas_totales"]), Decimal("100000"))
        self.assertEqual(Decimal(response.data["gastos_compras"]), Decimal("20000"))
        self.assertEqual(Decimal(response.data["costo_productos"]), Decimal("30000"))
        self.assertEqual(Decimal(response.data["resultado_neto"]), Decimal("50000"))
        self.assertEqual(response.data["productos"][0]["nombre"], "Papa")
        self.assertEqual(Decimal(response.data["productos"][0]["utilidad"]), Decimal("70000"))

    def test_reporte_no_inventa_utilidad_si_falta_costo_unitario(self):
        self.client.force_authenticate(self.admin)
        self.producto.costo_unitario = None
        self.producto.save(update_fields=["costo_unitario", "updated_at"])
        report_date = timezone.localdate(self.venta.fecha)
        response = self.client.get(
            f"/api/v1/finanzas/rentabilidad/?desde={report_date}&hasta={report_date}")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["resultado_neto"])
        self.assertEqual(response.data["productos_sin_costo"], 1)
        self.assertIsNone(response.data["productos"][0]["utilidad"])
