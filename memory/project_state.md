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
- 22-nov: cuenta «mucho» con sus 6 pools Uniswap v3 (historial en datos.json; 5325340 abierta, tarifas ya cobradas en cobradoUSD). Nombres de cuentas por principio…final en NOMBRE_CUENTA (index.html). Compra WBTC 23-feb-2026 a 86.516 (conversión en pool 5220652).
- 22-nov 16:40: «mucho» cerró pool 5325340 (+~40 US$ con tarifas cobradas) y abrió 5783284 (2266 USDC, rango 59.033–60.892).
- 22-nov: VIGILANTE (.github/workflows/vigia.yml + asistente/vigia.mjs): cada 10 min avisa por ntfy (app del móvil) si una pool entra/sale de rango, si Aave baja de salud 1,3/1,15 o si salta una alarma de precio (datos.json → alarmas: {id, token, bajaDe|subeDe, texto}). Secretos CLAVE y NTFY_TEMA en GitHub; tema guardado en ../.criptohouse-ntfy-tema.txt.
- 22-nov: el vigilante corre en el MAC (launchd com.glenda.cartera-vigia, cada 10 min, carpeta ~/.cartera-vigia: baja vigia.mjs/cadena.js/datos.enc.json de GitHub Pages; claves en ~/.cartera-vigia/env). Solo avisa con el Mac encendido. Para 24 h: falta que Glenda autorice 'workflow' en GitHub (cuenta rewendolin) y subir .github/workflows/vigia.yml (está en local sin subir).
- 22-nov 17:45: vigilante YA en GitHub Actions (cada ~10 min, 24 h). Copia del Mac apagada y borrada. Prueba enviada a ntfy OK.
- 22-nov 17:45: compras WBTC apuntadas (0,0048 con USDC de Base ≈61.0k; 0,01628 con préstamo Aave 1000 USDC a 61.426). datos.json → noEsCompra: txs de Aave que no son compras (p. ej. meter WBTC que ya tenía).

## 23-nov-2026 — Liquidez añadida a pools abiertas
- La app ya cuenta el dinero que se mete DESPUÉS de abrir una pool v3 (eventos IncreaseLiquidity): `Cadena.añadidosV3` + `completarAñadidos()` (cada 30 min), guardado en `hist[k].añadidos`.
- Pool 5783284 (mucho): +1000,13 USDC el 23-nov 01:27 → puesto total 3.267 $.
- v4: aún no se miran los añadidos (las v4 activas no han recibido más).
- Caja de preguntas probada en navegador: responde bien.

- 23-nov 03:20: compra 0,03280483 WBTC (~2000 \$ de Conex) a ≈60.967, puesta en Aave (mucho). Salud Aave 1,78.
- 23-nov 03:50: arreglado que el móvil con datos viejos guardados tapaba los «añadidos»; cadena.js con ?v= para no usar copia vieja.
