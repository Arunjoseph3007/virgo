import path from "path";
import fs from "fs";
import child_process from "child_process";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { repos, type TRepo } from "./db/schema";
import { todo } from "./utils";

const REPO_ROOT: string = process.env.REPO_ROOT!;

type ExecOut = {
  success: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
};

export class Repo {
  private repoId: number;
  private repoInfo?: TRepo;

  constructor(repoId: number) {
    this.repoId = repoId;
  }

  static async init(repoId: number) {
    const repo = new Repo(repoId);
    await repo._init();
    return repo;
  }

  private async _init() {
    this.repoInfo = await db.query.repos.findFirst({
      where: eq(repos.id, this.repoId),
    });
  }

  throwNoInitErr(): never {
    throw new Error(
      "Init not done, please make sure to call init() before calling this methods"
    );
  }

  private get repoPath() {
    if (!this.repoInfo) this.throwNoInitErr();

    // TODO repoId as folder name doesnt sound very nice
    return path.join(REPO_ROOT, this.repoId.toString());
  }

  private exec(
    cmd: string,
    { throwOnError = true, timeout = 100 * 1000 } = {}
  ): Promise<ExecOut> {
    console.log("\x1b[32mEXEC_CMD\x1b[0m:", cmd);

    return new Promise((resolve, reject) => {
      child_process.exec(
        cmd,
        { cwd: this.repoPath, timeout },
        (error, stdout, stderr) => {
          if (error) {
            if (throwOnError) {
              reject(
                new Error(
                  `Command failed: ${cmd}, code ${error.code}\n${stderr}`
                )
              );
              return;
            } else {
              resolve({ exitCode: error.code, stdout, stderr, success: false });
            }
          }
          resolve({ exitCode: 0, stdout, stderr, success: true });
        }
      );
    });
  }

  async tryClone() {
    if (!this.repoInfo) this.throwNoInitErr();

    if (!fs.existsSync(this.repoPath)) {
      fs.mkdirSync(this.repoPath, { recursive: true });
    }

    const res = await this.exec(
      `git clone ${this.repoInfo.url} ${this.repoPath}`,
      { throwOnError: false }
    );

    if (res.success) {
      await db
        .update(repos)
        .set({ connected: true })
        .where(eq(repos.id, this.repoId));
      return { success: true, error: null };
    } else {
      await db
        .update(repos)
        .set({ connected: false })
        .where(eq(repos.id, this.repoId));
      return { success: false, error: res.stderr };
    }
  }

  async update() {
    if (!this.repoInfo) this.throwNoInitErr();

    todo("Repo.update this should fetch latest changes for the right branches");
  }

  async deleteAndCleanup() {
    await db.delete(repos).where(eq(repos.id, this.repoId));

    if (fs.existsSync(this.repoPath)) {
      fs.rmSync(this.repoPath, { recursive: true });
    }

    delete this.repoInfo;
  }
}
