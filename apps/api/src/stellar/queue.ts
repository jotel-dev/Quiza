export type QueueTask<T> = () => Promise<T>;

export class SerializedQueue {
  private queue: Promise<any> = Promise.resolve();

  async enqueue<T>(task: QueueTask<T>): Promise<T> {
    const run = async () => {
      return await task();
    };

    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }
}

export const verifierQueue = new SerializedQueue();
