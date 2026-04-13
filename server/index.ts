import "dotenv/config";
import { Hono } from "hono";
import z from "zod";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { serve } from "@hono/node-server";
import { Terraform } from "./terraform";

const routes = new Hono()
  .get("/health", (c) => c.json({ status: "OK" }))

  .post(
    "/project/:project/workspaces",
    zValidator(
      "json",
      z.object({
        workspace: z
          .string()
          .min(2)
          .max(20)
          .regex(/[-a-zA-Z]*/),
      })
    ),
    (c) => {
      const { project } = c.req.param();
      const workspace = c.req.valid("json").workspace;

      const tf = new Terraform(project);
      const res = tf.addWs(workspace);
      if (!res)
        throw new HTTPException(400, { message: "Couldnt create workspace" });

      return c.json({ success: true, workspace: workspace });
    }
  )
  .get("/project/:project/workspaces", (c) => {
    const { project } = c.req.param();

    const tf = new Terraform(project);
    const workspaces = tf.listWS();
    return c.json(workspaces);
  })
  .get("/project/:project/:workspace/refresh", (c) => {
    const { project, workspace } = c.req.param();

    const tf = new Terraform(project, workspace);
    const res = tf.refresh();

    if (!res) return c.notFound();
    return c.json({ success: true });
  })

  .get("/project/:project/:workspace/apply", (c) => {
    const { project, workspace } = c.req.param();

    const tf = new Terraform(project, workspace);
    const res = tf.apply();

    if (!res) return c.notFound();
    return c.json({ success: true });
  })

  .get("/project/:project/:workspace/status", (c) => {
    const { project, workspace } = c.req.param();

    const tf = new Terraform(project, workspace);
    const status = tf.getStatus();

    if (!status) return c.notFound();
    return c.json(status);
  });

const app = new Hono();
app.use(logger());
app.route("/", routes);

serve({ fetch: app.fetch, port: 3000 }, (opt) => {
  console.log(`Started listening on port Port :${opt.port}`);
});

export default app;
export type AppType = typeof routes;
