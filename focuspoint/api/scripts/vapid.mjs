// Prints a fresh VAPID key pair (base64url, the format every Web Push library and the browser expect).
// Usage: npm run vapid  → paste into `wrangler secret put VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (and .dev.vars).
import { webcrypto } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const key = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const jwk = await webcrypto.subtle.exportKey('jwk', key.privateKey)
const x = Buffer.from(jwk.x, 'base64url'), y = Buffer.from(jwk.y, 'base64url')
const publicKey = b64url(Buffer.concat([Buffer.from([0x04]), x, y]))   // uncompressed P-256 point, 65 bytes
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`)
console.log('VAPID_SUBJECT=mailto:owner@example.com   # change to the centre\'s email')
