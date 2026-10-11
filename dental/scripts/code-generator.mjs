#!/usr/bin/env node
// Dentora activation codes — the seller's command-line generator. Private: never ship it to clinics.
// Needs Node 22.18+ (runs the app's TypeScript licence code directly) and the seller's private key file.
//
//   node scripts/code-generator.mjs <device> <standard|pro> [YYYY-MM-DD | 1y | 2y | lifetime]   (default: 1y)
//   node scripts/code-generator.mjs verify <device> <code>
//   node scripts/code-generator.mjs keygen <new-key-file>        (only to replace the key: see below)
//
// The private key is read from --key <file>, else $DENTORA_LICENSE_KEY, else ../secrets-for-user/dentora/license-private.jwk.
// The code is printed alone on stdout (easy to copy or capture); the details go to stderr.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkCode, clinicMessage, formatDeviceInput, importSigningKey, isDeviceNumber, isPlan, issueCode, parsePrivateKey, parseUntil } from '../tools/generator-lib.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_KEY = path.resolve(ROOT, '../secrets-for-user/dentora/license-private.jwk')
const USAGE = `Dentora activation codes

  node scripts/code-generator.mjs <device> <standard|pro> [YYYY-MM-DD | 1y | 2y | lifetime] [--key <file>]
      make a code for a device number (as shown in Settings → License); validity defaults to 1y
  node scripts/code-generator.mjs verify <device> <code>
      check a code against a device number (needs no private key)
  node scripts/code-generator.mjs keygen <new-key-file>
      create a NEW key pair. Only for replacing the key: put the printed public key in src/license/core.ts
      and release a new app version; every code issued with the old key stops working in that version.

The private key: --key <file>, or $DENTORA_LICENSE_KEY, or ${path.relative(process.cwd(), DEFAULT_KEY) || DEFAULT_KEY}

Examples
  node scripts/code-generator.mjs 7KQ4-M2XD pro lifetime
  node scripts/code-generator.mjs 7KQ4-M2XD standard 2027-12-31
  node scripts/code-generator.mjs verify 7KQ4-M2XD <code>`

const fail = (msg, code = 2) => { process.stderr.write(`error: ${msg}\n\n${USAGE}\n`); process.exit(code) }
let args = process.argv.slice(2)
let keyFile = process.env.DENTORA_LICENSE_KEY || DEFAULT_KEY
const k = args.indexOf('--key')
if (k >= 0) { keyFile = args[k + 1]; args = args.filter((_, i) => i !== k && i !== k + 1); if (!keyFile) fail('--key needs a file') }
if (!args.length || args.includes('-h') || args.includes('--help')) { process.stdout.write(USAGE + '\n'); process.exit(args.length ? 0 : 2) }

if (args[0] === 'keygen') {
  const out = args[1]
  if (!out) fail('keygen needs a file name for the new private key')
  if (fs.existsSync(out)) fail(`${out} already exists: refusing to overwrite a key`)
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const j = await crypto.subtle.exportKey('jwk', kp.privateKey)
  fs.writeFileSync(out, JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y, d: j.d, product: 'dentora', created: new Date().toISOString().slice(0, 10) }, null, 2) + '\n', { mode: 0o600 })
  process.stdout.write(`new private key: ${out}  (keep it secret, back it up)\npublic key for src/license/core.ts:\n  x: '${j.x}',\n  y: '${j.y}',\n`)
  process.exit(0)
}

if (args[0] === 'verify') {
  const [, device, ...rest] = args
  const code = rest.join('')
  if (!device || !code) fail('verify needs a device number and a code')
  if (!isDeviceNumber(device)) fail(`"${device}" is not a device number (8 characters, e.g. 7KQ4-M2XD)`)
  const r = await checkCode(formatDeviceInput(device), code)
  if (r.ok) {
    process.stdout.write(`valid · plan ${r.plan} · ${r.until ? `until ${r.until.toISOString().slice(0, 10)}` : 'lifetime'}\n`)
    process.exit(0)
  }
  process.stdout.write(`invalid · ${r.reason}\n`)
  process.exit(1)
}

const [device, plan, validity = '1y'] = args
if (!device || !plan) fail('a device number and a plan are required')
if (!isDeviceNumber(device)) fail(`"${device}" is not a device number (8 characters, e.g. 7KQ4-M2XD)`)
if (!isPlan(plan)) fail(`plan must be "standard" or "pro", not "${plan}"`)
const until = parseUntil(validity)
if (until === undefined) fail(`validity must be YYYY-MM-DD (today or later), 1y, 2y or lifetime — not "${validity}"`)
if (!fs.existsSync(keyFile)) fail(`the private key file was not found: ${keyFile}`, 3)
const parsed = parsePrivateKey(fs.readFileSync(keyFile, 'utf8'))
if (!parsed.ok) fail(parsed.reason === 'mismatch' ? `${keyFile} is not the key built into this version of the app` : `${keyFile} is not a Dentora private key`, 3)

const issued = await issueCode(device, plan, until, await importSigningKey(parsed.jwk))
process.stdout.write(issued.code + '\n')
process.stderr.write(`\n  device  ${issued.device}\n  plan    ${issued.plan}\n  until   ${issued.until ?? 'lifetime'}\n  code    ${issued.code}\n\n--- message for the clinic ---\n${clinicMessage(issued)}\n`)
