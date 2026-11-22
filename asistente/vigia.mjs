// 🔔 Vigilante: cada pocos minutos mira tus pools y Aave, y te avisa al móvil (ntfy) si algo cambia.
// Lo ejecuta GitHub Actions (.github/workflows/vigia.yml). Solo LEE la cadena, nunca mueve nada.
// Necesita: CLAVE (para abrir datos.enc.json), NTFY_TEMA (canal de avisos), sha3.min.js junto a este fichero.
// Estado (lo ya avisado) en vigia-estado.json — se guarda en la caché de Actions, no en el repo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
globalThis.keccak_256 = require(join(dir, 'sha3.min.js')).keccak_256;
require(join(dir, 'cadena.js'));
const C = globalThis.Cadena;
const { CLAVE, NTFY_TEMA, PRUEBA } = process.env;
if (!CLAVE || !NTFY_TEMA) { console.error('Faltan CLAVE o NTFY_TEMA'); process.exit(1); }

/* ── Abrir los datos cifrados ── */
const c = JSON.parse(readFileSync(join(dir, 'datos.enc.json'), 'utf8'));
const b = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(CLAVE), 'PBKDF2', false, ['deriveKey']);
const llave = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(c.sal), iterations: c.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
const D = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(c.iv) }, llave, b(c.datos))));

const ficheroEstado = join(dir, 'vigia-estado.json');
const estado = existsSync(ficheroEstado) ? JSON.parse(readFileSync(ficheroEstado, 'utf8')) : {};
const APP = 'https://rewendolin.github.io/CriptoHouse/asistente/';
const n0 = (x) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(x);

async function avisar(titulo, texto, prioridad = 'default', etiquetas = 'bell') {
  console.log('Aviso enviado');   // el repo es público: no se escribe el contenido en el registro
  const r = await fetch('https://ntfy.sh/' + NTFY_TEMA, {
    method: 'POST', body: texto,
    headers: { Title: titulo, Priority: prioridad, Tags: etiquetas, Click: APP },
  });
  if (!r.ok) console.error('ntfy respondió', r.status);
}
// Título con acentos y emojis: ntfy acepta UTF-8 si va codificado así
const titulo = (t) => '=?UTF-8?B?' + Buffer.from(t).toString('base64') + '?=';

if (PRUEBA) await avisar(titulo('✅ Alarmas de tu cartera activadas'), 'Te avisaré cuando una pool entre o salga de su rango, si Aave se pone en peligro o si salta una alarma de precio.', 'default', 'white_check_mark');

const nombre = (d) => (D.billeteras || []).find((x) => x.dir.toLowerCase() === d.toLowerCase())?.nombre || d.slice(0, 7) + '…' + d.slice(-5);
const evm = (D.billeteras || []).filter((x) => C.tipoDireccion(x.dir) === 'EVM');

/* ── 💧 Pools: avisa cuando cambian de zona ── */
for (const bill of evm) {
  const ps = await C.posicionesV3(bill.dir).catch(() => []);
  const v4ids = (D.foto || []).filter((p) => p.version === 'v4' && p.dueño?.toLowerCase() === bill.dir.toLowerCase()).map((p) => p.id);
  const v4 = await Promise.all(v4ids.map((id) => C.leerV4(id).catch(() => null)));
  for (const p of [...ps, ...v4.filter(Boolean)]) {
    if (!p.activa) continue;
    const k = 'pool-' + p.version + '-' + p.id;
    const [a, z] = p.rango, zona = p.precio < a ? 'abajo' : p.precio > z ? 'arriba' : 'dentro';
    const antes = estado[k]?.zona;
    estado[k] = { zona, visto: new Date().toISOString(), haEstadoDentro: estado[k]?.haEstadoDentro || zona === 'dentro' };
    if (!antes || antes === zona) continue;          // la primera vez solo apunta
    const par = p.par.join('/'), quien = nombre(bill.dir);
    if (zona === 'abajo') {
      await avisar(titulo(`🔴 ${par} salió POR DEBAJO`), `${quien}: el precio (${n0(p.precio)}) bajó de ${n0(a)}. Todo es ya ${p.par[0]}: puedes retirarlo.`, 'urgent', 'rotating_light');
    } else if (zona === 'arriba') {
      await avisar(titulo(`🟠 ${par} salió por arriba`), `${quien}: el precio (${n0(p.precio)}) pasó de ${n0(z)}. Todo es ya ${p.par[1]}.`, 'high', 'warning');
    } else {
      await avisar(titulo(`🟢 ${par} entró en rango`), `${quien}: precio ${n0(p.precio)} (rango ${n0(a)}–${n0(z)}). Ya cobra tarifas.`, 'default', 'green_circle');
    }
  }
}

/* ── 🏦 Aave: avisa si la salud baja de 1,3 (y otra vez si baja de 1,15) ── */
for (const bill of evm) {
  for (const x of await C.aave(bill.dir).catch(() => [])) {
    if (x.hf == null) continue;
    const k = 'aave-' + bill.dir.toLowerCase() + '-' + x.red, nivel = x.hf < 1.15 ? 2 : x.hf < 1.3 ? 1 : 0;
    const antes = estado[k]?.nivel ?? 0;
    estado[k] = { nivel: nivel > 0 || x.hf > 1.4 ? nivel : antes, hf: x.hf };
    if (nivel > antes) await avisar(titulo(`${nivel === 2 ? '🚨' : '⚠️'} Aave en peligro (${nombre(bill.dir)})`), `Salud ${x.hf.toFixed(2)}. Por debajo de 1 te liquidan. Añade garantía o devuelve parte de la deuda.`, nivel === 2 ? 'urgent' : 'high', 'warning');
  }
}

/* ── 🎯 Alarmas de precio que me pidas (datos.json → alarmas) ── */
const alarmas = D.alarmas || [];
if (alarmas.length) {
  const pr = await C.precios([...new Set(alarmas.map((a) => a.token))]).catch(() => ({}));
  for (const a of alarmas) {
    const p = pr[a.token]?.usd; if (p == null) continue;
    const k = 'alarma-' + a.id, salta = (a.bajaDe != null && p < a.bajaDe) || (a.subeDe != null && p > a.subeDe);
    if (salta && !estado[k]?.saltada) await avisar(titulo(`🎯 ${a.token} a ${n0(p)}`), a.texto || `Tu alarma de ${a.token} ha saltado.`, 'high', 'dart');
    estado[k] = { saltada: salta };
  }
}

writeFileSync(ficheroEstado, JSON.stringify(estado, null, 1));
console.log('Revisado', new Date().toISOString());
