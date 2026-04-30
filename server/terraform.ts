import child_process from "child_process";
import path from "path";
import fs from "fs";
import type { TerraformPlanData } from "~/types/planData";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import {
  history,
  params,
  projects,
  repos,
  workspaces,
  type THistroyVarInfo,
  type TParam,
  type TProject,
  type TWorkspace,
  type TWSHealthStatus,
} from "./db/schema";
import { unreachable } from "./utils";
import type { TApplyConfig, TWSInsert, TWSUpdate } from "./validation";
import Lock from "./lock";

const REPO_ROOT: string = process.env.REPO_ROOT!;
const CACHE_ROOT: string = process.env.CACHE_ROOT!;

type ExecOut = {
  success: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
};

const isPrimitive = (v: any) =>
  typeof v == "string" || typeof v == "number" || typeof v == "boolean";
function obscureSensitive(
  before: any,
  after: any,
  beforeSensitive: any,
  afterSensitive: any
) {
  return;
}

export class Terraform {
  project: string;
  workspace?: string;

  projectInfo?: TProject;
  workspaceInfo?: TWorkspace;
  params: TParam[] = [];

  private __initDone = false;

  constructor(project: string, workspace?: string) {
    this.project = project;
    this.workspace = workspace;
  }

  static async init(project: string, workspace = "default") {
    const tf = new Terraform(project, workspace);
    await tf._init();
    return tf;
  }

  async _init() {
    if (this.workspace) {
      const info = await db.query.workspaces.findFirst({
        where: this.wsSelector(),
        with: {
          params: true,
          project: true,
        },
      });
      if (!info) {
        console.warn(
          `No info found for project ${this.project}, workspace ${this.workspace}`
        );
        return;
      }

      const { project, params, ...wsInfo } = info;
      this.params = params;
      this.projectInfo = project;
      this.workspaceInfo = wsInfo;
    } else {
      this.projectInfo = await db.query.projects.findFirst({
        where: eq(projects.name, this.project),
      });
    }
    this.__initDone = true;
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

  throwNoInitErr(): never {
    throw new Error(
      "Init not done, please make sure to call init() before calling this methods"
    );
  }

  private get repoPath() {
    if (!this.projectInfo) this.throwNoInitErr();
    return path.join(
      REPO_ROOT,
      this.projectInfo.repoId.toString(),
      this.projectInfo.folder
    );
  }

  private get cachePath() {
    return path.join(CACHE_ROOT, this.project);
  }

  private get planCacheFile() {
    return path.join(this.cachePath, `${this.workspace}-plan`);
  }

  private get planCacheJson() {
    return path.join(this.cachePath, `${this.workspace}-plan.json`);
  }

  private get planLogsFile() {
    return path.join(this.cachePath, `${this.workspace}-plan-logs.json`);
  }

  private async revCheckout() {
    if (!this.workspace || !this.workspaceInfo) this.throwNoInitErr();

    return await this.exec(`git checkout ${this.workspaceInfo.gitTarget}`);
  }

  private async pullChanges() {
    if (!this.workspace || !this.workspaceInfo) this.throwNoInitErr();

    return await this.exec(`git pull`, { throwOnError: false });
  }

  async commitInfo() {
    if (!this.workspace || !this.workspaceInfo) this.throwNoInitErr();

    console.log("ehllo");

    const tagRes = await this.exec(`git rev-parse HEAD`);
    console.log(tagRes);
    const tag = tagRes.stdout.trim();

    const infoRes = await this.exec(`git show ${tag} --summary`);
    console.log(infoRes);
    const [revisionLine, authorLine, _1, _2, commentLine, _3] =
      infoRes.stdout.split("\n");

    const revision = revisionLine.split(" ")[1];
    const author = authorLine.split(" ").slice(1).join(" ");
    const comment = commentLine.trim();

    return { revision, author, comment };
  }

  private async getRepoUrl() {
    if (!this.projectInfo) this.throwNoInitErr();

    const res = await db
      .select({ url: repos.url })
      .from(repos)
      .where(eq(repos.id, this.projectInfo.repoId));

    if (res.length == 0)
      throw new Error(`No repo with id ${this.projectInfo.repoId}`);

    return res[0].url;
  }

  private getParams(): THistroyVarInfo {
    if (!this.projectInfo) this.throwNoInitErr();

    const vars: Record<string, string> = {};
    this.params
      .filter((p) => p.type == "var")
      .forEach((v) => {
        vars[v.key] = v.value!;
      });
    const varFiles = this.params
      .filter((p) => p.type == "var-file")
      .map((p) => p.key);

    return { varFiles, vars };
  }

  private wsSelector() {
    if (!this.workspace) this.throwNoInitErr();

    return and(
      eq(workspaces.name, this.workspace),
      eq(workspaces.projectName, this.project)
    );
  }

  private obscureSensitive(planData: TerraformPlanData): TerraformPlanData {
    planData.resource_changes.forEach((ch) => {
      const { before, after, before_sensitive, after_sensitive } = ch.change;
      obscureSensitive(before, after, before_sensitive, after_sensitive);
    });
    planData.resource_drift?.forEach((ch) => {
      const { before, after, before_sensitive, after_sensitive } = ch.change;
      obscureSensitive(before, after, before_sensitive, after_sensitive);
    });
    return planData;
  }

  private getParamFlags(): string {
    return this.params
      .map((p) => {
        switch (p.type) {
          case "var":
            return `-var ${p.key}=${p.value}`;
          case "var-file":
            return `-var-file ${p.key}`;
          default:
            unreachable();
        }
      })
      .join(" ");
  }

  async selectWS(ws?: string) {
    if (!ws) this.throwNoInitErr();
    if (!this.projectInfo) this.throwNoInitErr();
    // TODO checkout to correct branch here
    if (this.workspace == ws) return;

    await this.exec(`terraform workspace select ${ws}`);

    this.workspace = ws;
  }

  private async setHealthStatus(health: TWSHealthStatus) {
    if (!this.workspace) this.throwNoInitErr();

    await db.update(workspaces).set({ health }).where(this.wsSelector());
  }

  getStatus(): TerraformPlanData | null {
    if (!this.projectInfo) this.throwNoInitErr();

    if (!fs.existsSync(this.planCacheJson)) return null;

    const res = fs.readFileSync(this.planCacheJson);
    const json = JSON.parse(res.toString());
    const obscured = this.obscureSensitive(json);
    return obscured;
  }

  async apply(config: TApplyConfig) {
    if (!this.projectInfo || !this.workspaceInfo || !this.workspace)
      this.throwNoInitErr();

    const status = this.workspaceInfo.health;
    if (status == "ERROR") {
      return false;
    }

    const lc = new Lock(this.projectInfo.repoId);
    lc.lock();

    await this.revCheckout();
    await this.selectWS(this.workspace);

    const targetFlags =
      config.target?.map((t) => `-target=${t}`).join(" ") || "";
    await this.exec(
      `terraform apply ${this.getParamFlags()} ${targetFlags} -input=false ${this.planCacheFile}`
    );

    // creating history record
    const commitInfo = await this.commitInfo();

    await db.insert(history).values({
      ...commitInfo,
      projectName: this.project,
      repoUrl: await this.getRepoUrl(),
      workspaceName: this.workspace,
      varInfo: this.getParams(),
    });

    lc.release();

    await this.refresh();

    return true;
  }

  async refresh(): Promise<boolean> {
    if (!this.projectInfo) this.throwNoInitErr();
    if (!this.workspace) this.throwNoInitErr();

    const lc = new Lock(this.projectInfo.repoId);
    lc.lock();

    await this.revCheckout();
    await this.pullChanges();
    await this.selectWS(this.workspace);

    if (!fs.existsSync(this.repoPath)) return false;

    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }

    const planRes = await this.exec(
      `terraform plan -detailed-exitcode ${this.getParamFlags()} -input=false -out ${this.planCacheFile}`,
      { throwOnError: false }
    );

    lc.release();

    if (planRes.exitCode == 0) {
      fs.writeFileSync(this.planLogsFile, planRes.stdout);
      await this.setHealthStatus("SYNC");
    } else if (planRes.exitCode == 1) {
      fs.writeFileSync(this.planLogsFile, planRes.stderr);
      await this.setHealthStatus("ERROR");
      return false;
    } else if (planRes.exitCode == 2) {
      fs.writeFileSync(this.planLogsFile, planRes.stdout);
      await this.setHealthStatus("OUT_OF_SYNC");
    } else {
      unreachable(
        `Non standard exitcode (${planRes.exitCode}) for terraform plan`
      );
    }

    const showRes = await this.exec(
      `terraform show -json ${this.planCacheFile}`
    );
    fs.writeFileSync(this.planCacheJson, showRes.stdout);
    return true;
  }

  async addWs(wsInfo: TWSInsert) {
    await db.transaction(async (tx) => {
      await tx
        .insert(workspaces)
        .values({ projectName: this.project, ...wsInfo });

      if (wsInfo.params.length > 0) {
        await tx.insert(params).values(
          wsInfo.params.map((p) => ({
            ...p,
            workspaceName: wsInfo.name,
            projectName: this.project,
          }))
        );

        const res = await this.exec(`terraform workspace new ${wsInfo.name}`);
        console.log("res", res);
      }
    });

    return true;
  }

  async editWs(workspaceInfo: TWSUpdate) {
    await db.transaction(async (tx) => {
      if (!this.workspace) this.throwNoInitErr();

      await tx
        .update(workspaces)
        .set({ gitTarget: workspaceInfo.gitTarget })
        .where(this.wsSelector());

      // diffing is sligthly complicated so just delete all and recreate
      await tx
        .delete(params)
        .where(
          and(
            eq(params.projectName, this.project),
            eq(params.workspaceName, this.workspace)
          )
        );

      await tx.insert(params).values(
        workspaceInfo.params.map((p) => ({
          ...p,
          projectName: this.project,
          workspaceName: this.workspace!,
        }))
      );
    });

    return true;
  }

  async getPlanLogs() {
    if (!this.workspace) this.throwNoInitErr();

    if (!fs.existsSync(this.planLogsFile)) return null;

    return fs.readFileSync(this.planLogsFile).toString();
  }

  async listWS() {
    return await db.query.workspaces.findMany({
      where: eq(workspaces.projectName, this.project),
    });
  }
}
