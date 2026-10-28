// electron-builder afterPack hook: flips the Electron fuses on the packaged executable.
// This is the anti-tamper layer: with EnableEmbeddedAsarIntegrityValidation + OnlyLoadAppFromAsar an app.asar that was
// edited after packaging (a cracked license client, injected scripts) refuses to start, and the Node debugging doors
// (ELECTRON_RUN_AS_NODE, NODE_OPTIONS, --inspect) are closed.
'use strict'

const path = require('node:path')
const fs = require('node:fs')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

/** The executable electron-builder just produced, per platform. */
function executableFor(context) {
  const name = context.packager.appInfo.productFilename
  const platform = context.electronPlatformName
  if (platform === 'win32') return path.join(context.appOutDir, name + '.exe')
  if (platform === 'darwin') return path.join(context.appOutDir, name + '.app', 'Contents', 'MacOS', name)
  const linuxName = context.packager.executableName || name
  return path.join(context.appOutDir, linuxName)
}

module.exports = async function afterPack(context) {
  const exe = executableFor(context)
  if (!fs.existsSync(exe)) throw new Error('after-pack: executable not found at ' + exe)
  await flipFuses(exe, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: context.electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })
  console.log('  • fuses flipped on ' + path.relative(process.cwd(), exe) + ' (asar integrity on, node doors closed)')
}

module.exports.executableFor = executableFor
