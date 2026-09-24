const reconciliationService = require('../services/reconciliationService');
const logger = require('../utils/logger');

let ticking = false;

async function tick() {
  if (ticking) return;
  ticking = true;

  try {
    await reconciliationService.requeueStaleJobs();
    const processed = await reconciliationService.processPendingJobs();
    if (processed > 0) {
      logger.info(`Reconciliation worker processed ${processed} job(s)`);
    }
  } catch (error) {
    logger.error(`Reconciliation worker tick failed: ${error.message}`, { stack: error.stack });
  } finally {
    ticking = false;
  }
}

function start() {
  const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS) || 2000;
  logger.info(`Reconciliation worker started, polling every ${intervalMs}ms`);
  tick();
  return setInterval(tick, intervalMs);
}

// Called by the API process right after an approval is accepted, so reconciliation typically
// runs within milliseconds instead of waiting for the next poll tick. Best-effort only - the
// polling loop (in the standalone worker process) is what actually guarantees the job runs.
function nudgeWorker() {
  setImmediate(() => {
    tick().catch((error) => logger.error(`Worker nudge failed: ${error.message}`));
  });
}

if (require.main === module) {
  require('dotenv').config();
  start();
}

module.exports = { start, tick, nudgeWorker };
