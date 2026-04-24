import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("repos", "routes/repos.tsx"),
  route("projects", "routes/projects.tsx"),
  route("projects/new", "routes/newProject.tsx"),
  route("projects/:project/new-ws", "routes/newWorkspace.tsx"),
  route("projects/:project/:workspace", "routes/planInfo.tsx"),
] satisfies RouteConfig;
