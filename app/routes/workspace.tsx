import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { Dropdown } from "~/common/dropdown";
import {
  ChangeType,
  type JsonValue,
  type OutputChange,
  type ResourceChange,
  type TerraformPlanData,
} from "~/types/planData";
import { client } from "~/client";
import {
  CloseIcon,
  CresentIcon,
  GitBranchIcon,
  PlusIcon,
} from "~/common/icons";
import { Dialog } from "~/common/dialog";
import { AnsiReplacer } from "~/utils/ansi";
import type { TApplyConfig, TParamUpdate } from "../../server/validation";
import { SidePanel } from "~/common/sidePanel";
import type { THistory, TParam, TWorkspace } from "../../server/db/schema";
import { useImmer } from "use-immer";
import { TextInput } from "~/common/input";
import { ACTION_ICONS, getDiffSymbol } from "~/components/tfUtils";
import type { Route } from "../+types/root";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Virgo Workspace - ${params.project}/${params.workspace}` },
    {
      name: "description",
      content: "Manage your terraform workspace resources",
    },
  ];
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

const isPlainObject = (val: any) =>
  val !== null && typeof val === "object" && !Array.isArray(val);

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
  afterUnknown: any
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
        {afterUnknown ? (
          <span className={HIGHLIGHT.null}># known after apply</span>
        ) : (
          <ColorVal val={after} />
        )}
      </>
    );
  }

  // arrays
  if (Array.isArray(before) || Array.isArray(after)) {
    const bArr = (before || []) as JsonValue[];
    const aArr = (after || []) as JsonValue[];
    const afterUnknownArr = (afterUnknown || []) as JsonValue[];
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
              {renderDiffNode(
                bArr[i] ?? null,
                aArr[i] ?? null,
                level + 1,
                afterUnknownArr[i]
              )}
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
    const afterUnknownObj = (afterUnknown ?? {}) as Record<string, JsonValue>;

    return (
      <>
        {"{\n"}
        {[...keysSet].map((key) => {
          const bVal = bObj[key] ?? null;
          const aVal = aObj[key] ?? null;
          const afterUnknownVal = afterUnknownObj[key] ?? null;

          // array blocks
          if (
            Array.isArray(bVal) &&
            bVal.length > 0 &&
            isPlainObject(bVal[0]) &&
            Array.isArray(aVal) &&
            aVal.length > 0 &&
            isPlainObject(aVal[0]) &&
            Array.isArray(afterUnknownVal)
          ) {
            const maxn = Math.max(bVal.length, aVal.length);
            return Array.from({ length: maxn }, (_, i) => {
              const sym = getDiffSymbol(bVal[i] ?? null, aVal[i] ?? null);
              return (
                <span key={`${key}-${i}`}>
                  {indent}
                  <DiffSym sym={sym} />{" "}
                  <span className={HIGHLIGHT.key}>{key}</span>{" "}
                  {renderDiffNode(
                    bVal[i] ?? null,
                    aVal[i] ?? null,
                    level + 1,
                    afterUnknownVal[i] ?? null
                  )}
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
                {renderDiffNode(bVal, aVal, level + 1, afterUnknownVal)}
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
                {renderDiffNode(bVal, aVal, level + 1, afterUnknownVal)}
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

function DiffView({
  name,
  type,
  before,
  after,
  changeType,
  afterUnknown,
}: {
  name: string;
  type: string;
  before: JsonValue;
  after: JsonValue;
  changeType: ChangeType;
  afterUnknown: any;
}) {
  return (
    <pre className="rounded-lg bg-gray-950 text-gray-200 text-xs font-mono p-4 overflow-x-auto whitespace-pre leading-relaxed">
      {"  "}
      <DiffSym sym={ACTION_ICONS[changeType]} />
      {" resource "}
      <span className={HIGHLIGHT.string}>"{name}"</span>{" "}
      <span className={HIGHLIGHT.string}>"{type}"</span>{" "}
      {renderDiffNode(before, after, 2, afterUnknown)}
    </pre>
  );
}

function OutputCard({ name, output }: { name: string; output: OutputChange }) {
  const [open, setOpen] = useState(false);

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
            output
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-600 font-mono truncate">
            {name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {output.actions.map((action) => (
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
          <pre className="rounded-lg bg-gray-950 text-gray-200 text-xs font-mono p-4 overflow-x-auto whitespace-pre leading-relaxed">
            <DiffSym sym={ACTION_ICONS[output.actions[0]]} />
            {" output "}
            <span className={HIGHLIGHT.string}>"{name}"</span>{" "}
            <span className={HIGHLIGHT.string}>=</span>{" "}
            {renderDiffNode(
              output.before as JsonValue,
              output.after as JsonValue,
              2,
              output.after_unknown
            )}
          </pre>
        </div>
      )}
    </div>
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
          {change.change.replace_paths && (
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-200">
                Replacement caused by change in following places
              </p>
              <ul className="list-disc pl-5">
                {change.change.replace_paths.map((path) => (
                  <li className="my-2">
                    <span className="rounded-lg bg-gray-950 text-gray-200 text-xs font-mono py-1 px-2 my-1 leading-relaxed">
                      {path.join(".")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {changed ? (
            <DiffView
              name={change.name}
              type={change.type}
              before={change.change.before as any}
              after={change.change.after as any}
              changeType={change.change.actions[0] as ChangeType}
              afterUnknown={change.change.after_unknown}
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

function PlanLogs({
  project,
  workspace,
}: {
  project: string;
  workspace: string;
}) {
  const logsQuery = useQuery({
    queryKey: ["plan-logs", project, workspace],
    queryFn: async () => {
      const res = await client.project[":project"][":workspace"].logs.$get({
        param: { project, workspace },
      });
      return await res.json();
    },
  });

  if (logsQuery.isLoading) return <p>Loading...</p>;

  if (logsQuery.data && logsQuery.data.logs == null)
    return <p>Currently there are no errors</p>;

  if (logsQuery.data)
    return (
      <div>
        <pre
          dangerouslySetInnerHTML={{
            __html: AnsiReplacer.convert(logsQuery.data.logs),
          }}
          className="rounded-lg bg-gray-950 text-gray-200 text-xs font-mono p-4 overflow-x-auto whitespace-pre max-h-[60vh]"
        />
      </div>
    );

  return null;
}

function EditPanel({
  open,
  setOpen,
  params,
  workspaceInfo,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  params: TParam[];
  workspaceInfo: TWorkspace;
}) {
  const qc = useQueryClient();
  const param = useParams();
  const project = param.project!;

  const [gitTarget, setGitTarget] = useState(workspaceInfo.gitTarget);
  const [varFiles, setVarFiles] = useImmer<string[]>(
    params.filter((p) => p.type == "var-file").map((p) => p.key)
  );
  const [vars, setVars] = useImmer<{ key: string; value: string }[]>(
    params
      .filter((p) => p.type == "var")
      .map((p) => ({ key: p.key, value: p.value! }))
  );

  const [newVarFile, setNewVarFile] = useState("");
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarVal, setNewVarVal] = useState("");

  const editWsMut = useMutation({
    mutationKey: ["edit-workspace", project],
    mutationFn: async () => {
      const newParams: TParamUpdate[] = [];

      varFiles.forEach((vf) => {
        newParams.push({ key: vf, type: "var-file" });
      });
      vars.forEach((vs) => {
        newParams.push({ key: vs.key, value: vs.value, type: "var" });
      });

      const res = await client.project[":project"][":workspace"].$put({
        json: { gitTarget, params: newParams },
        param: { project, workspace: workspaceInfo.name },
      });
      return await res.json();
    },
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ws-data"] });
    },
  });

  return (
    <SidePanel
      // I am aware that this spells QWorkspace.
      // It is not a speeling mistake, but a deliberate choice
      // never make any attempts to bend this to the restrictions of your feeble world
      // For it its destiny to have the extra consonant
      title="Edit QWorkspace"
      onClose={() => setOpen(false)}
      open={open}
      actions={[
        {
          label: editWsMut.isPending ? "Editing..." : "Edit Workspace",
          onClick() {
            editWsMut.mutate();
          },
          variant: "primary",
        },
        {
          label: "Close",
          onClick() {
            setOpen(false);
          },
        },
      ]}
    >
      {/* Basic info */}
      <div className="mb-3 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 space-y-4">
        <div className="space-y-1">
          <TextInput
            value={gitTarget}
            setValue={setGitTarget}
            placeholder="e.g. main"
            label="Git Target"
          />
        </div>
      </div>

      <hr className="my-6 mx-2 border-gray-800" />

      {/* Variable Files */}
      <div className="mb-3 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Variable Files
        </h3>

        {varFiles.map((vf, i) => (
          <div key={i} className="flex items-center gap-2">
            <TextInput
              value={vf}
              setValue={(e) => setVarFiles((vfs) => (vfs[i] = e))}
            />
            <button
              onClick={() => {
                setVarFiles((vfs) => {
                  vfs.splice(i, 1);
                });
              }}
              className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
            >
              <CloseIcon />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <TextInput
            value={newVarFile}
            setValue={setNewVarFile}
            placeholder="filename.tfvars"
          />
          <button
            onClick={() => {
              setVarFiles((vfs) => {
                vfs.push(newVarFile);
              });
              setNewVarFile("");
            }}
            disabled={!newVarFile}
            className="shrink-0 rounded-lg p-2 text-white transition-colors bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <hr className="my-6 mx-2 border-gray-800" />

      {/* Variables */}
      <div className="mb-3 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Variables
        </h3>

        {vars.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <TextInput
              value={v.key}
              setValue={(e) => setVars((vfs) => (vfs[i].key = e))}
              placeholder="Key"
            />
            <TextInput
              value={v.value}
              setValue={(e) => setVars((vfs) => (vfs[i].value = e))}
              placeholder="Value"
            />
            <button
              onClick={() => {
                setVars((vs) => {
                  vs.splice(i, 1);
                });
              }}
              className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
            >
              <CloseIcon />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <TextInput
            value={newVarKey}
            setValue={setNewVarKey}
            placeholder="Key"
          />
          <TextInput
            value={newVarVal}
            setValue={setNewVarVal}
            placeholder="Value"
          />
          <button
            onClick={() => {
              setVars((vs) => {
                vs.push({ key: newVarKey, value: newVarVal });
              });
              setNewVarKey("");
              setNewVarVal("");
            }}
            disabled={!newVarKey || !newVarVal}
            className="shrink-0 rounded-lg p-2 text-white transition-colors bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </SidePanel>
  );
}

function InfoRow({
  label,
  value,
  labelWidth = "w-[100px]",
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  labelWidth?: string;
  mono?: boolean;
}) {
  return (
    <div className={`flex gap-3 ${mono ? "font-mono" : ""}`}>
      <div className={`${labelWidth} shrink-0 text-gray-500 text-right`}>
        {label}
      </div>
      <div className="text-gray-200 min-w-0 break-words">{value}</div>
    </div>
  );
}

function LastApplyInfo({ lastApplyInfo }: { lastApplyInfo: THistory }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-y border-gray-800 my-2 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">
          Last Sync
        </p>
        <button
          onClick={() => setIsOpen(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
        >
          details
        </button>
      </div>

      <SidePanel
        open={isOpen}
        onClose={() => setIsOpen(false)}
        actions={[{ label: "Close", onClick: () => setIsOpen(false) }]}
        title="Last Apply Info"
      >
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-gray-800/50 p-4 space-y-2">
            <InfoRow label="Author" value={lastApplyInfo.author} />
            <InfoRow label="Comment" value={lastApplyInfo.comment} />
            <InfoRow label="Revision" value={lastApplyInfo.revision} />
            <InfoRow
              label="Synced At"
              value={new Date(lastApplyInfo.createdAt).toLocaleString()}
            />
          </div>

          <div>
            <h5 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
              Variables
            </h5>
            <div className="rounded-lg bg-gray-800/50 p-4 space-y-2">
              {Object.entries(lastApplyInfo.varInfo.vars).length === 0 ? (
                <p className="text-gray-500 italic text-sm">No variables</p>
              ) : (
                Object.entries(lastApplyInfo.varInfo.vars).map(
                  ([key, value]) => (
                    <InfoRow key={key} label={key} value={value} mono />
                  )
                )
              )}
            </div>
          </div>

          <div>
            <h5 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
              Variable Files
            </h5>
            <div className="rounded-lg bg-gray-800/50 p-4 space-y-1">
              {lastApplyInfo.varInfo.varFiles.length === 0 ? (
                <p className="text-gray-500 italic text-sm">
                  No variable files
                </p>
              ) : (
                lastApplyInfo.varInfo.varFiles.map((v) => (
                  <div key={v} className="font-mono text-sm text-gray-300">
                    {v}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SidePanel>

      <div className="text-xs space-y-1">
        <InfoRow
          label="Author"
          value={lastApplyInfo.author}
          labelWidth="w-[72px]"
        />
        <InfoRow
          label="Comment"
          value={lastApplyInfo.comment}
          labelWidth="w-[72px]"
        />
        <InfoRow
          label="Revision"
          value={lastApplyInfo.revision}
          labelWidth="w-[72px]"
        />
        <InfoRow
          label="Synced At"
          value={new Date(lastApplyInfo.createdAt).toLocaleString()}
          labelWidth="w-[72px]"
        />
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const param = useParams();
  const project = param.project!;
  const workspace = param.workspace!;
  const [showLogs, setShowLogs] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const qc = useQueryClient();
  const navigate = useNavigate();

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
    onError: () => {
      setShowLogs(true);
    },
  });

  const applyMut = useMutation({
    mutationKey: ["apply-plan", project, workspace],
    mutationFn: async (config: TApplyConfig) => {
      const res = await client.project[":project"][":workspace"].apply.$post({
        param: { project, workspace },
        json: config,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-data"] });
      qc.invalidateQueries({ queryKey: ["ws-data"] });
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

  const wsInfo = wsInfoQuery.data?.workspaceInfo;
  const lastApplyInfo = wsInfoQuery.data?.lastApplyInfo;

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
              <Dropdown
                actions={workspaceQuery.data
                  .map((ws) => ({
                    render: () => (
                      <Link
                        key={ws.name}
                        to={`/projects/${project}/${ws.name}`}
                        className={`block px-3 py-2 text-sm transition-colors ${ws.name === workspace ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                      >
                        {ws.name}
                      </Link>
                    ),
                    onClick: () => {
                      navigate(`/projects/${project}/${ws.name}`);
                    },
                  }))
                  .concat([
                    {
                      render: () => (
                        <div className="border-t border-gray-100 dark:border-gray-700">
                          <Link
                            to={`/projects/${project}/new-ws`}
                            className="block px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            + New workspace
                          </Link>
                        </div>
                      ),
                      onClick: () => {
                        navigate(`/projects/${project}/new-ws`);
                      },
                    },
                  ])}
                title={workspace}
              />
              <button
                className="cursor-pointer border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                onClick={() => setEditDialogOpen(true)}
              >
                Edit
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              className="cursor-pointer border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
            >
              {refreshMut.isPending ? "Refreshing…" : "Refresh"}
            </button>
            <button
              className="cursor-pointer border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
              onClick={() => applyMut.mutate({})}
              disabled={applyMut.isPending || wsInfo?.health != "OUT_OF_SYNC"}
            >
              {applyMut.isPending ? "Applying…" : "Apply"}
            </button>
          </div>

          {lastApplyInfo && <LastApplyInfo lastApplyInfo={lastApplyInfo} />}

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

            <button
              onClick={() => setShowLogs(true)}
              className="inline-flex items-center gap-1 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 transition-colors cursor-pointer"
            >
              <CresentIcon />
              View logs
            </button>
            <Dialog
              title={`Plan logs - ${project} / ${workspace}`}
              open={showLogs}
              onClose={() => setShowLogs(false)}
              actions={[
                {
                  label: "Close",
                  onClick() {
                    setShowLogs(false);
                  },
                },
              ]}
            >
              <PlanLogs project={project} workspace={workspace} />
            </Dialog>

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

        {/* Edit Panel */}
        {wsInfoQuery.data && (
          <EditPanel
            open={editDialogOpen}
            setOpen={setEditDialogOpen}
            params={wsInfoQuery.data.params}
            workspaceInfo={wsInfoQuery.data.workspaceInfo}
          />
        )}

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

        {/* Drift Summary */}
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

        <hr className="my-4 border-gray-700" />

        {/* Data Cards */}
        <div className="space-y-3">
          {planDataQuery.data &&
            Object.entries(planDataQuery.data.output_changes).map(
              ([key, output]) => (
                <OutputCard key={key} name={key} output={output} />
              )
            )}
        </div>
      </div>
    </div>
  );
}
