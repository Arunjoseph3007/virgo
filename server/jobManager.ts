import { EventEmitter } from "stream";
import { setTimeout as wait } from "timers/promises";

export class JManager {
  private static queues: Record<string, any[]> = {};
  constructor() {}

  static ingest(id: string, data: any) {
    if (!(id in JManager.queues)) JManager.queues[id] = [];

    JManager.queues[id].push(data);
  }

  static retrieve(id: string) {
    if (!JManager.queues[id] || JManager.queues[id].length == 0) {
      return { found: false, data: null };
    }
    return { found: false, data: JManager.queues[id].shift()! };
  }
}

export class Job<T> {
  progress = 0;
  id: string;
  constructor(
    public data: T,
    public queueName: string
  ) {
    this.id = this.queueName + Math.floor(Math.random() * 100000).toString();
  }

  updateProgress(v: number) {
    this.progress = v;
  }
}

export class Queue<T> {
  constructor(public readonly name: string) {}

  add(data: T) {
    JManager.ingest(this.name, data);
  }
}

type WorkerEventmap<T> = {
  start: [job: Job<T>];
  completed: [job: Job<T>];
  success: [job: Job<T>, data: any];
  error: [job: Job<T>, err: any];
};

const WORKER_INTERVAL = 5 * 1000;
const WORKER_MAX_CONCURRENT = 5;

type JProc<T> = (j: Job<T>) => Promise<any>;

export class Worker<T> extends EventEmitter<WorkerEventmap<T>> {
  constructor(
    public readonly name: string,
    private readonly proc: JProc<T>
  ) {
    super();

    this.loop();
  }

  private async loop() {
    while (true) {
      await wait(WORKER_INTERVAL);

      for (let i = 0; i < WORKER_MAX_CONCURRENT; i++) {
        const { data, found } = JManager.retrieve(this.name);
        if (!found) break;

        const j = new Job<T>(data, this.name);

        this.emit("start", j);
        this.proc(j)
          .then((p) => {
            j.progress = 100;
            this.emit("success", j, p);
          })
          .catch((e) => {
            j.progress = -1;
            this.emit("error", j, e);
          })
          .finally(() => {
            this.emit("completed", j);
          });
      }
    }
  }
}
