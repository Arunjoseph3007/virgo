import "dotenv/config";
import { Hono } from "hono";
import { inspectRoutes, showRoutes } from "hono/dev";
import z from "zod";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { serve } from "@hono/node-server";
import { Terraform } from "./terraform";
import { db } from "./db";
import { PARAM_TYPES } from "./db/schema";

const routes = new Hono()
  .get("/health", (c) => c.json({ status: "OK" }))

  .get("/project", async (c) => {
    const projs = await db.query.projects.findMany({
      with: { workspaces: true },
      limit: 20,
    });
    return c.json(projs);
  })

  .post(
    "/project/:project/workspaces",
    zValidator(
      "json",
      z.object({
        name: z.string(),
        gitTarget: z.string(),
        params: z.array(
          z.object({
            key: z.string(),
            value: z.string().optional().nullable(),
            type: z.enum(PARAM_TYPES),
          })
        ),
      })
    ),
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
  .get("/project/:project/workspaces", async (c) => {
    const { project } = c.req.param();

    const tf = await Terraform.init(project);
    const workspaces = await tf.listWS();
    return c.json(workspaces);
  })
  .get("/project/:project/:workspace", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    return c.json(tf.workspaceInfo);
  })
  .get("/project/:project/:workspace/error", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const err = await tf.getPlanErr();

    if (!err) return c.json({ error: null });
    return c.json({ error: err });
  })
  .get("/project/:project/:workspace/refresh", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const res = await tf.refresh();

    if (!res) return c.notFound();
    return c.json({ success: true });
  })

  .get("/project/:project/:workspace/apply", async (c) => {
    const { project, workspace } = c.req.param();

    const tf = await Terraform.init(project, workspace);
    const res = await tf.apply();

    if (!res) return c.notFound();
    return c.json({ success: true });
  })

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

app.onError((error, c) => {
  console.error(`SERVER ERROR: ${error}`);
  return c.json({ error }, 500);
});

serve({ fetch: app.fetch, port: 3000 }, (opt) => {
  console.log(`Started listening on port Port :${opt.port}`);
});

export default app;
export type AppType = typeof routes;
