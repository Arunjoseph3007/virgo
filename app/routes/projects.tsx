import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { client } from "~/client";
import type { WS_STATES } from "../../server/db/schema";
import { PlusIcon } from "~/common/icons";
import { type InferResponseType } from "hono/client";

type WsHealth = (typeof WS_STATES)[number];

const HEALTH_STYLES: Record<WsHealth, string> = {
  SYNC: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  OUT_OF_SYNC:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  PROGRESSING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const HEALTH_DOT: Record<WsHealth, string> = {
  SYNC: "bg-green-500",
  OUT_OF_SYNC: "bg-yellow-500",
  ERROR: "bg-red-500",
  PROGRESSING: "bg-blue-500",
};

function HealthBadge({ health }: { health: WsHealth }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_STYLES[health]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[health]}`} />
      {health.replace("_", " ")}
    </span>
  );
}

type Project = InferResponseType<typeof client.project.$get>[number]

function ProjectCard({ project }: { project: Project }) {
  const hasIssues = project.workspaces.some(
    (ws) => ws.health === "ERROR" || ws.health === "OUT_OF_SYNC"
  );

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-shadow hover:shadow-md ${
        hasIssues
          ? "border-yellow-200 dark:border-yellow-800"
          : "border-gray-100 dark:border-gray-800"
      }`}
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {project.name}
            </p>
            <p className="mt-0.5 text-xs font-mono text-gray-400 dark:text-gray-600 truncate">
              {project.folder}
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-600">
              {project.workspaces.length} workspace
              {project.workspaces.length !== 1 ? "s" : ""}
            </span>
            <Link
              className="flex items-center gap-1 rounded-full px-4 py-1 bg-green-900 text-sm"
              to={`/projects/${project.name}/new-ws`}
            >
              <PlusIcon /> Add
            </Link>
          </div>
        </div>

        {project.workspaces.length > 0 && (
          <div className="mt-4 space-y-2">
            {project.workspaces.map((ws) => (
              <Link
                key={ws.name}
                to={`/projects/${project.name}/${ws.name}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {ws.name}
                  </p>
                  <p className="text-xs font-mono text-gray-400 dark:text-gray-600 truncate">
                    {ws.gitTarget}
                  </p>
                </div>
                <HealthBadge health={ws.health as WsHealth} />
              </Link>
            ))}
          </div>
        )}

        {project.workspaces.length === 0 && (
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-600">
            No workspaces configured
          </p>
        )}
      </div>
    </div>
  );
}

export function meta() {
  return [
    { title: `Your Projects` },
    { name: "description", content: "Dashboard to manage virgo projects" },
  ];
}

export default function ProjectsPage() {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await client.project.$get();
      return await res.json();
    },
    initialData: [],
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Projects
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {projectsQuery.data.length} project
            {projectsQuery.data.length !== 1 ? "s" : ""}
          </p>
        </div>

        {projectsQuery.isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {projectsQuery.data.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>

        {!projectsQuery.isLoading && projectsQuery.data.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-600">
            No projects found.
          </p>
        )}
      </div>
    </div>
  );
}
