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

## 22-nov-2026 — Loopings de Aave en el asistente
- cadena.js lee Aave v3 (6 redes): lo puesto, lo debido, salud, intereses; y todos los movimientos (Supply/Borrow/Repay/Withdraw + traspasos de aTokens) con precio del día (Binance).
- La app los muestra dentro de cada billetera, en la pestaña Préstamos, en el ranking y en el total. Ficha con salud, precio de liquidación y movimientos.
- Billetera «mucho» (0x87406…b30e4) añadida en datos.json (cifrado). Historia precargada en datos.json → aave; la app solo trae lo nuevo cada 30 min.
- Compras: «¿a cuánto compré BTC/ETH?» junta compras apuntadas (datos.json → compras, precio exacto) + lo puesto en Aave (precio del día, marcado ≈). Precio medio y % frente a hoy. Pestaña Compras rellena.
- 22-nov: fondo crema y resumen claro (el negro cansaba la vista). Preguntas de compras valen para cualquier moneda (XRP, HBAR…) si está en datos.json → compras. PENDIENTE: direcciones completas de las cuentas Rabby (METAL XPR, HBAR 2K, POOL ETH extraAMPLIO, papas rabby, trading, DCA BTC) para ponerles nombre y leerlas.
