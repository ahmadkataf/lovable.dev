// Android App Links / Trusted Web Activity: Digital Asset Links for the package, built from the ASSETLINKS_FINGERPRINTS var
// (comma-separated SHA-256 fingerprints with colons) and served by the Worker at /.well-known/assetlinks.json, so the domain
// never needs a static file and a new signing key is just a var change.
export const ANDROID_PACKAGE = 'com.focuspoint.app'
const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/

export function assetLinks(fingerprints: string | undefined): unknown[] {
  const list = (fingerprints ?? '').split(',').map((f) => f.trim().toUpperCase()).filter((f) => FINGERPRINT_RE.test(f))
  if (list.length === 0) return []
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: list },
  }]
}
