# Estado del proyecto CriptoHouse

## Último cambio (21-nov-2026)
- Nueva app para el móvil en `asistente/`: resumen de la cartera, ranking de lo que más rinde, posiciones separadas por tipo y una ficha para cada posición.
- Los datos van cifrados en `datos.enc.json`; el fichero sin cifrar (`datos.json`) no se sube a GitHub.
- Para actualizar: editar `asistente/datos.json` → `CLAVE=... node asistente/cifrar.mjs` → commit + push.

## Pendiente
- Cuánto se puso al abrir 2 pools: WETH/USDC v4 y WBTC/USDC v4 (la cerrada).
- Añadir las compras de BTC y otras criptos cuando lleguen las capturas.
