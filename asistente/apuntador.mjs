// 🧾 Apuntador de compras: cada 10 min mira si ha entrado BTC, ETH o ARB en tus cuentas y apunta a qué precio.
// Lo ejecuta GitHub Actions (vigia.yml) justo después del vigilante. Solo LEE la cadena, nunca mueve nada.
// Guarda lo apuntado CIFRADO en compras-auto.enc.json (la app lo junta con las compras de datos.json).
//   · Pagaste con USDC/USDT en la misma operación → precio EXACTO.
//   · Llegó de otra red o de una cuenta que no es tuya, sin pago visible → precio APROXIMADO (el de esa hora).
//   · No cuenta: pasos entre tus propias cuentas, sacar de una pool, sacar de Aave, cantidades de menos de 20 $.
// Las compras que apunto yo a mano en datos.json mandan sobre estas (misma operación → gana la manual).
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
const { CLAVE, NTFY_TEMA } = process.env;
if (!CLAVE) { console.error('Falta CLAVE'); process.exit(1); }

/* ── Candado (el mismo que la app) ── */
const b = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
const b64 = (u) => Buffer.from(u).toString('base64');
async function llave(sal, uso) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(CLAVE), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [uso]);
}
async function abrir(fichero) {
  const c = JSON.parse(readFileSync(join(dir, fichero), 'utf8'));
  const k = await llave(b(c.sal), 'decrypt');
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(c.iv) }, k, b(c.datos))));
}
async function cerrar(obj, fichero) {
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await llave(sal, 'encrypt');
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(obj)));
  writeFileSync(join(dir, fichero), JSON.stringify({ v: 1, iter: 250000, sal: b64(sal), iv: b64(iv), datos: b64(new Uint8Array(datos)) }));
}

const D = await abrir('datos.enc.json');
const FICH = 'compras-auto.enc.json';
const A = existsSync(join(dir, FICH)) ? await abrir(FICH) : { hasta: {}, compras: [] };

/* ── Qué se vigila ── */
const RED = 'arbitrum';
const VIGILO = { '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': ['WBTC', 8], '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': ['WETH', 18], '0x912ce59144191c1204e64559fe8253a0e49e6548': ['ARB', 18] };
const ESTABLES = { '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 6, '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 6, '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6, '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': 18 };
const k = (s) => '0x' + globalThis.keccak_256(s);
const TRANSFER = k('Transfer(address,address,uint256)');
const NO_ES_COMPRA = new Set([   // si la operación lleva alguno de estos, es sacar de una pool o de Aave, no comprar
  k('DecreaseLiquidity(uint256,uint128,uint256,uint256)'), k('Collect(uint256,address,uint256,uint256)'),
  k('ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)'), k('Withdraw(address,address,address,uint256)'),
]);
const pad = (d) => '0x' + d.slice(2).toLowerCase().padStart(64, '0');
const mias = (D.billeteras || []).filter((x) => C.tipoDireccion(x.dir) === 'EVM');
const propias = new Set(mias.map((x) => pad(x.dir)));
const yaManual = new Set([...(D.compras || []).map((c) => c.tx?.toLowerCase()), ...(D.noEsCompra || []).map((t) => t.toLowerCase())].filter(Boolean));
const yaAuto = new Set(A.compras.map((c) => c.tx.toLowerCase() + c.token));

// Hasta dónde he mirado: en la caché de Actions (cambia cada 10 min, no se sube al repo); si no está, lo del fichero cifrado
const FEST = join(dir, 'apuntador-estado.json');
if (existsSync(FEST)) { try { Object.assign(A.hasta, JSON.parse(readFileSync(FEST, 'utf8'))); } catch (e) {} }
const fin = Number(await C.rpc(RED, 'eth_blockNumber', []));
const nuevas = [];
for (const w of mias) {
  const clave = w.dir.toLowerCase();
  const desde = A.hasta[clave] ? A.hasta[clave] + 1 : fin - 3000;   // cuenta nueva: empieza desde ahora (~12 min atrás)
  if (desde > fin) continue;
  const yo = pad(w.dir);
  const entradas = (await Promise.all(Object.keys(VIGILO).map((t) => C.logs(RED, { address: t, topics: [TRANSFER, null, yo] }, desde, fin)))).flat();
  const porTx = [...new Set(entradas.map((l) => l.transactionHash))];
  let ok = true;
  for (const h of porTx) {
    try {
      const rc = await C.rpc(RED, 'eth_getTransactionReceipt', [h]);
      if (rc.logs.some((l) => NO_ES_COMPRA.has(l.topics[0]))) continue;
      const tx = await C.rpc(RED, 'eth_getTransactionByHash', [h]);
      const blq = await C.rpc(RED, 'eth_getBlockByNumber', [rc.blockNumber, false]);
      const fecha = new Date(Number(BigInt(blq.timestamp)) * 1000).toISOString();
      let pagado = 0;
      for (const l of rc.logs) {
        const dec = ESTABLES[l.address.toLowerCase()];
        if (dec == null || l.topics[0] !== TRANSFER || l.topics.length !== 3) continue;
        if (l.topics[1] === yo) pagado += Number(BigInt(l.data)) / 10 ** dec;
        if (l.topics[2] === yo) pagado -= Number(BigInt(l.data)) / 10 ** dec;
      }
      const recibido = {};
      for (const l of rc.logs) {
        const t = VIGILO[l.address.toLowerCase()];
        if (!t || l.topics[0] !== TRANSFER || l.topics[2] !== yo || propias.has(l.topics[1])) continue;
        recibido[t[0]] = (recibido[t[0]] || 0) + Number(BigInt(l.data)) / 10 ** t[1];
      }
      const toks = Object.entries(recibido);
      for (const [token, cant] of toks) {
        if (yaManual.has(h.toLowerCase()) || yaAuto.has(h.toLowerCase() + token)) continue;
        const ahora = await C.precioPasado(token, fecha).catch(() => null);
        let c;
        if (pagado > 1 && toks.length === 1) {
          c = { precio: +(pagado / cant).toFixed(2), pagado: +pagado.toFixed(2), origen: 'USDC/USDT → ' + token };
        } else if (pagado <= 1 && tx.from.toLowerCase() !== clave && ahora) {
          c = { precio: ahora, pagado: +(cant * ahora).toFixed(2), aprox: true, origen: 'Llegó de otra red o cuenta', nota: 'Precio aproximado (el de esa hora). Si me dices lo que pagaste, lo corrijo.' };
        } else continue;   // p. ej. cambio de un token por otro: no es compra con dinero
        if (c.pagado < 20) continue;
        nuevas.push({ token, cantidad: +cant.toFixed(10), fecha, billetera: w.nombre, tx: h, auto: true, ...c });
      }
    } catch (e) { ok = false; console.error('No pude leer una operación; se reintenta la próxima vez'); }
  }
  if (ok) A.hasta[clave] = fin;   // si algo falló, no avanzo: la próxima vez se vuelve a mirar
}

writeFileSync(FEST, JSON.stringify(A.hasta));
if (nuevas.length || !existsSync(join(dir, FICH))) {   // el fichero del repo solo cambia si hay compras nuevas
  A.compras.push(...nuevas);
  A.actualizado = new Date().toISOString();
  await cerrar(A, FICH);
}
console.log('Compras nuevas apuntadas:', nuevas.length);   // el repo es público: no se escriben cantidades
if (NTFY_TEMA) for (const c of nuevas) {
  const n = new Intl.NumberFormat('es-ES', { maximumFractionDigits: c.token === 'WBTC' ? 5 : 3 }).format(c.cantidad);
  const p = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(c.precio);
  const t = '🧾 Compra apuntada: ' + n + ' ' + c.token.replace(/^W(?=BTC|ETH)/, '');
  await fetch('https://ntfy.sh/' + NTFY_TEMA, { method: 'POST', body: `${c.billetera}: a ${c.aprox ? '≈' : ''}${p} $ cada uno (${c.pagado} $).${c.aprox ? ' Precio aproximado.' : ''}`,
    headers: { Title: '=?UTF-8?B?' + Buffer.from(t).toString('base64') + '?=', Tags: 'receipt', Click: 'https://rewendolin.github.io/CriptoHouse/asistente/' } }).catch(() => {});
}
