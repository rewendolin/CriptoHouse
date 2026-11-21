// Lector de la cadena (Arbitrum + otras redes) — solo LEE, nunca firma ni mueve nada.
// Funciona en el navegador y en Node (necesita keccak_256 global de js-sha3).
(function (g) {
  'use strict';
  const k = (s) => g.keccak_256(s);
  const sel = (s) => k(s).slice(0, 8);

  /* ── Nodos públicos (con plan B si uno falla) ── */
  const RPCS = {
    arbitrum: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.drpc.org'],
    ethereum: ['https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth'],
    base: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    optimism: ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com'],
    polygon: ['https://polygon-bor-rpc.publicnode.com', 'https://1rpc.io/matic'],
    bsc: ['https://bsc-dataseed.bnbchain.org', 'https://bsc-rpc.publicnode.com'],
    avalanche: ['https://avalanche-c-chain-rpc.publicnode.com'],
    gnosis: ['https://gnosis-rpc.publicnode.com'],
    xdc: ['https://rpc.xinfin.network'],
  };
  async function rpc(red, method, params) {
    let ultimo;
    for (const url of RPCS[red]) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        const j = await r.json();
        if (j.error) { ultimo = new Error(j.error.message); if (/range|beyond|head/i.test(j.error.message)) throw ultimo; continue; }
        return j.result;
      } catch (e) { ultimo = e; if (/range|beyond|head/i.test(e.message)) throw e; }
    }
    throw ultimo || new Error('Sin respuesta de ' + red);
  }
  const llamar = (red, to, data) => rpc(red, 'eth_call', [{ to, data }, 'latest']);

  /* ── Codificar / decodificar ── */
  const pad = (h) => h.replace(/^0x/, '').padStart(64, '0');
  const uint = (n) => pad(BigInt(n).toString(16));
  const int24 = (n) => pad((BigInt.asUintN(256, BigInt(n))).toString(16));
  const dir = (a) => pad(a.toLowerCase());
  const palabras = (hex) => (hex.replace(/^0x/, '').match(/.{64}/g) || []).map((w) => BigInt('0x' + w));
  const conSigno = (b, bits) => BigInt.asIntN(bits, b);
  const aDir = (b) => '0x' + b.toString(16).padStart(40, '0');
  const Q96 = 2 ** 96;

  /* ── Contratos de Uniswap en Arbitrum ── */
  const UNI = {
    v3npm: '0xc36442b4a4522e871399cd717abdd847ab11fe88',
    v3factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
    v4pm: '0xd88f38f930b7952f2db2432cb002e7abbf3dd869',
    v4state: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990',
    v4manager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
  };
  const EV = {
    transfer: '0x' + k('Transfer(address,address,uint256)'),
    v3dec: '0x' + k('DecreaseLiquidity(uint256,uint128,uint256,uint256)'),
    v3inc: '0x' + k('IncreaseLiquidity(uint256,uint128,uint256,uint256)'),
    v4mod: '0x' + k('ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)'),
  };

  const cacheTok = {};
  async function token(red, a) {
    const key = red + a.toLowerCase();
    if (cacheTok[key]) return cacheTok[key];
    if (/^0x0+$/.test(a)) return (cacheTok[key] = { a, sym: 'ETH', dec: 18 });
    const [d, s] = await Promise.all([llamar(red, a, '0x' + sel('decimals()')), llamar(red, a, '0x' + sel('symbol()'))]);
    let sym = '?';
    try { const w = s.replace(/^0x/, ''); const len = parseInt(w.slice(64, 128), 16); sym = decodeURIComponent(w.slice(128, 128 + len * 2).replace(/(..)/g, '%$1')); } catch (e) {}
    return (cacheTok[key] = { a, sym, dec: Number(BigInt(d)) });
  }

  /* ── Matemática de liquidez concentrada ── */
  const precioTick = (t, d0, d1) => Math.pow(1.0001, t) * Math.pow(10, d0 - d1);
  function cantidades(L, sqrtP, tl, tu, d0, d1) {
    const a = Math.pow(1.0001, tl / 2), b = Math.pow(1.0001, tu / 2), s = sqrtP;
    let x, y;
    if (s <= a) { x = L * (1 / a - 1 / b); y = 0; }
    else if (s >= b) { x = 0; y = L * (b - a); }
    else { x = L * (1 / s - 1 / b); y = L * (s - a); }
    return { x: x / 10 ** d0, y: y / 10 ** d1 };
  }
  // √precio "crudo" a partir de lo que se metió (sirve para saber el precio del día que se abrió)
  function sqrtDesdeCantidades(x, y, L, tl, tu) {
    const a = Math.pow(1.0001, tl / 2), b = Math.pow(1.0001, tu / 2);
    if (x > 0 && y > 0) return 1 / (x / L + 1 / b);
    return x > 0 ? a : b;
  }

  /* ── Buscar movimientos por tramos (los nodos solo dejan 10M bloques por consulta) ── */
  async function logs(red, filtro, desde, hasta, tramo = 9_000_000) {
    const fin = hasta ?? Number(await rpc(red, 'eth_blockNumber', []));
    const tramos = [];
    for (let s = desde; s <= fin; s += tramo) tramos.push([s, Math.min(s + tramo - 1, fin)]);
    const out = [];
    for (let i = 0; i < tramos.length; i += 3) {             // de 3 en 3 para no saturar el nodo
      const lote = await Promise.all(tramos.slice(i, i + 3).map(async ([s, e]) => {
        for (let intento = 0; intento < 3; intento++) {
          try { return await rpc(red, 'eth_getLogs', [{ ...filtro, fromBlock: '0x' + s.toString(16), toBlock: '0x' + e.toString(16) }]); }
          catch (err) { await new Promise((r) => setTimeout(r, 700 * (intento + 1))); }
        }
        return [];
      }));
      out.push(...lote.flat());
    }
    return out;
  }
  const fechaBloque = async (red, n) => {
    const b = await rpc(red, 'eth_getBlockByNumber', ['0x' + Number(n).toString(16), false]);
    return new Date(Number(BigInt(b.timestamp)) * 1000).toISOString();
  };

  /* ── Posiciones v3 ── */
  async function posicionesV3(owner) {
    const red = 'arbitrum';
    const n = Number(BigInt(await llamar(red, UNI.v3npm, '0x' + sel('balanceOf(address)') + dir(owner))));
    const ids = await Promise.all([...Array(n).keys()].map(async (i) =>
      BigInt(await llamar(red, UNI.v3npm, '0x' + sel('tokenOfOwnerByIndex(address,uint256)') + dir(owner) + uint(i)))));
    return Promise.all(ids.map((id) => leerV3(id, owner)));
  }
  async function leerV3(id, owner) {
    const red = 'arbitrum';
    const w = palabras(await llamar(red, UNI.v3npm, '0x' + sel('positions(uint256)') + uint(id)));
    const t0 = aDir(w[2]), t1 = aDir(w[3]), fee = Number(w[4]);
    const tl = Number(conSigno(w[5], 24)), tu = Number(conSigno(w[6], 24)), L = Number(w[7]);
    const [T0, T1, poolW] = await Promise.all([token(red, t0), token(red, t1),
      llamar(red, UNI.v3factory, '0x' + sel('getPool(address,address,uint24)') + dir(t0) + dir(t1) + uint(fee))]);
    const pool = aDir(palabras(poolW)[0]);
    const s0 = palabras(await llamar(red, pool, '0x' + sel('slot0()')));
    // Tarifas sin cobrar: simulo "cobrar" sin hacerlo de verdad
    const max = (2n ** 128n - 1n);
    let f0 = 0, f1 = 0;
    try {
      const c = palabras(await rpc(red, 'eth_call', [{ from: owner, to: UNI.v3npm,
        data: '0x' + sel('collect((uint256,address,uint128,uint128))') + uint(id) + dir(owner) + uint(max) + uint(max) }, 'latest']));
      f0 = Number(c[0]) / 10 ** T0.dec; f1 = Number(c[1]) / 10 ** T1.dec;
    } catch (e) {}
    return armar({ version: 'v3', id: id.toString(), T0, T1, fee, tl, tu, L, sqrtP: Number(s0[0]) / Q96, tick: Number(conSigno(s0[1], 24)), f0, f1,
      url: 'https://app.uniswap.org/positions/v3/arbitrum/' + id });
  }

  /* ── Posiciones v4 (los ids se buscan por movimientos) ── */
  async function idsV4(owner, desde) {
    const ls = await logs('arbitrum', { address: UNI.v4pm, topics: [EV.transfer, null, '0x' + dir(owner)] }, desde);
    const salen = await logs('arbitrum', { address: UNI.v4pm, topics: [EV.transfer, '0x' + dir(owner)] }, desde);
    const fuera = new Set(salen.filter((l) => !/^0x0+$/.test(l.topics[2])).map((l) => BigInt(l.topics[3]).toString()));
    return ls.map((l) => ({ id: BigInt(l.topics[3]).toString(), bloque: Number(BigInt(l.blockNumber)), tx: l.transactionHash }))
      .filter((x) => !fuera.has(x.id));
  }
  async function leerV4(id) {
    const red = 'arbitrum';
    const w = palabras(await llamar(red, UNI.v4pm, '0x' + sel('getPoolAndPositionInfo(uint256)') + uint(id)));
    const c0 = aDir(w[0]), c1 = aDir(w[1]), fee = Number(w[2]), spacing = Number(conSigno(w[3], 24)), hooks = aDir(w[4]);
    const info = w[5];
    const tl = Number(conSigno((info >> 8n) & 0xffffffn, 24)), tu = Number(conSigno((info >> 32n) & 0xffffffn, 24));
    const poolId = '0x' + k(hexABytes(dir(c0) + dir(c1) + uint(fee) + int24(spacing) + dir(hooks)));
    const [T0, T1, Lw, s0w, pi, fg] = await Promise.all([token(red, c0), token(red, c1),
      llamar(red, UNI.v4pm, '0x' + sel('getPositionLiquidity(uint256)') + uint(id)),
      llamar(red, UNI.v4state, '0x' + sel('getSlot0(bytes32)') + pad(poolId)),
      llamar(red, UNI.v4state, '0x' + sel('getPositionInfo(bytes32,address,int24,int24,bytes32)') + pad(poolId) + dir(UNI.v4pm) + int24(tl) + int24(tu) + uint(id)),
      llamar(red, UNI.v4state, '0x' + sel('getFeeGrowthInside(bytes32,int24,int24)') + pad(poolId) + int24(tl) + int24(tu))]);
    const L = BigInt(Lw), s0 = palabras(s0w), p = palabras(pi), f = palabras(fg);
    const M = 2n ** 256n, Q128 = 2n ** 128n;
    const f0 = Number((((f[0] - p[1]) % M + M) % M) * L / Q128) / 10 ** T0.dec;
    const f1 = Number((((f[1] - p[2]) % M + M) % M) * L / Q128) / 10 ** T1.dec;
    return armar({ version: 'v4', id: String(id), T0, T1, fee, tl, tu, L: Number(L), sqrtP: Number(s0[0]) / Q96, tick: Number(conSigno(s0[1], 24)), f0, f1, poolId,
      url: 'https://app.uniswap.org/positions/v4/arbitrum/' + id });
  }
  function hexABytes(h) { const u = new Uint8Array(h.length / 2); for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16); return u; }

  // Pone el token "volátil" delante (WBTC/USDC aunque la cadena lo guarde al revés)
  const ESTABLES = /^(USDC|USDC\.E|USDT|USDT0|DAI|USDE|FRAX|USD₮0)$/i;
  function armar(r) {
    const { T0, T1, tl, tu, L, sqrtP, f0, f1 } = r;
    const q = cantidades(L, sqrtP, tl, tu, 0, 0);
    let a0 = q.x / 10 ** T0.dec, a1 = q.y / 10 ** T1.dec;
    let precio = sqrtP * sqrtP * 10 ** (T0.dec - T1.dec);           // T1 por cada T0
    let pa = precioTick(tl, T0.dec, T1.dec), pb = precioTick(tu, T0.dec, T1.dec);
    let base = T0, cot = T1, xb = a0, yc = a1, fb = f0, fc = f1;
    if (ESTABLES.test(T0.sym) && !ESTABLES.test(T1.sym)) {          // dar la vuelta
      base = T1; cot = T0; xb = a1; yc = a0; fb = f1; fc = f0;
      precio = 1 / precio; [pa, pb] = [1 / pb, 1 / pa];
    }
    const valor = xb * precio + yc;
    return { version: r.version, id: r.id, url: r.url, par: [nombre(base.sym), nombre(cot.sym)], comisionPct: r.fee / 10000,
      rango: [pa, pb], precio, cant: { x: xb, y: yc }, valor, tarifas: fb * precio + fc, tarifasCant: { x: fb, y: fc },
      dentro: r.tick >= tl && r.tick < tu, activa: L > 0, liquidez: L, _raw: r };
  }
  const nombre = (s) => s === 'WETH' || s === 'ETH' ? 'WETH' : s === 'USD₮0' ? 'USDT' : s;

  /* ── Historial: cuándo se abrió, cuánto se puso, cuándo se cerró ── */
  async function historial(pos, owner, pista, desde) {
    const red = 'arbitrum', r = pos._raw;
    const contrato = r.version === 'v3' ? UNI.v3npm : UNI.v4pm;
    let mint = pista;
    if (!mint) {
      const ls = await logs(red, { address: contrato, topics: [EV.transfer, '0x' + pad('0'), null, '0x' + uint(r.id)] }, desde || 20_000_000);
      if (!ls.length) return null;
      mint = { bloque: Number(BigInt(ls[0].blockNumber)), tx: ls[0].transactionHash };
    }
    const out = { abierta: await fechaBloque(red, mint.bloque), bloqueApertura: mint.bloque };
    // Lo que salió de la billetera en la operación de apertura
    const rc = await rpc(red, 'eth_getTransactionReceipt', [mint.tx]);
    const mov = movimientos(rc, owner, r);
    const flip = pos.par[0] !== nombre(r.T0.sym);
    const xin = flip ? mov.sale1 : mov.sale0, yin = flip ? mov.sale0 : mov.sale1;
    let Lmint = r.L;
    if (r.version === 'v3') { const inc = rc.logs.find((l) => l.topics[0] === EV.v3inc); if (inc) Lmint = Number(palabras(inc.data)[0]); }
    else { const m = rc.logs.find((l) => l.topics[0] === EV.v4mod); if (m) Lmint = Number(conSigno(palabras(m.data)[2], 256)); }
    // precio de ese día, sacado de la proporción que se metió
    const s = sqrtDesdeCantidades(mov.sale0 * 10 ** r.T0.dec, mov.sale1 * 10 ** r.T1.dec, Lmint, r.tl, r.tu);
    let p = s * s * 10 ** (r.T0.dec - r.T1.dec); if (flip) p = 1 / p;
    out.precioApertura = p;
    out.puesto = { x: xin, y: yin };
    out.depositado = xin * p + yin;
    out.txApertura = mint.tx;
    // ¿Cerrada? Busco la retirada
    if (!pos.activa) {
      let cierre = null;
      if (r.version === 'v3') {
        const d = await logs(red, { address: UNI.v3npm, topics: [EV.v3dec, '0x' + uint(r.id)] }, mint.bloque);
        if (d.length) cierre = d[d.length - 1];
      } else {
        const d = await logs(red, { address: UNI.v4manager, topics: [EV.v4mod, r.poolId, '0x' + dir(UNI.v4pm)] }, mint.bloque, null, 2_000_000);
        const mios = d.filter((l) => BigInt('0x' + l.data.slice(2 + 64 * 3, 2 + 64 * 4)) === BigInt(r.id) && conSigno(palabras(l.data)[2], 256) < 0n);
        if (mios.length) cierre = mios[mios.length - 1];
      }
      if (cierre) {
        const n = Number(BigInt(cierre.blockNumber));
        out.cerrada = await fechaBloque(red, n);
        const rc2 = await rpc(red, 'eth_getTransactionReceipt', [cierre.transactionHash]);
        const m2 = movimientos(rc2, owner, r);
        const xo = flip ? m2.entra1 : m2.entra0, yo = flip ? m2.entra0 : m2.entra1;
        out.retirado = { x: xo, y: yo };
        out.txCierre = cierre.transactionHash;
      }
    }
    return out;
  }
  // Suma lo que salió y entró en la billetera de cada token en una operación
  function movimientos(rc, owner, r) {
    const o = '0x' + dir(owner);
    const m = { sale0: 0, sale1: 0, entra0: 0, entra1: 0 };
    for (const l of rc.logs) {
      if (l.topics[0] !== EV.transfer || l.topics.length !== 3) continue;
      const v = Number(BigInt(l.data));
      const a = l.address.toLowerCase();
      const idx = a === r.T0.a.toLowerCase() ? 0 : a === r.T1.a.toLowerCase() ? 1 : -1;
      if (idx < 0) continue;
      const dec = idx ? r.T1.dec : r.T0.dec;
      if (l.topics[1] === o) m['sale' + idx] += v / 10 ** dec;
      if (l.topics[2] === o) m['entra' + idx] += v / 10 ** dec;
    }
    // ETH nativo (v4 con ETH): no aparece como Transfer; se deja en 0
    return m;
  }

  /* ── Saldos de billeteras ── */
  const TOKENS = {
    ethereum: { USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7', WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', DAI: '0x6b175474e89094c44da98b954eedeac495271d0f' },
    arbitrum: { USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', 'USDC.e': '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', WBTC: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', ARB: '0x912ce59144191c1204e64559fe8253a0e49e6548' },
    base: { USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', WETH: '0x4200000000000000000000000000000000000006', cbBTC: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf' },
    optimism: { USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', WETH: '0x4200000000000000000000000000000000000006', OP: '0x4200000000000000000000000000000000000042' },
    polygon: { USDC: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', WETH: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', WBTC: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6' },
    bsc: { USDT: '0x55d398326f99059ff775485246999027b3197955', USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', BTCB: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', ETH: '0x2170ed0880ac9a755fd29b2688956bd959f933f8' },
  };
  const NATIVO = { ethereum: 'ETH', arbitrum: 'ETH', base: 'ETH', optimism: 'ETH', polygon: 'POL', bsc: 'BNB', avalanche: 'AVAX', gnosis: 'xDAI' };

  async function saldosEVM(addr) {
    const tareas = [];
    for (const red of Object.keys(NATIVO)) {
      tareas.push(rpc(red, 'eth_getBalance', [addr, 'latest']).then((b) => ({ red, sym: NATIVO[red], cant: Number(BigInt(b)) / 1e18 })).catch(() => null));
      for (const [sym, t] of Object.entries(TOKENS[red] || {})) {
        tareas.push((async () => {
          const b = BigInt(await llamar(red, t, '0x' + sel('balanceOf(address)') + dir(addr)));
          if (b === 0n) return null;
          const T = await token(red, t);
          return { red, sym, cant: Number(b) / 10 ** T.dec };
        })().catch(() => null));
      }
    }
    return (await Promise.all(tareas)).filter((x) => x && x.cant > 1e-9);
  }
  async function saldosOtros(addr, tipo) {
    try {
      if (tipo === 'SOL') {
        const r = await fetch('https://api.mainnet-beta.solana.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [addr] }) });
        const j = await r.json(); return [{ red: 'solana', sym: 'SOL', cant: (j.result?.value || 0) / 1e9 }];
      }
      if (tipo === 'XRP') {
        const r = await fetch('https://xrplcluster.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'account_info', params: [{ account: addr, ledger_index: 'current' }] }) });
        const j = await r.json(); return j.result?.account_data ? [{ red: 'xrp', sym: 'XRP', cant: Number(j.result.account_data.Balance) / 1e6 }] : [];
      }
      if (tipo === 'XLM') {
        const r = await fetch('https://horizon.stellar.org/accounts/' + addr); if (!r.ok) return [];
        const j = await r.json(); return (j.balances || []).map((b) => ({ red: 'stellar', sym: b.asset_type === 'native' ? 'XLM' : b.asset_code, cant: Number(b.balance) }));
      }
      if (tipo === 'HBAR') {
        const r = await fetch('https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/' + addr); if (!r.ok) return [];
        const j = await r.json(); return [{ red: 'hedera', sym: 'HBAR', cant: Number(j.balance?.balance || 0) / 1e8 }];
      }
      if (tipo === 'XDC') {
        const b = await rpc('xdc', 'eth_getBalance', ['0x' + addr.slice(3), 'latest']);
        return [{ red: 'xdc', sym: 'XDC', cant: Number(BigInt(b)) / 1e18 }];
      }
    } catch (e) {}
    return [];
  }
  function tipoDireccion(a) {
    if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'EVM';
    if (/^xdc[0-9a-fA-F]{40}$/i.test(a)) return 'XDC';
    if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) return 'XRP';
    if (/^G[A-Z2-7]{55}$/.test(a)) return 'XLM';
    if (/^0\.0\.\d+$/.test(a)) return 'HBAR';
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'SOL';
    return null;
  }
  async function saldos(addr) {
    const t = tipoDireccion(addr);
    if (t === 'EVM') return saldosEVM(addr);
    return t ? saldosOtros(addr, t) : [];
  }

  /* ── Precios (CoinGecko) ── */
  const GECKO = { BTC: 'bitcoin', WBTC: 'bitcoin', BTCB: 'bitcoin', cbBTC: 'bitcoin', ETH: 'ethereum', WETH: 'ethereum', SOL: 'solana', XRP: 'ripple',
    XLM: 'stellar', HBAR: 'hedera-hashgraph', XDC: 'xdce-crowd-sale', BNB: 'binancecoin', POL: 'polygon-ecosystem-token', AVAX: 'avalanche-2',
    ARB: 'arbitrum', OP: 'optimism', USDC: 'usd-coin', 'USDC.e': 'usd-coin', USDT: 'tether', DAI: 'dai', xDAI: 'xdai', SHX: 'stronghold-token', AAVE: 'aave' };
  async function precios(simbolos) {
    const ids = [...new Set(simbolos.map((s) => GECKO[s]).filter(Boolean))];
    const out = {};
    if (!ids.length) return out;
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&include_24hr_change=true&ids=' + ids.join(','));
    const j = await r.json();
    for (const s of simbolos) { const v = j[GECKO[s]]; if (v) out[s] = { usd: v.usd, cambio24: v.usd_24h_change }; }
    return out;
  }

  g.Cadena = { posicionesV3, idsV4, leerV4, leerV3, historial, saldos, precios, tipoDireccion, rpc, logs };
})(typeof window !== 'undefined' ? window : globalThis);
