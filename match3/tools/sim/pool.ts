/**
 * A tiny worker_threads pool for simulation jobs. Other work shares this machine, so the pool
 * never uses more than MAX_WORKERS threads.
 */
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import type { JobResult, SimJob } from './stats.ts';

export const MAX_WORKERS = 3;

export function workerCount(requested?: number): number {
  const cpus = Math.max(1, availableParallelism() - 1);
  const want = requested !== undefined && Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : MAX_WORKERS;
  return Math.max(1, Math.min(MAX_WORKERS, cpus, want));
}

/**
 * Run every job and resolve with the results in job order. Jobs are handed out one at a time,
 * so slow levels do not hold up a whole batch.
 */
export function runJobs(jobs: readonly SimJob[], workers?: number, onResult?: (result: JobResult, done: number) => void): Promise<JobResult[]> {
  return new Promise<JobResult[]>((resolve, reject) => {
    const results: JobResult[] = new Array<JobResult>(jobs.length);
    if (jobs.length === 0) {
      resolve(results);
      return;
    }
    const count = Math.min(workerCount(workers), jobs.length);
    const pool: Worker[] = [];
    let next = 0;
    let done = 0;
    let failed = false;

    const stop = (): void => {
      for (const w of pool) void w.terminate();
    };
    const give = (worker: Worker): void => {
      if (next >= jobs.length) return;
      const index = next++;
      worker.postMessage({ index, job: jobs[index] });
    };

    for (let k = 0; k < count; k++) {
      const worker = new Worker(new URL('./worker.ts', import.meta.url));
      pool.push(worker);
      worker.on('message', (msg: { index: number; result?: JobResult; error?: string }) => {
        if (failed) return;
        if (msg.error !== undefined || msg.result === undefined) {
          failed = true;
          stop();
          reject(new Error(msg.error ?? 'worker returned nothing'));
          return;
        }
        results[msg.index] = msg.result;
        done++;
        if (onResult) onResult(msg.result, done);
        if (done === jobs.length) {
          stop();
          resolve(results);
        } else {
          give(worker);
        }
      });
      worker.on('error', (err) => {
        if (failed) return;
        failed = true;
        stop();
        reject(err);
      });
      give(worker);
    }
  });
}
