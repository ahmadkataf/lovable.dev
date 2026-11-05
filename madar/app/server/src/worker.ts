// Worker entry: the Hono app, the Durable Object class that holds the database, and a daily reseed of the demo data
// (the seed's dates are relative to "today", so the demo stays current without anyone touching it).
import app from './index'
import { MadarDB } from './do'
import type { DbStub } from './dbshim'
import type { Env } from './types'
import schemaSql from '../schema.sql'
import seedSql from '../seed.sql'

export { MadarDB }

export async function reseed(env: Env): Promise<Record<string, number>> {
  if (!env.MADAR_DO) throw new Error('no MADAR_DO binding')
  const stub = env.MADAR_DO.get(env.MADAR_DO.idFromName('main')) as unknown as DbStub
  await stub.reset()
  await stub.execScript(schemaSql)
  await stub.execScript(seedSql)
  return stub.health()
}

export default {
  fetch: app.fetch,
  // 03:00 UTC = 06:00 Damascus: fresh demo data every morning before school hours.
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => { ctx.waitUntil(reseed(env)) },
}
