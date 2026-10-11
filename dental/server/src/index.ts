// Dentora's Worker (dentora-api), served at https://dentora.raqeem.dev and https://dentora-api.almutafawiqin.workers.dev.
// It answers what the Worker answers today, so deploying this file changes nothing until the Worker gets real work.
export default {
  async fetch(): Promise<Response> {
    return new Response('Hello World!', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
  },
} satisfies ExportedHandler
