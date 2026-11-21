// Cierra con candado los datos antes de subirlos (el repo es público).
// Uso: CLAVE='la-contraseña' node asistente/cifrar.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const clave = process.env.CLAVE;
if (!clave) { console.error('Falta CLAVE'); process.exit(1); }

const texto = readFileSync(join(dir, 'datos.json'), 'utf8');
JSON.parse(texto); // comprueba que el JSON es válido

const sal = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
const llave = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: sal, iterations: 250000, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, new TextEncoder().encode(texto));

const b64 = (u) => Buffer.from(u).toString('base64');
writeFileSync(join(dir, 'datos.enc.json'), JSON.stringify({
  v: 1, iter: 250000, sal: b64(sal), iv: b64(iv), datos: b64(new Uint8Array(cifrado))
}));
console.log('OK → asistente/datos.enc.json');
