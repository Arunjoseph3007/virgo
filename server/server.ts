import "dotenv/config";
import { Hono } from "hono";
import { inspectRoutes, showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { serve } from "@hono/node-server";
import { Terraform } from "./terraform";
import { db } from "./db";
import { history, projects, repos } from "./db/schema";
import { Repo } from "./repo";
import {
  ApplyConfigSchema,
  ProjectInsertSchema,
  RepoInsertSchema,
  RepoSearchSchema,
  RepoUpdateSchema,
  WorkspaceInsertSchema,
  WorkspaceUpdateSchema,
} from "./validation";
import { and, desc, eq, like, or } from "drizzle-orm";

const routes = new Hono()

  .post("/repos", zValidator("json", RepoInsertSchema), async (c) => {
    const values = c.req.valid("json");
    const res = await db.insert(repos).values(values).returning();

    const repo = await Repo.init(res[0].id);
    const connected = await repo.tryClone();

    return c.json({ ...res[0], connected });
  })
  .put("/repos/:repoId", zValidator("json", RepoUpdateSchema), async (c) => {
    const { repoId } = c.req.param();
    const values = c.req.valid("json");
    const res = await db
      .update(repos)
      .set(values)
      .where(eq(repos.id, parseInt(repoId)))
      .returning();

    return c.json({ ...res[0] });
  })
  .get("/repos", zValidator("query", RepoSearchSchema), async (c) => {
    const query = c.req.valid("query");
    const search = `%${query.search || ""}%`;

    const res = await db.query.repos.findMany({
      limit: 20,
      where: and(
        or(like(repos.name, search), like(repos.url, search)),
        query.connected ? eq(repos.connected, query.connected) : undefined
      ),
    });

    return c.json(res);
  })
  .post("/repos/:repoId/retry", async (c) => {
    const repoId = c.req.param("repoId");

    const repo = await Repo.init(parseInt(repoId));
    const connected = await repo.tryClone();

    return c.json(connected);
  })
  .delete("/repos/:repoId", async (c) => {
    const repoId = parseInt(c.req.param("repoId"));

    const repo = await Repo.init(repoId);
    await repo.deleteAndCleanup();

    return c.json({ success: true });
  })

  .post("/project", zValidator("json", ProjectInsertSchema), async (c) => {
    const proj = await c.req.json();
    const ret = await db.insert(projects).values(proj).returning();

    if (ret.length == 0)
      throw new HTTPException(401, { message: "Couldnt insert project" });

    return c.json({ success: true, project: ret[0] });
  })
  .get("/project", async (c) => {
    const projs = await db.query.projects.findMany({
      with: { workspaces: true },
      limit: 20,
    });
    return c.json(projs);
  })
  .post(
    "/project/:project/workspaces",
    zValidator("json", WorkspaceInsertSchema),
    async (c) => {
      const { project } = c.req.param();
      const workspace = c.req.valid("json");

      const tf = await Terraform.init(project);
      const res = await tf.addWs(workspace);
      if (!res)
        throw new HTTPException(400, { message: "Couldnt create workspace" });

      return c.json({ success: true, workspace: workspace });
    }
  )
  .put(
    "/project/:project/:workspace",
    zValidator("json", WorkspaceUpdateSchema),
    async (c) => {
      const { project, workspace } = c.req.param();
      const workspaceInfo = c.req.valid("json");

      const tf = await Terraform.init(project, workspace);
      const res = await tf.editWs(workspaceInfo);
      if (!res)
        throw new HTTPException(400, { message: "Couldnt update workspace" });

      return c.json({ success: true, workspace: workspaceInfo });
    }
  )
  .get("/project/:project/workspaces", async (c) => {
    const { project } = c.req.param();

    const tf = await Terraform.init(project);
    const workspaces = await tf.listWS();
    return c.json(workspaces);
  })
  .get("/project/:project/:workspace", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const { workspaceInfo, projectInfo, params } = tf;
    if (!workspaceInfo) {
      throw new HTTPException(404, { message: "Workspace Info not found" });
    }

    const lastApplyInfo = await db.query.history.findFirst({
      where: and(
        eq(history.projectName, project),
        eq(history.workspaceName, workspace)
      ),
      orderBy: desc(history.id),
    });

    return c.json({ workspaceInfo, projectInfo, params, lastApplyInfo });
  })
  .get("/project/:project/:workspace/logs", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const logs = await tf.getPlanLogs();

    if (!logs) return c.json({ logs: null });
    return c.json({ logs });
  })
  .get("/project/:project/:workspace/history", async (c) => {
    const { project, workspace } = c.req.param();

    const historyRes = await db.query.history.findMany({
      where: and(
        eq(history.projectName, project),
        eq(history.workspaceName, workspace)
      ),
    });

    return c.json(historyRes);
  })
  .get("/project/:project/:workspace/commitInfo", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const info = await tf.commitInfo();

    return c.json(info);
  })
  .get("/project/:project/:workspace/refresh", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const res = await tf.refresh();

    if (!res) return c.notFound();
    return c.json({ success: true });
  })
  .post(
    "/project/:project/:workspace/apply",
    zValidator("json", ApplyConfigSchema),
    async (c) => {
      const { project, workspace } = c.req.param();

      const tf = await Terraform.init(project, workspace);
      const res = await tf.apply(await c.req.json());

      if (!res) return c.notFound();
      return c.json({ success: true });
    }
  )
  .get("/project/:project/:workspace/status", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const status = tf.getStatus();

    if (!status) return c.notFound();
    return c.json(status);
  });

const app = new Hono();

app.use(logger());

app.route("/", routes);

app.get("/docs", (c) => {
  showRoutes(routes);
  return c.json(inspectRoutes(routes).filter((r) => !r.isMiddleware));
});
app.get("/health", (c) => c.json({ status: "OK" }));

app.onError((error, c) => {
  console.error(`SERVER ERROR: ${error}`);
  return c.json({ error }, 500);
});

serve({ fetch: app.fetch, port: 3000 }, (opt) => {
  console.log(`Started listening on port Port :${opt.port}`);
});

export type AppType = typeof routes;
