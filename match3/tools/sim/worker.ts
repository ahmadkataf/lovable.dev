/** Worker thread of the simulator pool (see pool.ts): runs one job per message. */
import { parentPort } from 'node:worker_threads';
import { runJob, type SimJob } from './stats.ts';

if (parentPort) {
  const port = parentPort;
  port.on('message', (msg: { index: number; job: SimJob }) => {
    try {
      port.postMessage({ index: msg.index, result: runJob(msg.job) });
    } catch (err) {
      port.postMessage({ index: msg.index, error: err instanceof Error ? (err.stack ?? err.message) : String(err) });
    }
  });
}
