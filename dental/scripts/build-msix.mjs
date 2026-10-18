#!/usr/bin/env node
// Builds the Microsoft Store package (MSIX) of Dentora for Windows from the unpacked Electron app, on Linux or
// Windows, without a code-signing certificate: the Microsoft Store signs MSIX packages itself after certification.
//
//   npx electron-builder --win --dir                       → release/win-unpacked/ (Dentora.exe and the app)
//   MSIX_IDENTITY_NAME=…  MSIX_PUBLISHER='CN=…'  MSIX_PUBLISHER_DISPLAY_NAME=…  node scripts/build-msix.mjs
//                                                          → release/Dentora-<version>-x64.msix
//
// The three identity values must be copied exactly (case and spaces too) from Partner Center → the app → Product
// management → Product identity: Package/Identity/Name, Package/Identity/Publisher, Package/Properties/
// PublisherDisplayName. Without them the script makes a test package named Dentora-<version>-x64-TEST.msix with
// placeholder identity values, which the Store would refuse: it is for checking the build and for a try-out on
// Windows 11 (Add-AppxPackage -AllowUnsigned, see below). The Store package is left unsigned: the Store signs it.
//
// Needs: makemsix with pack support (Microsoft's msix-packaging SDK: ./makelinux.sh --pack, or makewin.cmd --pack on
// Windows), in PATH or in MAKEMSIX; and Chromium from Playwright to draw the tiles from public/icon.svg.
// The package declares the app a packaged full-trust desktop app (runFullTrust), so the Store asks why on submission:
// "Dentora is an Electron desktop app; it needs full trust to run as a normal Windows program (its window, printing and
// saving backup files where the user chooses)".
// Windows keeps a packaged app's AppData in the package's own folder and deletes it when the app is uninstalled:
// clinics must save a backup before uninstalling (the listing, the guide and the privacy policy say so, as for Android).
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const die = (msg) => { console.error(`build-msix: ${msg}`); process.exit(1) }

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version)
if (!m) die(`package.json version "${pkg.version}" is not x.y.z`)
// the fourth part is reserved for the Store and must be 0
const VERSION = `${m[1]}.${m[2]}.${m[3]}.0`

const APP = join(ROOT, 'release', 'win-unpacked')
if (!existsSync(join(APP, 'Dentora.exe'))) die('release/win-unpacked/Dentora.exe not found: run `npx electron-builder --win --dir` first')

const NAME = process.env.MSIX_IDENTITY_NAME || ''
const PUBLISHER = process.env.MSIX_PUBLISHER || ''
const PUBLISHER_NAME = process.env.MSIX_PUBLISHER_DISPLAY_NAME || ''
const store = !!(NAME && PUBLISHER && PUBLISHER_NAME)
if (!store && (NAME || PUBLISHER || PUBLISHER_NAME)) die('set all three of MSIX_IDENTITY_NAME, MSIX_PUBLISHER and MSIX_PUBLISHER_DISPLAY_NAME, or none (test package)')
if (store && !/^CN=/.test(PUBLISHER)) die('MSIX_PUBLISHER must be the full "CN=…" string from Partner Center')
if (store && !/^[A-Za-z0-9.-]{3,50}$/.test(NAME)) die('MSIX_IDENTITY_NAME looks wrong (letters, digits, dots and hyphens, 3–50 characters)')
const identity = store
  ? { name: NAME, publisher: PUBLISHER, publisherName: PUBLISHER_NAME }
  // the OID marks an unsigned package Windows 11 may install for a try-out:
  //   Add-AppxPackage -Path Dentora-<version>-x64-TEST.msix -AllowUnsigned   (PowerShell, Windows 11)
  : { name: 'Raqeem.Dentora.Test', publisher: 'CN=Dentora Test, OID.2.25.311729368913984317654407730594956997722=1', publisherName: 'Raqeem (test build)' }

const makemsix = process.env.MAKEMSIX || 'makemsix'
try { execFileSync(makemsix, [], { stdio: 'ignore' }) } catch (e) {
  if (e.code === 'ENOENT') die(`makemsix not found (${makemsix}): build Microsoft's msix-packaging with --pack and set MAKEMSIX`)
}

const OUT = join(ROOT, 'release', `Dentora-${pkg.version}-x64${store ? '' : '-TEST'}.msix`)
const STAGE = join(ROOT, 'release', 'msix-stage')
rmSync(STAGE, { recursive: true, force: true })
cpSync(APP, STAGE, { recursive: true })
mkdirSync(join(STAGE, 'Assets'), { recursive: true })

// ---- the tiles: the app icon on its own colour, at the sizes the manifest names (no resources.pri: one file each) --
const { chromium } = await import('playwright')
const svg = readFileSync(join(ROOT, 'public', 'icon.svg'), 'utf8')
const tiles = [
  // [file, width, height, icon size as a share of the height, background]
  ['StoreLogo.png', 50, 50, 1, 'transparent'],
  ['Square44x44Logo.png', 44, 44, 1, 'transparent'],
  ['Square150x150Logo.png', 150, 150, 0.62, '#0E8F86'],
  ['Wide310x150Logo.png', 310, 150, 0.62, '#0E8F86'],
  ['Square310x310Logo.png', 310, 310, 0.5, '#0E8F86'],
  ['SplashScreen.png', 620, 300, 0.5, '#0E8F86'],
]
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const [file, w, h, share, bg] of tiles) {
    const size = Math.round(h * share)
    await page.setViewportSize({ width: w, height: h })
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;display:grid;place-items:center;background:${bg}">
<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`)
    await page.screenshot({ path: join(STAGE, 'Assets', file), omitBackground: bg === 'transparent', clip: { x: 0, y: 0, width: w, height: h } })
  }
} finally {
  await browser.close()
}

// ---- the manifest ---------------------------------------------------------------------------------------------------
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const description = 'Dental clinic management that works offline: patients, dental chart, appointments, treatment plans, invoices and reports, in Arabic and English.'
writeFileSync(join(STAGE, 'AppxManifest.xml'), `<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap uap10 rescap">
  <Identity Name="${xml(identity.name)}" Publisher="${xml(identity.publisher)}" Version="${VERSION}" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>Dentora</DisplayName>
    <PublisherDisplayName>${xml(identity.publisherName)}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
    <Description>${xml(description)}</Description>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-US" />
    <Resource Language="ar" />
  </Resources>
  <Applications>
    <Application Id="Dentora" Executable="Dentora.exe" uap10:RuntimeBehavior="packagedClassicApp" uap10:TrustLevel="mediumIL">
      <uap:VisualElements DisplayName="Dentora" Description="${xml(description)}" BackgroundColor="transparent"
        Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\\Wide310x150Logo.png" Square310x310Logo="Assets\\Square310x310Logo.png" ShortName="Dentora">
          <uap:ShowNameOnTiles>
            <uap:ShowOn Tile="square150x150Logo" />
            <uap:ShowOn Tile="wide310x150Logo" />
            <uap:ShowOn Tile="square310x310Logo" />
          </uap:ShowNameOnTiles>
        </uap:DefaultTile>
        <uap:SplashScreen Image="Assets\\SplashScreen.png" BackgroundColor="#0E8F86" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <Capability Name="internetClient" />
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
`)

rmSync(OUT, { force: true })
execFileSync(makemsix, ['pack', '-d', STAGE, '-p', OUT], { stdio: 'inherit' })

// ---- check: unpack it again and compare the manifest and the main executable ----------------------------------------
const CHECK = join(ROOT, 'release', 'msix-check')
rmSync(CHECK, { recursive: true, force: true })
execFileSync(makemsix, ['unpack', '-p', OUT, '-d', CHECK, '-ss'], { stdio: 'ignore' })
const same = (f) => readFileSync(join(CHECK, f)).equals(readFileSync(join(STAGE, f)))
if (!same('AppxManifest.xml') || !same('Dentora.exe') || !same(join('resources', 'app.asar'))) die('the unpacked package differs from what was packed')
rmSync(CHECK, { recursive: true, force: true })
rmSync(STAGE, { recursive: true, force: true })
console.log(`${OUT}\n  ${identity.name} · ${identity.publisher} · ${VERSION}${store ? '' : '  (TEST identity: not for the Store)'}`)
