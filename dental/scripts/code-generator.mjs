#!/usr/bin/env node
// Dentora activation codes — the seller's command-line generator. Private: never ship it to clinics.
// Needs Node 22.18+ (runs the app's TypeScript licence code directly).
//
//   node scripts/code-generator.mjs <device> <standard|pro> [YYYY-MM-DD | 1y | 2y | lifetime]   (default: 1y)
//   node scripts/code-generator.mjs verify <device> <code>
//
// The code is printed alone on stdout (easy to copy or capture); the details go to stderr.
import { checkCode, clinicMessage, formatDeviceInput, isDeviceNumber, isPlan, issueCode, parseUntil } from '../tools/generator-lib.ts'

const USAGE = `Dentora activation codes

  node scripts/code-generator.mjs <device> <standard|pro> [YYYY-MM-DD | 1y | 2y | lifetime]
      make a code for a device number (as shown in Settings → License); validity defaults to 1y
  node scripts/code-generator.mjs verify <device> <code>
      check a code against a device number

Examples
  node scripts/code-generator.mjs 7KQ4-M2XD pro lifetime
  node scripts/code-generator.mjs 7KQ4-M2XD standard 2027-12-31
  node scripts/code-generator.mjs verify 7KQ4-M2XD ABCD-EFGH-JKLM-NPQR`

const fail = (msg, code = 2) => { process.stderr.write(`error: ${msg}\n\n${USAGE}\n`); process.exit(code) }
const args = process.argv.slice(2)
if (!args.length || args.includes('-h') || args.includes('--help')) { process.stdout.write(USAGE + '\n'); process.exit(args.length ? 0 : 2) }

if (args[0] === 'verify') {
  const [, device, code] = args
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

const issued = await issueCode(device, plan, until)
process.stdout.write(issued.code + '\n')
process.stderr.write(`\n  device  ${issued.device}\n  plan    ${issued.plan}\n  until   ${issued.until ?? 'lifetime'}\n  code    ${issued.code}\n\n--- message for the clinic ---\n${clinicMessage(issued)}\n`)
