import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Dropdown } from "~/common/dropdown";
import type { ResourceChange, TerraformPlanData } from "~/types/planData";
import { client } from "~/client";
import { GitBranchIcon } from "~/common/icons";
import { Dialog } from "~/common/dialog";
import { ansiToHtml } from "~/utils/ansi";

export function meta({}) {
  return [
    { title: "Terraform Plan Viewer" },
    { name: "description", content: "Terraform plan resource changes" },
  ];
}

enum ChangeType {
  Create = "create",
  Delete = "delete",
  Update = "update",
  Replace = "replace",
  Noop = "no-op",
}

const ACTION_STYLES: Record<ChangeType, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  update:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  replace:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "no-op": "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const ACTION_ICONS: Record<ChangeType, string> = {
  create: "+",
  delete: "-",
  update: "~",
  replace: "±",
  "no-op": "○",
};

// type ResourceChange = (typeof defaultPlanData.resource_changes)[number];
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

function ActionBadge({ action }: { action: ChangeType }) {
  const style = ACTION_STYLES[action] ?? ACTION_STYLES["no-op"];
  const icon = ACTION_ICONS[action] ?? "?";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${style}`}
    >
      <span className="font-bold">{icon}</span>
      {action}
    </span>
  );
}

function hasMeaningfulChange(change: ResourceChange) {
  return change.change.actions.some((a) => a !== "no-op");
}

function formatValue(val: JsonValue): string {
  if (val === null) return "null";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    return `[${val.map(formatValue).join(", ")}]`;
  }
  return JSON.stringify(val);
}

function isSkippableValue(val: JsonValue): boolean {
  if (val === null) return true;
  if (val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

const isPlainObject = (val: any) =>
  val !== null && typeof val === "object" && !Array.isArray(val);

function stringifyExpr(val: JsonValue, level = 1): string {
  if (val === null) return "null";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return `${val}`;

  const indent = "  ".repeat(level);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";

    let str = "[\n";

    val.forEach((ent) => {
      str += indent + stringifyExpr(ent, level + 1) + ",\n";
    });
    str += indent.slice(0, -2) + "]";
    return str;
  }

  // object
  if (Object.keys(val).length == 0) return "{}";
  let str = "{\n";

  for (const key in val) {
    if (
      Array.isArray(val[key]) &&
      val[key].length > 0 &&
      isPlainObject(val[key][0])
    ) {
      val[key].forEach((ent) => {
        str += indent + key + " " + stringifyExpr(ent, level + 1) + "\n";
      });
    } else if (isPlainObject(val[key])) {
      str += `${indent}${key} ${stringifyExpr(val[key], level + 1)}\n`;
    } else {
      str += `${indent}${key} = ${stringifyExpr(val[key], level + 1)}\n`;
    }
  }
  return str + indent.slice(0, -2) + "}";
}

function jsonToTf(name: string, type: string, data: JsonValue): string {
  return `resource "${type}" "${name}" ` + stringifyExpr(data);
}

/** HCL-style resource block rendered from resource info */
function ResourceInfo({
  name,
  type,
  data,
}: {
  name: string;
  type: string;
  data: Record<string, JsonValue>;
}) {
  return (
    <pre className="rounded-lg bg-gray-950 text-gray-200 text-xs font-mono p-4 overflow-x-auto whitespace-pre leading-relaxed">
      {"resource "}
      <span className={HIGHLIGHT.string}>"{name}"</span>{" "}
      <span className={HIGHLIGHT.string}>"{type}"</span> {renderExprNode(data)}
    </pre>
  );
}

function getDiffSymbol(before: any, after: any): string {
  if (!before) return ACTION_ICONS[ChangeType.Create];
  if (!after) return ACTION_ICONS[ChangeType.Delete];
  if (JSON.stringify(before) == JSON.stringify(after))
    return ACTION_ICONS[ChangeType.Noop];
  return ACTION_ICONS[ChangeType.Update];
}

// Rosé Pine theme — https://rosepinetheme.com/palette
const HIGHLIGHT = {
  null: "text-[#6e6a86]", // muted
  string: "text-[#f6c177]", // gold
  boolean: "text-[#c4a7e7]", // iris
  number: "text-[#ebbcba]", // rose
  key: "text-[#9ccfd8]", // foam
  punctuation: "text-[#908caa]", // subtle
  sym: {
    [ACTION_ICONS[ChangeType.Create]]: "text-[#31748f]", // pine
    [ACTION_ICONS[ChangeType.Delete]]: "text-[#eb6f92]", // love
    [ACTION_ICONS[ChangeType.Update]]: "text-[#f6c177]", // gold
    [ACTION_ICONS[ChangeType.Replace]]: "text-[#ebbcba]", // rose
    [ACTION_ICONS[ChangeType.Noop]]: "text-[#6e6a86]", // muted
    fallback: "text-[#908caa]", // subtle
  },
  diffRemoved: "opacity-60 line-through",
  diffArrow: "text-[#908caa]", // subtle
};

function DiffSym({ sym }: { sym: string }) {
  return (
    <span className={HIGHLIGHT.sym[sym] ?? HIGHLIGHT.sym.fallback}>{sym}</span>
  );
}

function ColorVal({ val }: { val: JsonValue }): React.ReactElement {
  if (val === null) return <span className={HIGHLIGHT.null}>null</span>;
  if (typeof val === "string")
    return <span className={HIGHLIGHT.string}>"{val}"</span>;
  if (typeof val === "boolean")
    return <span className={HIGHLIGHT.boolean}>{val ? "true" : "false"}</span>;
  if (typeof val === "number")
    return <span className={HIGHLIGHT.number}>{String(val)}</span>;
  return <span>{JSON.stringify(val)}</span>;
}

function renderExprNode(val: JsonValue, level = 1): React.ReactNode {
  if (val === null) return <span className={HIGHLIGHT.null}>null</span>;
  if (typeof val === "string")
    return <span className={HIGHLIGHT.string}>"{val}"</span>;
  if (typeof val === "boolean")
    return <span className={HIGHLIGHT.boolean}>{val ? "true" : "false"}</span>;
  if (typeof val === "number")
    return <span className={HIGHLIGHT.number}>{String(val)}</span>;

  const indent = "    ".repeat(level);
  const dedent = "    ".repeat(level - 1);

  if (Array.isArray(val)) {
    if (val.length === 0)
      return <span className={HIGHLIGHT.punctuation}>{"[]"}</span>;
    return (
      <>
        {"[\n"}
        {val.map((ent, i) => (
          <span key={i}>
            {indent}
            {renderExprNode(ent, level + 1)}
            {",\n"}
          </span>
        ))}
        {dedent}
        {"]"}
      </>
    );
  }

  const keys = Object.keys(val as object);
  if (keys.length === 0)
    return <span className={HIGHLIGHT.punctuation}>{"{}"}</span>;

  const obj = val as Record<string, JsonValue>;
  return (
    <>
      {"{\n"}
      {keys.map((key) => {
        const v = obj[key];
        if (Array.isArray(v) && v.length > 0 && isPlainObject(v[0])) {
          return v.map((ent, i) => (
            <span key={`${key}-${i}`}>
              {indent}
              <span className={HIGHLIGHT.key}>{key}</span>{" "}
              {renderExprNode(ent, level + 1)}
              {"\n"}
            </span>
          ));
        } else if (isPlainObject(v)) {
          return (
            <span key={key}>
              {indent}
              <span className={HIGHLIGHT.key}>{key}</span>{" "}
              {renderExprNode(v, level + 1)}
              {"\n"}
            </span>
          );
        } else {
          return (
            <span key={key}>
              {indent}
              <span className={HIGHLIGHT.key}>{key}</span>
              {" = "}
              {renderExprNode(v, level + 1)}
              {"\n"}
            </span>
          );
        }
      })}
      {dedent}
      {"}"}
    </>
  );
}

function renderDiffNode(
  before: JsonValue,
  after: JsonValue,
  level = 0,
  afterUnknown: JsonValue = {} // TODO Implement afterUnknown
): React.ReactNode {
  const indent = "    ".repeat(level);
  const sindent = "    ".repeat(level - 1);

  // primitives
  if (
    typeof before === "string" ||
    typeof after === "string" ||
    typeof before === "number" ||
    typeof after === "number" ||
    typeof before === "boolean" ||
    typeof after === "boolean"
  ) {
    if (JSON.stringify(before) === JSON.stringify(after))
      return <ColorVal val={before} />;
    return (
      <>
        <span className={HIGHLIGHT.diffRemoved}>
          <ColorVal val={before} />
        </span>
        <span className={HIGHLIGHT.diffArrow}> → </span>
        <ColorVal val={after} />
      </>
    );
  }

  // arrays
  if (Array.isArray(before) || Array.isArray(after)) {
    const bArr = (before || []) as JsonValue[];
    const aArr = (after || []) as JsonValue[];
    const max = Math.max(bArr.length, aArr.length);
    if (max === 0) return <span className={HIGHLIGHT.punctuation}>{"[]"}</span>;
    return (
      <>
        {"[\n"}
        {Array.from({ length: max }, (_, i) => {
          const sym = getDiffSymbol(bArr[i] ?? null, aArr[i] ?? null);
          return (
            <span key={i}>
              {indent}
              <DiffSym sym={sym} />{" "}
              {renderDiffNode(bArr[i] ?? null, aArr[i] ?? null, level + 1)}
              {",\n"}
            </span>
          );
        })}
        {sindent}
        {"]"}
        {"\n"}
      </>
    );
  }

  // objects
  if (isPlainObject(before) || isPlainObject(after)) {
    const keysSet = new Set<string>();
    for (const key in before) keysSet.add(key);
    for (const key in after) keysSet.add(key);

    if (keysSet.size === 0)
      return <span className={HIGHLIGHT.punctuation}>{"{}"}</span>;

    const bObj = (before ?? {}) as Record<string, JsonValue>;
    const aObj = (after ?? {}) as Record<string, JsonValue>;

    return (
      <>
        {"{\n"}
        {[...keysSet].map((key) => {
          const bVal = bObj[key] ?? null;
          const aVal = aObj[key] ?? null;

          // array blocks
          if (
            Array.isArray(bVal) &&
            bVal.length > 0 &&
            isPlainObject(bVal[0]) &&
            Array.isArray(aVal) &&
            aVal.length > 0 &&
            isPlainObject(aVal[0])
          ) {
            const maxn = Math.max(bVal.length, aVal.length);
            return Array.from({ length: maxn }, (_, i) => {
              const sym = getDiffSymbol(bVal[i] ?? null, aVal[i] ?? null);
              return (
                <span key={`${key}-${i}`}>
                  {indent}
                  <DiffSym sym={sym} />{" "}
                  <span className={HIGHLIGHT.key}>{key}</span>{" "}
                  {renderDiffNode(bVal[i] ?? null, aVal[i] ?? null, level + 1)}
                  {"\n"}
                </span>
              );
            });
          }
          // objects
          else if (isPlainObject(bVal) || isPlainObject(aVal)) {
            const sym = getDiffSymbol(bVal, aVal);
            return (
              <span key={key}>
                {indent}
                <DiffSym sym={sym} />{" "}
                <span className={HIGHLIGHT.key}>{key}</span>{" "}
                {renderDiffNode(bVal, aVal, level + 1)}
                {"\n"}
              </span>
            );
          }
          // primitive vals
          else {
            const sym = getDiffSymbol(bVal, aVal);
            return (
              <span key={key}>
                {indent}
                <DiffSym sym={sym} />{" "}
                <span className={HIGHLIGHT.key}>{key}</span>
                {" = "}
                {renderDiffNode(bVal, aVal, level + 1)}
                {"\n"}
              </span>
            );
          }
        })}
        {sindent}
        {"}"}
      </>
    );
  }

  return <span className="text-red-500">ERROR</span>;
}

function stringifyDiff(before: JsonValue, after: JsonValue, level = 0): string {
  const indent = "    ".repeat(level);
  const sindent = "    ".repeat(level - 1);

  // all primitives
  if (
    typeof before == "string" ||
    typeof after == "string" ||
    typeof before == "number" ||
    typeof after == "number" ||
    typeof before == "boolean" ||
    typeof after == "boolean"
  ) {
    // no diff
    if (JSON.stringify(before) == JSON.stringify(after))
      return stringifyExpr(before, level);

    return `${stringifyExpr(before, level)} -> ${stringifyExpr(after, level)}`;
  }

  // primitive array
  if (Array.isArray(before) || Array.isArray(after)) {
    before = (before || []) as any[];
    after = (after || []) as any[];

    const max = Math.max(before.length, after.length);
    if (max == 0) return "[]";
    let str = "[\n";
    for (let i = 0; i < max; i++) {
      str += indent;
      str += getDiffSymbol(before.at(i) ?? null, after.at(i) ?? null);
      str += " ";
      str += stringifyDiff(
        before.at(i) ?? null,
        after.at(i) ?? null,
        level + 1
      );
      str += ",\n";
    }
    return str + sindent + "]\n";
  }

  // objects
  if (isPlainObject(before) || isPlainObject(after)) {
    const keysSet = new Set<string>();
    for (const key in before) keysSet.add(key);
    for (const key in after) keysSet.add(key);

    if (keysSet.size == 0) return "{}";

    let str = "{\n";
    for (const key of keysSet) {
      const bVal = before && (before[key] ?? null);
      const aVal = after && (after[key] ?? null);

      if (
        Array.isArray(bVal) &&
        bVal.length > 0 &&
        isPlainObject(bVal[0]) &&
        Array.isArray(aVal) &&
        aVal.length > 0 &&
        isPlainObject(aVal[0])
      ) {
        const maxn = Math.max(bVal.length, aVal.length);

        for (let i = 0; i < maxn; i++) {
          str += indent;
          str += getDiffSymbol(bVal.at(i) ?? null, aVal.at(i) ?? null);
          str += " " + key + " ";
          str += stringifyDiff(
            bVal.at(i) ?? null,
            aVal.at(i) ?? null,
            level + 1
          );
          str += "\n";
        }
      } else if (isPlainObject(bVal) || isPlainObject(aVal)) {
        str += indent;
        str += getDiffSymbol(bVal, aVal);
        str += " " + key + " ";
        str += stringifyDiff(bVal, aVal, level + 1);
        str += "\n";
      } else {
        str += indent;
        str += getDiffSymbol(bVal, aVal);
        str += " " + key + " = ";
        str += stringifyDiff(bVal, aVal, level + 1);
        str += "\n";
      }
    }
    return str + sindent + "}";
  }

  return "SOMETHING WENT WRONG";
}

function DiffView({
  name,
  type,
  before,
  after,
  change,
}: {
  name: string;
  type: string;
  before: JsonValue;
  after: JsonValue;
  change: ChangeType;
}) {
  return (
    <pre className="rounded-lg bg-gray-950 text-gray-200 text-xs font-mono p-4 overflow-x-auto whitespace-pre leading-relaxed">
      {"  "}
      <DiffSym sym={ACTION_ICONS[change]} />
      {" resource "}
      <span className={HIGHLIGHT.string}>"{name}"</span>{" "}
      <span className={HIGHLIGHT.string}>"{type}"</span>{" "}
      {renderDiffNode(before, after, 2)}
    </pre>
  );
}

function ResourceCard({ change }: { change: ResourceChange }) {
  const [open, setOpen] = useState(false);
  const changed = hasMeaningfulChange(change);

  return (
    <div className="rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-shadow hover:shadow-md border-gray-100 dark:border-gray-800">
      {/* Card header — clickable */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-mono text-gray-500 dark:text-gray-400 truncate">
            {change.type}
          </p>
          <p className="mt-0.5 font-semibold text-gray-900 dark:text-white truncate">
            {change.name}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-600 font-mono truncate">
            {change.address}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {change.change.actions.map((action) => (
              <ActionBadge key={action} action={action as ChangeType} />
            ))}
          </div>
          <svg
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Accordion body */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
          {changed ? (
            <DiffView
              name={change.name}
              type={change.type}
              before={change.change.before as any}
              after={change.change.after as any}
              change={change.change.actions[0] as ChangeType}
            />
          ) : (
            <ResourceInfo
              name={change.name}
              type={change.type}
              data={change.change.before as any}
            />
          )}
        </div>
      )}
    </div>
  );
}


function ErrorLogs({
  project,
  workspace,
}: {
  project: string;
  workspace: string;
}) {
  const errLogsQuery = useQuery({
    queryKey: ["error-logs", project, workspace],
    queryFn: async () => {
      const res = await client.project[":project"][":workspace"].error.$get({
        param: { project, workspace },
      });
      return await res.json();
    },
  });

  if (errLogsQuery.isLoading) return <p>Loading...</p>;

  if (errLogsQuery.data && errLogsQuery.data.error == null)
    return <p>Currently there are no errors</p>;

  // Actual Term Escape Regex /(\x9B|\x1B\[)[0-?]*[ -\/]*[@-~]/g,
  if (errLogsQuery.data)
    return (
      <div>
        <pre
          dangerouslySetInnerHTML={{
            __html: ansiToHtml(errLogsQuery.data.error),
          }}
          className="rounded-lg bg-gray-950 text-gray-200 text-xs font-mono p-4 overflow-x-auto whitespace-pre"
        />
      </div>
    );

  return null;
}

export default function PlanInfoPage() {
  const param = useParams();
  const project = param.project!;
  const workspace = param.workspace!;
  const [showError, setShowError] = useState(false);

  const qc = useQueryClient();

  const planDataQuery = useQuery({
    queryKey: ["plan-data", project, workspace],
    queryFn: async () => {
      const res = await client.project[":project"][":workspace"].status.$get({
        param: { project, workspace },
      });
      return (await res.json()) as TerraformPlanData;
    },
  });

  const wsInfoQuery = useQuery({
    queryKey: ["ws-data", project, workspace],
    queryFn: async () => {
      const res = await client.project[":project"][":workspace"].$get({
        param: { project, workspace },
      });
      return await res.json();
    },
  });

  const workspaceQuery = useQuery({
    initialData: [],
    queryKey: ["workspaces", project],
    queryFn: async () => {
      const res = await client.project[":project"].workspaces.$get({
        param: { project },
      });
      return await res.json();
    },
  });

  const refreshMut = useMutation({
    mutationKey: ["refresh-plan", project, workspace],
    mutationFn: async () => {
      const res = await client.project[":project"][":workspace"].refresh.$get({
        param: { project, workspace },
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-data"] });
      qc.invalidateQueries({ queryKey: ["ws-data"] });
    },
  });

  const applyMut = useMutation({
    mutationKey: ["apply-plan", project, workspace],
    mutationFn: async () => {
      const res = await client.project[":project"][":workspace"].apply.$get({
        param: { project, workspace },
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-data"] });
    },
  });

  if (planDataQuery.isLoading) return <div>Loading</div>;

  if (planDataQuery.error)
    return (
      <div>
        <h2>{planDataQuery.error.name}</h2>
        <p>{planDataQuery.error.message}</p>
        <p>{planDataQuery.error.stack}</p>
      </div>
    );

  if (!planDataQuery.data) return null;

  const changes = planDataQuery.data?.resource_changes;
  const summary = {
    create: changes.filter((c) => c.change.actions.includes("create")).length,
    update: changes.filter((c) => c.change.actions.includes("update")).length,
    delete: changes.filter((c) => c.change.actions.includes("delete")).length,
    noOp: changes.filter((c) => c.change.actions.every((a) => a === "no-op"))
      .length,
  };
  const drifts = planDataQuery.data?.resource_drift || [];
  const driftDetected = drifts.length > 0;
  const driftSummary = {
    create: drifts.filter((c) => c.change.actions.includes("create")).length,
    update: drifts.filter((c) => c.change.actions.includes("update")).length,
    delete: drifts.filter((c) => c.change.actions.includes("delete")).length,
    noOp: drifts.filter((c) => c.change.actions.every((a) => a === "no-op"))
      .length,
  };

  const wsInfo = wsInfoQuery.data;

  const HEALTH_STYLES: Record<string, string> = {
    SYNC: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800",
    OUT_OF_SYNC:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    ERROR:
      "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800",
    PROGRESSING:
      "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  };
  const HEALTH_DOTS: Record<string, string> = {
    SYNC: "bg-green-500",
    OUT_OF_SYNC: "bg-yellow-500",
    ERROR: "bg-red-500",
    PROGRESSING: "bg-blue-500 animate-pulse",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 py-5">
          {/* Top row: breadcrumb + actions */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {/* Breadcrumb */}
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-1 tracking-wide">
                <Link
                  to="/projects"
                  className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {project}
                </Link>
                <span className="mx-1.5">/</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {workspace}
                </span>
              </p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Terraform Plan
              </h1>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              <Dropdown title={workspace}>
                {workspaceQuery.data.map((ws) => (
                  <div
                    className="hover:bg-gray-700 py-1 px-2 cursor-pointer"
                    key={ws.name}
                  >
                    <Link to={`/projects/${project}/${ws.name}`}>
                      {ws.name}
                    </Link>
                  </div>
                ))}
                <Link
                  className="hover:bg-gray-700 py-1 px-2 cursor-pointer"
                  to={`/projects/${project}/new-ws`}
                >
                  + Add
                </Link>
              </Dropdown>
              <button
                className="cursor-pointer border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                onClick={() => refreshMut.mutate()}
                disabled={refreshMut.isPending}
              >
                {refreshMut.isPending ? "Refreshing…" : "Refresh"}
              </button>
              <button
                className="cursor-pointer border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                onClick={() => applyMut.mutate()}
                disabled={applyMut.isPending}
              >
                {applyMut.isPending ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>

          {/* Meta row: health + git target + tf version + resource count */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {wsInfo?.health && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${HEALTH_STYLES[wsInfo.health] ?? HEALTH_STYLES["OUT_OF_SYNC"]}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOTS[wsInfo.health] ?? "bg-gray-400"}`}
                />
                {wsInfo.health.replace("_", " ")}
              </span>
            )}

            {wsInfo?.health == "ERROR" && (
              <>
                <button onClick={() => setShowError(true)}>Logs</button>
                <Dialog
                  title={`Error logs - ${project}`}
                  open={showError}
                  onClose={() => setShowError(false)}
                  actions={[
                    {
                      label: "Close",
                      onClick() {
                        setShowError(false);
                      },
                      variant: "primary",
                    },
                  ]}
                >
                  <ErrorLogs project={project} workspace={workspace} />
                </Dialog>
              </>
            )}

            {wsInfo?.gitTarget && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-0.5 text-xs font-mono text-gray-600 dark:text-gray-300">
                <GitBranchIcon />
                {wsInfo.gitTarget}
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              tf v{planDataQuery.data.terraform_version}
            </span>
            <span className="text-gray-300 dark:text-gray-700">&middot;</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {changes.length} resources
            </span>
          </div>
        </div>

        {/* Summary bar */}
        <div className="mb-6 flex flex-wrap gap-3">
          {summary.create > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-2">
              <span className="text-lg font-bold text-green-700 dark:text-green-300">
                {summary.create}
              </span>
              <span className="text-sm text-green-700 dark:text-green-300">
                to create
              </span>
            </div>
          )}
          {summary.update > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-4 py-2">
              <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                {summary.update}
              </span>
              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                to update
              </span>
            </div>
          )}
          {summary.delete > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-2">
              <span className="text-lg font-bold text-red-700 dark:text-red-300">
                {summary.delete}
              </span>
              <span className="text-sm text-red-700 dark:text-red-300">
                to destroy
              </span>
            </div>
          )}
          {summary.noOp > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2">
              <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                {summary.noOp}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                unchanged
              </span>
            </div>
          )}
        </div>

        {/* Resource cards */}
        <div className="space-y-3">
          {changes.map((change) => (
            <ResourceCard key={change.address} change={change} />
          ))}
        </div>

        <hr className="my-4 border-gray-700" />

        {driftDetected ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Drift Detected
            </h2>

            {/* Drift Summary Bar */}
            <div className="mb-6 flex flex-wrap gap-3">
              {driftSummary.create > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-2">
                  <span className="text-lg font-bold text-green-700 dark:text-green-300">
                    {driftSummary.create}
                  </span>
                  <span className="text-sm text-green-700 dark:text-green-300">
                    to create
                  </span>
                </div>
              )}
              {driftSummary.update > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-4 py-2">
                  <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                    {driftSummary.update}
                  </span>
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    to update
                  </span>
                </div>
              )}
              {driftSummary.delete > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-2">
                  <span className="text-lg font-bold text-red-700 dark:text-red-300">
                    {driftSummary.delete}
                  </span>
                  <span className="text-sm text-red-700 dark:text-red-300">
                    to destroy
                  </span>
                </div>
              )}
              {driftSummary.noOp > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2">
                  <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                    {driftSummary.noOp}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    unchanged
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            No Drift Detected
          </h2>
        )}

        {/* Drift cards */}
        <div className="space-y-3">
          {drifts.map((drift) => (
            <ResourceCard key={drift.address} change={drift} />
          ))}
        </div>
      </div>
    </div>
  );
}
