import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  layout("layouts/sidebarLayout.tsx", [
    route("repos", "routes/repos.tsx"),
    route("new", "routes/newProject.tsx"),
    ...prefix("projects", [
      index("routes/projects.tsx"),
      route(":project/new-ws", "routes/newWorkspace.tsx"),
      route(":project/:workspace", "routes/workspace.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
