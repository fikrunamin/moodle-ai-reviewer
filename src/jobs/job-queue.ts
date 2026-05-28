type Job = () => Promise<void>;

export class JobQueue {
  private queue: Job[] = [];
  private running = false;

  enqueue(job: Job) {
    this.queue.push(job);
    void this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (job) await job();
    }

    this.running = false;
  }
}
