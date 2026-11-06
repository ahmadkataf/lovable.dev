// Emergency activation without internet: a short list of codes the seller hands out personally to shops
// that have no connection at all. Only the SHA-256 of each code is here (the codes themselves are not in
// the repository), so the list cannot be read out of the app. Such a code activates the device
// permanently and is never checked online; give one only to a shop you trust, and replace the list
// (and rebuild) if one leaks.
export const OFFLINE_CODE_HASHES: string[] = [
  'a45fbd4bd3a2aefc7980adb006c85259c14069397e547ca1ba5c68d2d8cd75ee',
  '2db692c2a58d844f9bf6c29334f3ab456261f4fa0fa960861662c273ac359a5e',
]
