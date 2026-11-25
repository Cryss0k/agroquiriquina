from decimal import Decimal

from django.db import models
from django.db.models import Q

from apps.core.models import SyncModel


class UnidadMedida(models.TextChoices):
    SACO = "SACO", "Saco"
    KILO = "KG", "Kilogramo"
    QUINTAL = "QQ", "Quintal (100 kg)"
    TONELADA = "TON", "Tonelada"
    UNIDAD = "UN", "Unidad"
    LITRO = "LT", "Litro"
    CABEZA = "CABEZA", "Cabeza (ganado)"


class ItemBodega(SyncModel):
    """Superclase: unifica la lógica de stock."""
    nombre = models.CharField(max_length=150)
    cantidad_disponible = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    unidad_medida = models.CharField(max_length=8, choices=UnidadMedida.choices, default=UnidadMedida.SACO)
    stock_minimo = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        constraints = [
            models.CheckConstraint(check=Q(cantidad_disponible__gte=0), name="item_stock_no_negativo")
        ]

    @property
    def bajo_stock_minimo(self) -> bool:
        return self.cantidad_disponible <= self.stock_minimo

    def __str__(self):
        return f"{self.nombre} [{self.cantidad_disponible} {self.unidad_medida}]"


class ProductoVenta(ItemBodega):
    class Categoria(models.TextChoices):
        PAPA = "PAPA", "Papa"
        TRIGO = "TRIGO", "Trigo"
        AVENA = "AVENA", "Avena"
        MAIZ = "MAIZ", "Maíz"
        GANADO = "GANADO", "Ganado"

    categoria = models.CharField(max_length=10, choices=Categoria.choices)
    variedad = models.CharField(max_length=80, blank=True)  # ej: Desirée, Cardinal
    precio_referencia = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    peso_saco_kg = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)


class InsumoAgricola(ItemBodega):
    class Tipo(models.TextChoices):
        SEMILLA = "SEMILLA", "Semilla"
        FERTILIZANTE = "FERTILIZANTE", "Fertilizante"
        PESTICIDA = "PESTICIDA", "Pesticida / Fungicida"
        OTRO = "OTRO", "Otro"

    tipo = models.CharField(max_length=15, choices=Tipo.choices, default=Tipo.OTRO)
    dosis_por_hectarea = models.DecimalField(
        max_digits=10, decimal_places=3, default=Decimal("0"),
        help_text="Cantidad de insumo (en su unidad de medida) por hectárea.",
    )

    class Meta:
        verbose_name_plural = "insumos agrícolas"

    def calcular_requerimiento(self, hectareas) -> Decimal:
        """Insumo necesario para N hectáreas."""
        return (self.dosis_por_hectarea * Decimal(hectareas)).quantize(Decimal("0.001"))


class MovimientoStock(SyncModel):
    """Bitácora auditable de cada cambio de stock."""
    class Tipo(models.TextChoices):
        ENTRADA = "ENTRADA", "Entrada"
        SALIDA = "SALIDA", "Salida"
        AJUSTE = "AJUSTE", "Ajuste"

    item = models.ForeignKey(ItemBodega, on_delete=models.PROTECT, related_name="movimientos")
    tipo = models.CharField(max_length=8, choices=Tipo.choices)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3)  # siempre positiva
    motivo = models.CharField(max_length=200, blank=True)
    referencia = models.UUIDField(null=True, blank=True)  # ej: id de la Venta
    usuario = models.ForeignKey("users.User", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-created_at"]


class Compra(SyncModel):
    """Compra de insumos realizada a un proveedor."""

    class Estado(models.TextChoices):
        REGISTRADA = "REGISTRADA", "Registrada"
        RECEPCIONADA = "RECEPCIONADA", "Recepcionada"
        ANULADA = "ANULADA", "Anulada"

    proveedor = models.ForeignKey(
        "users.Proveedor", on_delete=models.PROTECT, related_name="compras",
    )
    usuario = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="compras",
    )
    fecha = models.DateTimeField()
    estado = models.CharField(
        max_length=12, choices=Estado.choices, default=Estado.REGISTRADA,
    )
    total = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ["-fecha"]

    def recalcular_total(self, save=True):
        from django.db.models import Sum

        total = self.detalles.aggregate(total=Sum("subtotal"))["total"] or Decimal("0")
        self.total = total
        if save:
            self.save(update_fields=["total", "updated_at"])
        return total


class DetalleCompra(SyncModel):
    compra = models.ForeignKey(
        Compra, on_delete=models.CASCADE, related_name="detalles",
    )
    insumo = models.ForeignKey(
        InsumoAgricola, on_delete=models.PROTECT, related_name="detalles_compra",
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=0)
    subtotal = models.DecimalField(
        max_digits=14, decimal_places=0, editable=False, default=0,
    )

    def save(self, *args, **kwargs):
        self.subtotal = (self.cantidad * self.costo_unitario).quantize(Decimal("1"))
        super().save(*args, **kwargs)
