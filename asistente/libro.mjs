// 📒 Libro de cuentas: cada 10 min apunta TODO lo que pasa en tus cuentas de Arbitrum (compras, Aave, pools, pasos entre cuentas…)
// y cuánto cobraste de comisiones en las pools. Lo ejecuta GitHub Actions (vigia.yml). Solo LEE la cadena, nunca mueve nada.
// Se guarda CIFRADO en libro.enc.json (el repo es público). La app lo enseña en «📒 Libro».
//   Uso a mano para rellenar el pasado:  DESDE=2026-11-01 CLAVE=… node libro.mjs   (añade SOLO=0x… para una sola cuenta)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
globalThis.keccak_256 ??= require(join(dir, 'sha3.min.js')).keccak_256;
require(join(dir, 'cadena.js'));
const C = globalThis.Cadena;
const { CLAVE, NTFY_TEMA, DESDE, SOLO } = process.env;   // SOLO=0x… rellena el pasado de una sola cuenta
if (!CLAVE) { console.error('Falta CLAVE'); process.exit(1); }

/* ── Candado (el mismo que la app) ── */
const b = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
const b64 = (u) => Buffer.from(u).toString('base64');
async function llave(sal, uso) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(CLAVE), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [uso]);
}
async function abrir(f) {
  const c = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(c.iv) }, await llave(b(c.sal), 'decrypt'), b(c.datos))));
}
async function cerrar(obj, f) {
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llave(sal, 'encrypt'), new TextEncoder().encode(JSON.stringify(obj)));
  writeFileSync(join(dir, f), JSON.stringify({ v: 1, iter: 250000, sal: b64(sal), iv: b64(iv), datos: b64(new Uint8Array(datos)) }));
}

const D = await abrir('datos.enc.json');
const FICH = 'libro.enc.json';
const L = existsSync(join(dir, FICH)) ? await abrir(FICH) : { hasta: {}, movs: [] };

/* ── Qué se mira ── */
const RED = 'arbitrum';
const TOKENS = ['0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', '0x912ce59144191c1204e64559fe8253a0e49e6548',
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831', '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'];
const ESTABLE = /^(USDC|USDC\.e|USDT|USDT0|DAI|USD₮0)$/;
const NPM = '0xc36442b4a4522e871399cd717abdd847ab11fe88', AAVE = C.AAVE.arbitrum.pool;
const k = (s) => '0x' + globalThis.keccak_256(s);
const EV = {
  tr: k('Transfer(address,address,uint256)'), inc: k('IncreaseLiquidity(uint256,uint128,uint256,uint256)'), dec: k('DecreaseLiquidity(uint256,uint128,uint256,uint256)'),
  col: k('Collect(uint256,address,uint256,uint256)'), colPool: k('Collect(address,address,int24,int24,uint128,uint128)'), v4: k('ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)'),
  supply: k('Supply(address,address,address,uint256,uint16)'), withdraw: k('Withdraw(address,address,address,uint256)'),
  borrow: k('Borrow(address,address,address,uint256,uint8,uint256,uint16)'), repay: k('Repay(address,address,address,uint256,bool)'),
};
const pad = (d) => '0x' + d.slice(2).toLowerCase().padStart(64, '0');
const w64 = (hex) => (hex.slice(2).match(/.{64}/g) || []).map((x) => BigInt('0x' + x));
const mias = (D.billeteras || []).filter((x) => C.tipoDireccion(x.dir) === 'EVM');
const propias = new Map(mias.map((x) => [pad(x.dir), x.nombre]));
const ya = new Set(L.movs.map((m) => m.tx + m.cuenta));
const cachePrecio = {};
async function precio(sym, fecha) {
  if (ESTABLE.test(sym)) return 1;
  const key = sym + fecha.slice(0, 13);
  if (!(key in cachePrecio)) cachePrecio[key] = await C.precioPasado(sym, fecha).catch(() => null);
  return cachePrecio[key];
}
const r2 = (n) => Math.round(n * 100) / 100;

// Comisiones de una operación de pool: lo que salió de la pool menos lo que se sacó de capital (DecreaseLiquidity)
async function comisiones(rc, fecha) {
  const out = [];
  for (const c of rc.logs.filter((l) => l.address.toLowerCase() === NPM && l.topics[0] === EV.col)) {
    const id = BigInt(c.topics[1]).toString(), [, a0, a1] = w64(c.data);
    const d = rc.logs.find((l) => l.address.toLowerCase() === NPM && l.topics[0] === EV.dec && l.topics[1] === c.topics[1]);
    const [, d0, d1] = d ? w64(d.data) : [0n, 0n, 0n];
    const pc = rc.logs.filter((l) => l.topics[0] === EV.colPool && Number(l.logIndex) < Number(c.logIndex)).pop();
    if (!pc) continue;
    // las dos monedas de la pool se le preguntan a la propia pool (token0 / token1)
    const toks = await Promise.all(['0x0dfe1681', '0xd21220a7'].map(async (f) => '0x' + (await C.rpc(RED, 'eth_call', [{ to: pc.address, data: f }, 'latest'])).slice(-40)));
    const [t0, t1] = await Promise.all(toks.map((t) => C.token(RED, t)));
    const f0 = Number(a0 > d0 ? a0 - d0 : 0n) / 10 ** t0.dec, f1 = Number(a1 > d1 ? a1 - d1 : 0n) / 10 ** t1.dec;
    const usd = f0 * ((await precio(t0.sym, fecha)) ?? 0) + f1 * ((await precio(t1.sym, fecha)) ?? 0);
    out.push({ pool: id, usd: r2(usd), cant: { [t0.sym]: +f0.toPrecision(6), [t1.sym]: +f1.toPrecision(6) }, sacado: !!d });
  }
  return out;
}

/* ── Recorrer cada cuenta ── */
const FEST = join(dir, 'libro-estado.json');
if (existsSync(FEST)) { try { Object.assign(L.hasta, JSON.parse(readFileSync(FEST, 'utf8'))); } catch (e) {} }
const fin = Number(await C.rpc(RED, 'eth_blockNumber', []));
let inicioManual = null;
if (DESDE) {   // buscar el bloque de esa fecha (búsqueda partida por la mitad)
  const t = Date.parse(DESDE) / 1000; let lo = 1, hi = fin;
  while (hi - lo > 1000) { const m = Math.floor((lo + hi) / 2); const bl = await C.rpc(RED, 'eth_getBlockByNumber', ['0x' + m.toString(16), false]); if (Number(BigInt(bl.timestamp)) < t) lo = m; else hi = m; }
  inicioManual = lo;
}
// Leer registros por tramos con reintentos; si un tramo grande falla, se parte en trozos pequeños.
// Si aun así falla, se AVISA (antes se perdía en silencio y faltaban movimientos)
async function tramo(filtro, s, e, intentos = 6) {
  for (let i = 0; ; i++) {
    try { return await C.rpc(RED, 'eth_getLogs', [{ ...filtro, fromBlock: '0x' + s.toString(16), toBlock: '0x' + e.toString(16) }]); }
    catch (err) { if (i >= intentos - 1) throw err; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
}
async function logsSeguro(filtro, desde, hasta) {
  const out = [];
  for (let s = desde; s <= hasta; s += 10_000_000) {
    const e = Math.min(s + 10_000_000 - 1, hasta);
    try { out.push(...await tramo(filtro, s, e, 3)); }
    catch (err) { for (let t = s; t <= e; t += 1_000_000) out.push(...await tramo(filtro, t, Math.min(t + 999_999, e))); }
  }
  return out;
}
const nuevos = [];
for (const w of mias) {
  if (SOLO && w.dir.toLowerCase() !== SOLO.toLowerCase()) continue;
  const clave = w.dir.toLowerCase(), yo = pad(w.dir);
  const desde = inicioManual ?? (L.hasta[clave] ? L.hasta[clave] + 1 : fin - 3000);
  if (desde > fin) continue;
  let ls = [], ok = true;
  try { for (const a of TOKENS) for (const t of [[EV.tr, yo], [EV.tr, null, yo]]) ls.push(...await logsSeguro({ address: a, topics: t }, desde, fin)); }
  catch (e) { console.error('No pude leer una cuenta; se reintenta la próxima vez'); continue; }
  for (const h of [...new Set(ls.map((l) => l.transactionHash))]) {
    if (ya.has(h + w.nombre)) continue;
    try {
      const rc = await C.rpc(RED, 'eth_getTransactionReceipt', [h]);
      const blq = await C.rpc(RED, 'eth_getBlockByNumber', [rc.blockNumber, false]);
      const fecha = new Date(Number(BigInt(blq.timestamp)) * 1000).toISOString();
      // lo que entra (+) y sale (−) de esta cuenta, moneda a moneda
      const neto = {}; let conPropia = null, conOtros = false;
      for (const l of rc.logs) {
        if (l.topics[0] !== EV.tr || l.topics.length !== 3 || !TOKENS.includes(l.address.toLowerCase())) continue;
        const entra = l.topics[2] === yo, sale = l.topics[1] === yo;
        if (!entra && !sale) continue;
        const otro = entra ? l.topics[1] : l.topics[2];
        if (propias.has(otro) && otro !== yo) conPropia = { nombre: propias.get(otro), entra }; else conOtros = true;
        const t = await C.token(RED, l.address);
        neto[t.sym] = (neto[t.sym] || 0) + (entra ? 1 : -1) * Number(BigInt(l.data)) / 10 ** t.dec;
      }
      const ev = new Set(rc.logs.map((l) => l.topics[0]));
      const deNpm = (e) => rc.logs.find((l) => l.address.toLowerCase() === NPM && l.topics[0] === e);
      const deAave = (e) => rc.logs.some((l) => l.address.toLowerCase() === AAVE && l.topics[0] === e);
      const ent = Object.entries(neto).filter(([, c]) => Math.abs(c) > 1e-12);
      let tipo, pool = null, extra = {};
      if (deNpm(EV.col)) {
        const cs = await comisiones(rc, fecha);
        tipo = deNpm(EV.dec) ? 'pool-sacar' : 'pool-cobro';
        pool = BigInt(deNpm(EV.col).topics[1]).toString();
        if (cs.length) { extra.comisiones = { usd: r2(cs.reduce((s, c) => s + c.usd, 0)), cant: cs[0].cant }; }
      } else if (deNpm(EV.inc)) {
        pool = BigInt(deNpm(EV.inc).topics[1]).toString();
        tipo = rc.logs.some((l) => l.address.toLowerCase() === NPM && l.topics[0] === EV.tr && l.topics[1] === pad('0x0')) ? 'pool-abrir' : 'pool-añadir';
      } else if (deNpm(EV.dec)) { tipo = 'pool-sacar'; pool = BigInt(deNpm(EV.dec).topics[1]).toString(); }
      else if (ev.has(EV.v4)) tipo = 'pool-v4';
      else if (deAave(EV.supply)) tipo = 'aave-poner';
      else if (deAave(EV.withdraw)) tipo = 'aave-sacar';
      else if (deAave(EV.borrow)) tipo = 'aave-pedir';
      else if (deAave(EV.repay)) tipo = 'aave-devolver';
      else if (conPropia && !conOtros) {
        if (!conPropia.entra) continue;   // el paso se apunta una sola vez: en la cuenta que lo recibe
        tipo = 'paso'; extra.de = conPropia.nombre;
      } else {
        const sale = ent.filter(([, c]) => c < 0), entra = ent.filter(([, c]) => c > 0);
        const est = (x) => x.length && x.every(([s]) => ESTABLE.test(s));
        tipo = sale.length && entra.length ? (est(sale) && !est(entra) ? 'compra' : !est(sale) && est(entra) ? 'venta' : 'cambio') : entra.length ? 'entrada' : 'salida';
      }
      if (!ent.length && !extra.comisiones) continue;
      let vIn = 0, vOut = 0;
      for (const [s, c] of ent) { const p = (await precio(s, fecha)) ?? 0; if (c > 0) vIn += c * p; else vOut -= c * p; }
      if (Math.max(vIn, vOut) < 0.5 && !extra.comisiones) continue;   // migajas que mandan los estafadores para ensuciar el historial
      const m = { fecha, cuenta: w.nombre, tipo, tx: h, mov: Object.fromEntries(ent.map(([s, c]) => [s, +c.toPrecision(8)])), usd: r2(Math.max(vIn, vOut)), ...extra };
      if (pool) m.pool = pool;
      nuevos.push(m); ya.add(h + w.nombre);
    } catch (e) { ok = false; console.error('No pude leer una operación; se reintenta la próxima vez'); }
  }
  if (ok) L.hasta[clave] = fin;
}

writeFileSync(FEST, JSON.stringify(L.hasta));
if (nuevos.length || !existsSync(join(dir, FICH)) || DESDE) {   // el fichero del repo solo cambia si hay movimientos nuevos
  L.movs.push(...nuevos);
  L.movs.sort((a, b) => a.fecha.localeCompare(b.fecha));
  L.actualizado = new Date().toISOString();
  await cerrar(L, FICH);
}
console.log('Movimientos nuevos en el libro:', nuevos.length);   // el repo es público: no se escriben cantidades
if (NTFY_TEMA && !DESDE) for (const m of nuevos.filter((x) => x.comisiones?.usd >= 1)) {
  const t = '💰 Comisiones cobradas: ' + new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(m.comisiones.usd) + ' $';
  await fetch('https://ntfy.sh/' + NTFY_TEMA, { method: 'POST', body: `${m.cuenta} · pool ${m.pool}`,
    headers: { Title: '=?UTF-8?B?' + Buffer.from(t).toString('base64') + '?=', Tags: 'moneybag', Click: 'https://rewendolin.github.io/CriptoHouse/asistente/' } }).catch(() => {});
}
