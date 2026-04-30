import { EventEmitter } from "stream";
import { setTimeout as wait } from "timers/promises";

type TJobQItem = {
  jobId: string;
  data: any;
};
export class JManager {
  private static queues: Record<string, TJobQItem[]> = {};
  private static jobs: Record<string, Job<any>> = {};

  static ingest(qid: string, jobId: string, data: any) {
    if (!(qid in JManager.queues)) JManager.queues[qid] = [];

    JManager.queues[qid].push({ data, jobId });
  }

  static retrieve(id: string) {
    if (!JManager.queues[id] || JManager.queues[id].length == 0) {
      return { found: false, data: null };
    }
    return { found: false, data: JManager.queues[id].shift()! };
  }

  static isEmpty(id: string) {
    return !JManager.queues[id] || JManager.queues[id].length == 0;
  }

  static fire(qid: string, jid: string, job: Job<any>) {
    this.jobs[`${qid}::${jid}`] = job;
  }

  static query(qid: string, jid: string) {
    if (!JManager.queues[qid] || JManager.queues[qid].length == 0) {
      return null;
    }
    return JManager.jobs[`${qid}::${jid}`] ?? null;
  }
}

type TEventLevel = "debug" | "info" | "warn" | "error" | "fatal";
type TEvent = {
  message: string;
  level: TEventLevel;
  timestamp: Date;
};

export class Job<T> {
  progress = 0;
  id: string;
  events: TEvent[] = [];

  constructor(
    public queueName: string,
    public jobId: string,
    public data: T
  ) {
    this.id = this.queueName + "-" + this.jobId;
  }

  updateProgress(v: number) {
    this.progress = v;
  }

  logEvent(message: string, level: TEventLevel) {
    this.events.push({ message, level, timestamp: new Date() });
  }

  logDebug(message: string) {
    this.logEvent(message, "debug");
  }
  logInfo(message: string) {
    this.logEvent(message, "info");
  }
  logWarn(message: string) {
    this.logEvent(message, "warn");
  }
  logError(message: string) {
    this.logEvent(message, "error");
  }
  logFatal(message: string) {
    this.logEvent(message, "fatal");
  }
}

export class Queue<T> {
  constructor(public readonly name: string) {}

  add(id: string, data: T) {
    JManager.ingest(this.name, id, data);
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
      if (JManager.isEmpty(this.name)) {
        await wait(WORKER_INTERVAL);
      }

      for (let i = 0; i < WORKER_MAX_CONCURRENT; i++) {
        const { data, found } = JManager.retrieve(this.name);
        if (!found || !data) break;

        const j = new Job<T>(this.name, data.jobId, data.data);
        j.logDebug("Job started");

        this.emit("start", j);
        this.proc(j)
          .then((p) => {
            j.progress = 100;
            this.emit("success", j, p);
            j.logDebug("Job completed successfully");
          })
          .catch((e) => {
            j.progress = -1;
            this.emit("error", j, e);
            j.logDebug("Job failed");
          })
          .finally(() => {
            this.emit("completed", j);
          });
      }
    }
  }
}
