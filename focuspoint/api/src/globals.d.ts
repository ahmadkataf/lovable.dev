// shared/types.ts references the browser's PushSubscriptionJSON (lib.dom). The Worker has no DOM lib, so declare it here.
interface PushSubscriptionJSON {
  endpoint?: string
  expirationTime?: number | null
  keys?: Record<string, string>
}
