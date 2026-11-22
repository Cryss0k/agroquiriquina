from datetime import date, time, timedelta
from decimal import Decimal
from uuid import UUID

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.hr.models import Desempeno, Remuneracion
from apps.inventory.models import InsumoAgricola, MovimientoStock, ProductoVenta
from apps.inventory.services import aplicar_movimiento
from apps.sales.models import Despacho, Pago, Venta
from apps.sales.services import registrar_venta
from apps.users.models import Cliente, Proveedor, Rol, Trabajador, User

DEFAULT_PASSWORD = "Cambiar123!"


def _dv(cuerpo: int) -> str:
    """Dígito verificador de un RUT chileno (módulo 11)."""
    suma, mult = 0, 2
    for d in reversed(str(cuerpo)):
        suma += int(d) * mult
        mult = 2 if mult == 7 else mult + 1
    resto = 11 - (suma % 11)
    return "0" if resto == 11 else "K" if resto == 10 else str(resto)


def rut(cuerpo: int) -> str:
    return f"{cuerpo}-{_dv(cuerpo)}"


# username, rol, nombre, apellido, descripción, es_superusuario, activo, RUT-cuerpo (si es trabajador)
USUARIOS_DEMO = [
    ("admin",       Rol.ADMINISTRADOR,    "Administrador", "Sistema",  "Superusuario: todo + panel /admin/", True,  True, None),
    ("gerente",     Rol.ADMINISTRADOR,    "Rodrigo",       "Fuentes",  "Rol ADMIN sin ser superusuario",     False, True, None),
    ("vendedor1",   Rol.VENDEDOR,         "María",         "González", "Vendedora (solo ve sus ventas)",     False, True, None),
    ("vendedor2",   Rol.VENDEDOR,         "Pedro",         "Soto",     "Vendedor (para probar aislamiento)", False, True, None),
    ("supervisor1", Rol.SUPERVISOR_TERRENO, "Carlos",      "Muñoz",    "Jefe de cuadrilla (terreno)",        False, True, 12345678),
    ("supervisor2", Rol.SUPERVISOR_TERRENO, "Ana",         "Rojas",    "Supervisora de bodega/terreno",      False, True, 13456789),
    ("inactivo",    Rol.VENDEDOR,         "Usuario",       "Bloqueado", "Cuenta desactivada: el login debe fallar", False, False, None),
]


class Command(BaseCommand):
    help = "Crea usuarios de prueba (uno o más por rol) y datos de ejemplo para probar la API."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=DEFAULT_PASSWORD,
                            help=f"Clave para los usuarios demo (por defecto {DEFAULT_PASSWORD}).")
        parser.add_argument("--reset", action="store_true",
                            help="Restablece clave, rol y estado de los usuarios demo que ya existen.")

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]
        reset = options["reset"]

        for username, rol, nombre, apellido, _desc, es_super, activo, rut_cuerpo in USUARIOS_DEMO:
            persona = None
            if rut_cuerpo:  # supervisores de terreno: también existen como Trabajador
                persona, _ = Trabajador.objects.get_or_create(rut=rut(rut_cuerpo), defaults={
                    "nombre": f"{nombre} {apellido}", "tipo_contrato": "INDEFINIDO",
                    "cargo": "Supervisor de terreno", "tarifa_diaria": 35000})

            defaults = {"rol": rol, "first_name": nombre, "last_name": apellido,
                        "email": f"{username}@agroquiriquina.local", "is_active": activo,
                        "is_staff": es_super, "is_superuser": es_super, "persona": persona}
            user, created = User.objects.get_or_create(username=username, defaults=defaults)
            if created or reset:
                if reset:
                    for campo, valor in defaults.items():
                        setattr(user, campo, valor)
                user.set_password(password)
                user.save()

        productos = [
            ("Papa Desirée", "PAPA", "Desirée", 500, 12000),
            ("Papa Cardinal", "PAPA", "Cardinal", 300, 11000),
            ("Trigo", "TRIGO", "", 200, 18000),
            ("Avena", "AVENA", "", 100, 15000),
            ("Maíz", "MAIZ", "", 100, 16000),
        ]
        for nombre, cat, variedad, stock, precio in productos:
            ProductoVenta.objects.get_or_create(nombre=nombre, defaults={
                "categoria": cat, "variedad": variedad, "unidad_medida": "SACO",
                "cantidad_disponible": Decimal(stock), "stock_minimo": Decimal(20),
                "precio_referencia": precio, "peso_saco_kg": Decimal("25")})

        InsumoAgricola.objects.get_or_create(nombre="Urea", defaults={
            "tipo": "FERTILIZANTE", "unidad_medida": "SACO",
            "cantidad_disponible": Decimal(80), "dosis_por_hectarea": Decimal("6")})
        InsumoAgricola.objects.get_or_create(nombre="Semilla de papa", defaults={
            "tipo": "SEMILLA", "unidad_medida": "SACO",
            "cantidad_disponible": Decimal(400), "dosis_por_hectarea": Decimal("60")})

        Cliente.objects.get_or_create(rut="11111111-1", defaults={
            "nombre": "Feria Lo Valledor", "tipo": "MAYORISTA", "telefono": "+56911111111",
            "comuna": "Pedro Aguirre Cerda", "limite_credito": 2000000})
        Cliente.objects.get_or_create(rut="22222222-2", defaults={
            "nombre": "Almacén Don Pedro", "tipo": "MINORISTA", "telefono": "+56922222222",
            "comuna": "Chillán"})
        Proveedor.objects.get_or_create(rut="44444444-4", defaults={
            "nombre": "Agroinsumos del Sur", "rubro": "Fertilizantes"})

        for cuerpo, nombre in [(33333333, "Juan Pérez"), (15234567, "Luisa Campos"),
                               (16345678, "José Navarro")]:
            Trabajador.objects.get_or_create(rut=rut(cuerpo), defaults={
                "nombre": nombre, "tipo_contrato": "TEMPORERO", "cargo": "Temporero",
                "tarifa_diaria": 25000})

        clientes_demo = []
        for cuerpo, datos in [
            (18987654, {
                "nombre": "Comercial Valle Verde",
                "telefono": "+56961234567",
                "email": "compras@valleverde.example",
                "direccion": "Camino a San Nicolás 1450",
                "comuna": "Chillán",
                "region": "Ñuble",
                "tipo": Cliente.Tipo.MAYORISTA,
                "razon_social": "Comercial Valle Verde SpA",
                "limite_credito": 2500000,
            }),
            (17987654, {
                "nombre": "Agrícola Los Aromos",
                "telefono": "+56962345678",
                "email": "contacto@losaromos.example",
                "direccion": "Ruta N-50, Parcela 12",
                "comuna": "San Carlos",
                "region": "Ñuble",
                "tipo": Cliente.Tipo.FERIA,
                "razon_social": "Agrícola Los Aromos Ltda.",
                "limite_credito": 900000,
            }),
        ]:
            cliente, _ = Cliente.objects.get_or_create(rut=rut(cuerpo), defaults=datos)
            clientes_demo.append(cliente)

        Proveedor.objects.get_or_create(rut=rut(16765432), defaults={
            "nombre": "Distribuidora Campo Sur",
            "telefono": "+56422345678",
            "email": "ventas@camposur.example",
            "direccion": "Av. O'Higgins 850",
            "comuna": "Chillán",
            "region": "Ñuble",
            "rubro": "Semillas, fertilizantes y fitosanitarios",
            "condiciones_pago": "Transferencia a 30 días",
        })

        trabajadores_demo = []
        for cuerpo, datos in [
            (18765432, {
                "nombre": "Patricia Silva",
                "telefono": "+56963456789",
                "email": "patricia.silva@example",
                "direccion": "Pasaje Los Cerezos 220",
                "comuna": "Chillán Viejo",
                "region": "Ñuble",
                "tipo_contrato": Trabajador.TipoContrato.TEMPORERO,
                "cargo": "Cosechadora",
                "tarifa_diaria": 32000,
                "fecha_ingreso": date(2025, 10, 1),
                "activo": True,
            }),
            (17654321, {
                "nombre": "Miguel Riquelme",
                "telefono": "+56964567890",
                "email": "miguel.riquelme@example",
                "direccion": "Camino El Roble 410",
                "comuna": "San Carlos",
                "region": "Ñuble",
                "tipo_contrato": Trabajador.TipoContrato.PLAZO_FIJO,
                "cargo": "Operador de maquinaria",
                "tarifa_diaria": 42000,
                "fecha_ingreso": date(2024, 8, 15),
                "activo": True,
            }),
            (16543210, {
                "nombre": "Daniela Muñoz",
                "telefono": "+56965678901",
                "email": "daniela.munoz@example",
                "direccion": "Los Maitenes 78",
                "comuna": "Pinto",
                "region": "Ñuble",
                "tipo_contrato": Trabajador.TipoContrato.INDEFINIDO,
                "cargo": "Encargada de bodega",
                "tarifa_diaria": 38000,
                "fecha_ingreso": date(2023, 3, 6),
                "activo": True,
            }),
        ]:
            trabajador, _ = Trabajador.objects.get_or_create(rut=rut(cuerpo), defaults=datos)
            trabajadores_demo.append(trabajador)

        producto_ajuste, _ = ProductoVenta.objects.get_or_create(
            nombre="DEMO - Papa semilla de bodega",
            defaults={
                "categoria": ProductoVenta.Categoria.PAPA,
                "variedad": "Semilla certificada",
                "unidad_medida": "SACO",
                "cantidad_disponible": Decimal("0"),
                "stock_minimo": Decimal("8"),
                "precio_referencia": Decimal("14500"),
                "peso_saco_kg": Decimal("25"),
                "activo": True,
            })
        producto_revision, _ = ProductoVenta.objects.get_or_create(
            nombre="DEMO - Papa con stock bajo",
            defaults={
                "categoria": ProductoVenta.Categoria.PAPA,
                "variedad": "Desirée",
                "unidad_medida": "SACO",
                "cantidad_disponible": Decimal("0"),
                "stock_minimo": Decimal("5"),
                "precio_referencia": Decimal("5500"),
                "peso_saco_kg": Decimal("25"),
                "activo": True,
            })
        ProductoVenta.objects.get_or_create(
            nombre="DEMO - Vaquilla",
            defaults={
                "categoria": ProductoVenta.Categoria.GANADO,
                "variedad": "Holstein",
                "unidad_medida": "CABEZA",
                "cantidad_disponible": Decimal("4"),
                "stock_minimo": Decimal("1"),
                "precio_referencia": Decimal("680000"),
                "peso_saco_kg": None,
                "activo": True,
            })
        for producto, tipo, cantidad, motivo in [
            (producto_ajuste, MovimientoStock.Tipo.ENTRADA, Decimal("50"),
             "Demo: recepción inicial"),
            (producto_ajuste, MovimientoStock.Tipo.AJUSTE, Decimal("45"),
             "Demo: ajuste de inventario"),
            (producto_revision, MovimientoStock.Tipo.ENTRADA, Decimal("3"),
             "Demo: recepción de stock limitado"),
        ]:
            if not MovimientoStock.objects.filter(item=producto, motivo=motivo).exists():
                aplicar_movimiento(
                    producto.pk, tipo, cantidad, usuario=User.objects.get(username="admin"),
                    motivo=motivo)

        InsumoAgricola.objects.get_or_create(nombre="DEMO - Herbicida agrícola", defaults={
            "tipo": InsumoAgricola.Tipo.PESTICIDA,
            "unidad_medida": "LT",
            "cantidad_disponible": Decimal("28"),
            "stock_minimo": Decimal("10"),
            "dosis_por_hectarea": Decimal("1.250"),
            "activo": True,
        })

        hoy = timezone.localdate()
        inicio_periodo = date(hoy.year, hoy.month, 1)
        fecha_trabajo = max(inicio_periodo, hoy - timedelta(days=1))
        supervisor = User.objects.get(username="supervisor1")
        remuneraciones_demo = [
            (UUID("a0000000-0000-4000-8000-000000000001"),
             UUID("a1000000-0000-4000-8000-000000000001"),
             trabajadores_demo[0], Desempeno.Labor.COSECHA_PAPA, Decimal("18"),
             Desempeno.UnidadProduccion.SACO, Decimal("1200"), Decimal("0"), Decimal("0"),
             Remuneracion.Estado.BORRADOR),
            (UUID("a0000000-0000-4000-8000-000000000002"),
             UUID("a1000000-0000-4000-8000-000000000002"),
             trabajadores_demo[1], Desempeno.Labor.JORNAL, Decimal("4"),
             Desempeno.UnidadProduccion.JORNADA, Decimal("42000"), Decimal("15000"),
             Decimal("5000"), Remuneracion.Estado.APROBADA),
            (UUID("a0000000-0000-4000-8000-000000000003"),
             UUID("a1000000-0000-4000-8000-000000000003"),
             trabajadores_demo[2], Desempeno.Labor.ENSACADO, Decimal("32"),
             Desempeno.UnidadProduccion.SACO, Decimal("950"), Decimal("10000"),
             Decimal("0"), Remuneracion.Estado.PAGADA),
        ]
        for rem_id, desempeno_id, trabajador, labor, cantidad, unidad, tarifa, bonos, descuentos, estado in remuneraciones_demo:
            Desempeno.objects.get_or_create(pk=desempeno_id, defaults={
                "trabajador": trabajador,
                "registrado_por": supervisor,
                "fecha": fecha_trabajo,
                "labor": labor,
                "cantidad": cantidad,
                "unidad": unidad,
                "tarifa_unitaria": tarifa,
                "device_id": "demo-terreno",
            })
            remuneracion, creada = Remuneracion.objects.get_or_create(pk=rem_id, defaults={
                "trabajador": trabajador,
                "periodo_inicio": inicio_periodo,
                "periodo_fin": hoy,
                "bonos": bonos,
                "descuentos": descuentos,
            })
            if creada:
                remuneracion.calcular()
                if estado != Remuneracion.Estado.BORRADOR:
                    remuneracion.estado = estado
                    remuneracion.save(update_fields=["estado", "updated_at"])

        ventas_demo = [
            {
                "id": UUID("b0000000-0000-4000-8000-000000000001"),
                "cliente": Cliente.objects.get(rut="11111111-1"),
                "vendedor": User.objects.get(username="vendedor1"),
                "fecha": timezone.now() - timedelta(days=3),
                "observaciones": "Pedido de demostración: venta pagada y entregada.",
                "device_id": "demo-vendedor-01",
                "detalles": [{
                    "id": UUID("b1000000-0000-4000-8000-000000000001"),
                    "producto": ProductoVenta.objects.get(nombre="Papa Desirée"),
                    "cantidad": Decimal("8"),
                    "precio_unitario": Decimal("12000"),
                }],
                "pagos": [
                    {"id": UUID("b2000000-0000-4000-8000-000000000001"),
                     "monto": Decimal("40000"), "estado": Pago.Estado.PAGADO,
                     "metodo": Pago.Metodo.TRANSFERENCIA},
                    {"id": UUID("b2000000-0000-4000-8000-000000000002"),
                     "monto": Decimal("56000"), "estado": Pago.Estado.PAGADO,
                     "metodo": Pago.Metodo.EFECTIVO},
                ],
                "despacho": {
                    "id": UUID("b3000000-0000-4000-8000-000000000001"),
                    "fecha": hoy - timedelta(days=2),
                    "hora": time(9, 30),
                    "direccion": "Av. Libertad 455",
                    "comuna": "Chillán",
                    "estado": Despacho.Estado.ENTREGADO,
                    "transportista": "Transportes Ñuble",
                    "patente": "ABCD12",
                    "observaciones": "Entrega recibida conforme.",
                },
            },
            {
                "id": UUID("b0000000-0000-4000-8000-000000000002"),
                "cliente": clientes_demo[0],
                "vendedor": User.objects.get(username="vendedor1"),
                "fecha": timezone.now() - timedelta(days=1),
                "observaciones": "Pedido de demostración: abono y saldo a crédito.",
                "device_id": "demo-vendedor-01",
                "detalles": [{
                    "id": UUID("b1000000-0000-4000-8000-000000000002"),
                    "producto": ProductoVenta.objects.get(nombre="Trigo"),
                    "cantidad": Decimal("6"),
                    "precio_unitario": Decimal("18000"),
                }],
                "pagos": [
                    {"id": UUID("b2000000-0000-4000-8000-000000000003"),
                     "monto": Decimal("30000"), "estado": Pago.Estado.PAGADO,
                     "metodo": Pago.Metodo.TRANSFERENCIA},
                    {"id": UUID("b2000000-0000-4000-8000-000000000004"),
                     "monto": Decimal("78000"), "estado": Pago.Estado.PENDIENTE,
                     "metodo": Pago.Metodo.CREDITO,
                     "fecha_vencimiento": hoy + timedelta(days=14)},
                ],
                "despacho": {
                    "id": UUID("b3000000-0000-4000-8000-000000000002"),
                    "fecha": hoy + timedelta(days=1),
                    "hora": time(14, 15),
                    "direccion": "Camino a San Nicolás 1450",
                    "comuna": "Chillán",
                    "estado": Despacho.Estado.PROGRAMADO,
                    "transportista": "Por asignar",
                    "patente": "",
                    "observaciones": "Coordinar recepción con bodega.",
                },
            },
            {
                "id": UUID("b0000000-0000-4000-8000-000000000003"),
                "cliente": clientes_demo[1],
                "vendedor": User.objects.get(username="vendedor1"),
                "fecha": timezone.now() - timedelta(hours=5),
                "observaciones": "Venta offline de demostración; revisar diferencia de stock.",
                "device_id": "demo-terreno-offline",
                "detalles": [{
                    "id": UUID("b1000000-0000-4000-8000-000000000003"),
                    "producto": producto_revision,
                    "cantidad": Decimal("4"),
                    "precio_unitario": Decimal("5500"),
                }],
                "pagos": [{
                    "id": UUID("b2000000-0000-4000-8000-000000000005"),
                    "monto": Decimal("22000"), "estado": Pago.Estado.PENDIENTE,
                    "metodo": Pago.Metodo.CREDITO,
                    "fecha_vencimiento": hoy + timedelta(days=7),
                }],
                "despacho": {
                    "id": UUID("b3000000-0000-4000-8000-000000000003"),
                    "fecha": hoy,
                    "hora": time(16, 0),
                    "direccion": "Ruta N-50, Parcela 12",
                    "comuna": "San Carlos",
                    "estado": Despacho.Estado.EN_RUTA,
                    "transportista": "Logística Rural",
                    "patente": "KLXY34",
                    "observaciones": "Diferencia de inventario pendiente de revisión.",
                },
            },
            {
                "id": UUID("b0000000-0000-4000-8000-000000000004"),
                "cliente": Cliente.objects.get(rut="22222222-2"),
                "vendedor": User.objects.get(username="vendedor2"),
                "fecha": timezone.now() - timedelta(days=2),
                "observaciones": "Pedido de demostración del segundo vendedor.",
                "device_id": "demo-vendedor-02",
                "detalles": [{
                    "id": UUID("b1000000-0000-4000-8000-000000000004"),
                    "producto": ProductoVenta.objects.get(nombre="Avena"),
                    "cantidad": Decimal("3"),
                    "precio_unitario": Decimal("15000"),
                }],
                "pagos": [{
                    "id": UUID("b2000000-0000-4000-8000-000000000006"),
                    "monto": Decimal("45000"), "estado": Pago.Estado.PAGADO,
                    "metodo": Pago.Metodo.CHEQUE,
                }],
                "despacho": {
                    "id": UUID("b3000000-0000-4000-8000-000000000004"),
                    "fecha": hoy - timedelta(days=1),
                    "hora": time(11, 45),
                    "direccion": "Calle Comercio 78",
                    "comuna": "Chillán",
                    "estado": Despacho.Estado.CANCELADO,
                    "transportista": "Transportes Ñuble",
                    "patente": "ABCD12",
                    "observaciones": "Demostración: entrega reprogramada.",
                },
            },
        ]
        for venta_data in ventas_demo:
            if not Venta.objects.filter(pk=venta_data["id"]).exists():
                registrar_venta({**venta_data, "synced_at": timezone.now()})

        self.stdout.write(self.style.SUCCESS("Datos demo listos."))
        self.stdout.write(f"{'USUARIO':<13}{'ROL':<12}{'CLAVE':<14}NOTA")
        for username, rol, *_rest in USUARIOS_DEMO:
            desc = _rest[2]
            self.stdout.write(f"{username:<13}{rol:<12}{password:<14}{desc}")
