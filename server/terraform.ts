import child_process from "child_process";
import path from "path";
import fs from "fs";

const REPO_ROOT: string = process.env.REPO_ROOT!;
const CACHE_ROOT: string = process.env.CACHE_ROOT!;

export class Terraform {
  repo: string;
  workspace!: string;
  vars: Record<string, string> = {};
  varFiles: string[] = [];

  constructor(repo: string, workspace = "default") {
    this.repo = repo;
    this.selectWS(workspace);
  }

  private get repoPath() {
    return path.join(REPO_ROOT, this.repo);
  }

  private get cachePath() {
    return path.join(CACHE_ROOT, this.repo);
  }

  private get planCacheFile() {
    return path.join(this.cachePath, `${this.workspace}-plan`);
  }

  private get planCacheJson() {
    return path.join(this.cachePath, `${this.workspace}-plan.json`);
  }

  selectWS(ws: string) {
    if (this.workspace == ws) return;

    child_process.execSync(`terraform workspace select ${ws}`, {
      cwd: this.repoPath,
    });

    this.workspace = ws;
  }

  getStatus() {
    const planCacheJson = this.planCacheJson;
    if (!fs.existsSync(planCacheJson)) return null;

    const res = fs.readFileSync(planCacheJson);
    return JSON.parse(res.toString());
  }

  apply() {
    child_process.execSync(
      `terraform apply --var hello=automation -input=false ${this.planCacheFile}`,
      { cwd: this.repoPath }
    );

    this.refresh();

    return true;
  }

  refresh() {
    if (!fs.existsSync(this.repoPath)) return false;

    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }

    child_process.execSync(
      `terraform plan --var hello=automation -out ${this.planCacheFile}`,
      { cwd: this.repoPath }
    );
    const res = child_process.execSync(
      `terraform show -json ${this.planCacheFile}`,
      { cwd: this.repoPath }
    );

    fs.writeFileSync(this.planCacheJson, res);
    return true;
  }

  addWs(ws: string) {
    child_process.execSync(`terraform workspace new ${ws}`, {
      cwd: this.repoPath,
    });
    return true
  }

  listWS() {
    const res = child_process.execSync(`terraform workspace list`, {
      cwd: this.repoPath,
    });
    return res
      .toString()
      .split("\n")
      .filter((ws) => ws && ws.length > 2)
      .map((ws) => ws.slice(2));
  }
}
