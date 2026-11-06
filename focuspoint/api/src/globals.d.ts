// shared/types.ts references the browser's PushSubscriptionJSON (lib.dom). The Worker has no DOM lib, so declare it here.
interface PushSubscriptionJSON {
  endpoint?: string
  expirationTime?: number | null
  keys?: Record<string, string>
}

// node:buffer is available at runtime (compatibility_flags = ["nodejs_compat"]); only the part media.ts uses is typed
// here, because the Worker compiles without @types/node.
declare module 'node:buffer' {
  interface NodeBuffer extends Uint8Array { toString(encoding?: 'base64' | 'utf8' | 'hex'): string }
  export const Buffer: {
    from(data: ArrayBufferLike, byteOffset?: number, length?: number): NodeBuffer
    from(data: string, encoding: 'base64' | 'utf8' | 'hex'): NodeBuffer
  }
}
