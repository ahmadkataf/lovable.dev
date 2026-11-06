// Worker entry: the Hono app, the Durable Object class that holds the database, and a daily reseed of the demo data
// (the seed's dates are relative to "today", so the demo stays current without anyone touching it).
import app from './index'
import { MadarDB } from './do'
import { doDatabase, type DbStub } from './dbshim'
import type { Env } from './types'
import { directorateOverview } from './routes/directorate'
import { reportDate } from './util'
import schemaSql from '../schema.sql'
import seedSql from '../seed.sql'

export { MadarDB }

/**
 * Fresh demo data, then a warm-up: the substitute engine fills the demo day's pending periods with ranked candidates
 * (and tells the school accounts), and the directorate's alerts of the day are stored as notifications — so the bells
 * are not empty before anyone has opened a dashboard.
 */
export async function reseed(env: Env): Promise<Record<string, number>> {
  if (!env.MADAR_DO) throw new Error('no MADAR_DO binding')
  const stub = env.MADAR_DO.get(env.MADAR_DO.idFromName('main')) as unknown as DbStub
  await stub.reset()
  await stub.execScript(schemaSql)
  await stub.execScript(seedSql)
  await directorateOverview(doDatabase(stub), env, reportDate())
  return stub.health()
}

export default {
  fetch: app.fetch,
  // 03:00 UTC = 06:00 Damascus: fresh demo data every morning before school hours.
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => { ctx.waitUntil(reseed(env)) },
}
