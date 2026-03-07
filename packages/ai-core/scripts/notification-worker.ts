import {
  processNotificationOutboxBatch,
} from "../src/event-automation/service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const pollMs = Number(process.env.NOTIFICATION_WORKER_POLL_MS ?? 2000);
  const batchSize = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE ?? 100);
  const baseBackoffMs = Number(process.env.NOTIFICATION_WORKER_BASE_BACKOFF_MS ?? 5000);

  console.log("[notification-worker] started", {
    pollMs,
    batchSize,
    baseBackoffMs,
  });

  while (true) {
    try {
      const res = await processNotificationOutboxBatch({ batchSize, baseBackoffMs });
      if (res.claimed > 0) {
        console.log("[notification-worker] batch", res);
      }
      if (res.claimed === 0) {
        await sleep(pollMs);
      }
    } catch (error: unknown) {
      console.error("[notification-worker] loop error", error);
      await sleep(Math.max(pollMs, 3000));
    }
  }
}

main().catch((error) => {
  console.error("[notification-worker] fatal", error);
  process.exit(1);
});
