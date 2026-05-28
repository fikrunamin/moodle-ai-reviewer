import { logger } from "../shared/logger";

type Job = () => Promise<void>;

export class JobQueue {
  private queue: Job[] = [];
  private running = false;
  private pending = 0;

  enqueue(job: Job) {
    this.queue.push(job);
    this.pending += 1;
    void this.run();
  }

  getStatus() {
    return { running: this.running, queued: this.queue.length, pending: this.pending };
  }

  private async run() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (job) {
        try {
          await job();
        } catch (error) {
          logger.error("Queued job failed", error);
        } finally {
          this.pending -= 1;
        }
      }
    }

    this.running = false;
  }
}
