from rest_framework.routers import SimpleRouter

from .views import CompraViewSet, InsumoAgricolaViewSet, MovimientoStockViewSet, ProductoVentaViewSet

router = SimpleRouter()
router.register("productos", ProductoVentaViewSet, basename="producto")
router.register("insumos", InsumoAgricolaViewSet, basename="insumo")
router.register("movimientos", MovimientoStockViewSet, basename="movimiento")
router.register("compras", CompraViewSet, basename="compra")

urlpatterns = router.urls
