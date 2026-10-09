import { describe, it, expect } from "vitest";
import { SerializedQueue } from "../src/stellar/queue.js";

describe("SerializedQueue Unit Tests", () => {
  it("executes concurrent tasks sequentially in order", async () => {
    const queue = new SerializedQueue();
    const executionOrder: number[] = [];
    let isExecuting = false;
    let concurrencyDetected = false;

    const createTask = (id: number, delayMs: number) => {
      return async () => {
        if (isExecuting) {
          concurrencyDetected = true;
        }
        isExecuting = true;
        await new Promise((r) => setTimeout(r, delayMs));
        executionOrder.push(id);
        isExecuting = false;
        return id;
      };
    };

    // Dispatch 10 tasks concurrently
    const promises = [
      queue.enqueue(createTask(1, 30)),
      queue.enqueue(createTask(2, 20)),
      queue.enqueue(createTask(3, 10)),
      queue.enqueue(createTask(4, 25)),
      queue.enqueue(createTask(5, 15)),
      queue.enqueue(createTask(6, 10)),
      queue.enqueue(createTask(7, 20)),
      queue.enqueue(createTask(8, 15)),
      queue.enqueue(createTask(9, 10)),
      queue.enqueue(createTask(10, 5)),
    ];

    const results = await Promise.all(promises);

    expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(executionOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(concurrencyDetected).toBe(false);
  });

  it("continues processing subsequent tasks even if one task throws", async () => {
    const queue = new SerializedQueue();
    const completed: number[] = [];

    const p1 = queue.enqueue(async () => {
      completed.push(1);
      return 1;
    });

    const p2 = queue.enqueue(async () => {
      throw new Error("Task 2 failed");
    });

    const p3 = queue.enqueue(async () => {
      completed.push(3);
      return 3;
    });

    await expect(p1).resolves.toBe(1);
    await expect(p2).rejects.toThrow("Task 2 failed");
    await expect(p3).resolves.toBe(3);

    expect(completed).toEqual([1, 3]);
  });
});
