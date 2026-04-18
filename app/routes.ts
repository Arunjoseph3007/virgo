import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("projects", "routes/projects.tsx"),
  route("projects/:project/new-ws", "routes/newProject.tsx"),
  route("projects/:project/:workspace", "routes/planInfo.tsx"),
] satisfies RouteConfig;
