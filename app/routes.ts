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
    ...prefix("projects", [
      index("routes/projects.tsx"),
      route("new", "routes/newProject.tsx"),
      route(":project/new-ws", "routes/newWorkspace.tsx"),
      route(":project/:workspace", "routes/planInfo.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
