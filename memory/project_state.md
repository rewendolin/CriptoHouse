# Estado del proyecto CriptoHouse

## Último cambio (21-nov-2026, tarde)
- La app del móvil (`asistente/`) ahora lee TODO en directo de la cadena (solo lectura):
  - 💧 Pools de Uniswap v3 y v4 en Arbitrum: valor, tarifas sin cobrar, dentro/fuera de rango.
  - 📜 Historial automático: fecha de apertura y cierre, cuánto se puso y cuánto se sacó.
  - 👛 Saldos de billeteras en 8 redes EVM + SOL, XRP, XLM, HBAR, XDC, con precio de CoinGecko.
- Billeteras: la guardada en los datos cifrados + las de CriptoHouse (mismo navegador) + las que se añadan en el móvil.
- Lector en `asistente/cadena.js`. Datos cifrados en `datos.enc.json`.

## Pendiente
- Añadir las compras de BTC y otras criptos cuando lleguen las capturas.
- Staking y préstamos: vacío hasta que haya posiciones.
