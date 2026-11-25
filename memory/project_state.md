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
- 23-nov 11:40: pool 5783284 cerrada (09:47) → nueva 5783840 (mucho, 3.267,65 USDC, 09:49).
  CAUSA de que no saliera en el móvil: (1) las llamadas a la cadena no tenían tiempo límite — si el móvil se dormía a medias,
  la carga se quedaba colgada y `cargando` bloqueaba todas las siguientes; (2) si fallaba leer las pools de una billetera,
  se daban TODAS por cerradas y no se veían las nuevas. Arreglo: corte a 15 s por nodo + 2 vueltas a los nodos, candado
  de carga caduca a 2 min, reintento a los 20 s si algo falla, recarga al volver a la app, y una billetera que no se pudo
  leer deja sus pools como estaban.
- 24-nov: pools nuevas 5784369 y 5784371 (mucho); 5783840 cerrada 23-nov 17:11.
  Nuevo: la app cuenta también lo SACADO a medias de una pool abierta (DecreaseLiquidity) → `añadidos` con tipo 'menos'.
  Revisa abiertas cada 5 min (antes 30). Las cerradas se repasan una vez.
  Móvil con programa viejo: `VERSION` en index.html + `mirarVersion()` recarga sola si hay una más nueva.
  ⚠️ En cada subida de código: subir VERSION y el ?v= de cadena.js.
- 24-nov 19:40: compras WBTC apuntadas: 23-nov 80 USDC→0,00128416 (62.298); 24-nov 0,01670308 traído de otra red (≈59.787, aprox.); 24-nov 1000 USDC préstamo Aave→0,01664051 (60.095). Depósito Aave 0,01802797 (18:20) en noEsCompra.
  Binance bloquea según país → precioPasado prueba data-api.binance.vision, api.binance.com y api.binance.us. Movs de Aave sin precio se reintentan.
- 24-nov 20:20: la compra de 11:57 (0,01670308 WBTC) eran 1000 USDT desde Rabby → precio 59.869,5 (corregido).
- 24-nov 20:30: arreglado % disparatado (+187M%) de la pool 5783840: el cierre se contaba como "sacado a medias". Iconos MetaMask/Rabby por cuenta (APP_CUENTA: mucho=MetaMask, resto Rabby).
- 25-nov: nueva cuenta «Rabby 72bd» (0x72bd08…f81fbb, Rabby). Solo ha tenido 2 pools v3 en Arbitrum (ninguna en otras redes ni v4):
  5255374 WETH/USDC (fee 0,01 %) y 5255427 WBTC/USDC (0,05 %), abiertas 30-ene-2026.
  Estudio guardado en datos.json → `estudioPools` (rango, ancho, tarifas cobradas+pendientes, % anual, resultado, comparación con "quedarse quieto").
  `cobradoUSD` es una foto del 25-nov (no se recalcula sola).
- 25-nov 21:55: direcciones cortas al estilo Rabby (0x72...1fbB, con mayúsculas de control). Cuenta «Rabby 7482» (0x7482…7A00) añadida: vacía, sin movimientos en ninguna red.
- 25-nov 22:15: compra WBTC 0,01650399 (llegó 22:07 de otra cuenta/red, ≈60.233, aproximado) puesta en Aave (mucho) a las 22:08.
- 25-nov 22:18: confirmado 1000 USDT → precio 60.591,34.
- 25-nov 22:25: compras WETH (ETH AAVE pools): 997,76 USDT desde 0x754d…c024 → 0,5914 (1.687,1) y préstamo Aave 1000 USDC → 0,5930 (1.686,3); ambas a Aave. Las compras NO se apuntan solas todavía.
