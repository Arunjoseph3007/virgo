import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { client } from "~/client";
import { useImmer } from "use-immer";
import { CloseIcon, PlusIcon } from "~/common/icons";
import type { InferInsertModel } from "drizzle-orm";
import type { params } from "../../server/db/schema";

const inputClass =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function NewWorkspacePage() {
  const navigate = useNavigate();
  const param = useParams();
  const project = param.project!;

  const [wsName, setWsName] = useState("");
  const [gitTarget, setGitTarget] = useState("");
  const [varFiles, setVarFiles] = useImmer<string[]>([]);
  const [vars, setVars] = useImmer<{ key: string; value: string }[]>([]);

  const [newVarFile, setNewVarFile] = useState("");
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarVal, setNewVarVal] = useState("");

  const addWsMur = useMutation({
    mutationKey: ["add-workspace", project],
    mutationFn: async (ws: string) => {
      const newParams: Omit<
        InferInsertModel<typeof params>,
        "workspaceName" | "projectName"
      >[] = [];

      varFiles.forEach((vf) => {
        newParams.push({ key: vf, type: "var-file" });
      });
      vars.forEach((vs) => {
        newParams.push({ key: vs.key, value: vs.value, type: "var" });
      });

      console.log(newParams);
      

      const res = await client.project[":project"].workspaces.$post({
        json: { name: ws, gitTarget, params: newParams },
        param: { project },
      });
      return await res.json();
    },
    onSuccess: (d) => {
      navigate(`/projects/${project}/${d.workspace.name}`);
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-orange-500">
            {project}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            New Workspace
          </h1>
        </div>

        {/* Basic info */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Workspace name
            </label>
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              className={inputClass}
              placeholder="e.g. dev"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Git target
            </label>
            <input
              type="text"
              value={gitTarget}
              onChange={(e) => setGitTarget(e.target.value)}
              className={inputClass}
              placeholder="e.g. main"
            />
          </div>
        </div>

        {/* Variable Files */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Variable Files
          </h3>

          {varFiles.map((vf, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={vf}
                onChange={(e) => {
                  setVarFiles((vfs) => {
                    vfs[i] = e.target.value;
                  });
                }}
                className={inputClass}
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
            <input
              type="text"
              value={newVarFile}
              onChange={(e) => setNewVarFile(e.target.value)}
              placeholder="filename.tfvars"
              className={inputClass}
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

        {/* Variables */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Variables
          </h3>

          {vars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={v.key}
                onChange={(e) => {
                  setVars((vfs) => {
                    vfs[i].key = e.target.value;
                  });
                }}
                placeholder="Key"
                className={inputClass}
              />
              <input
                type="text"
                value={v.value}
                onChange={(e) => {
                  setVars((vfs) => {
                    vfs[i].value = e.target.value;
                  });
                }}
                placeholder="Value"
                className={inputClass}
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
            <input
              type="text"
              value={newVarKey}
              onChange={(e) => setNewVarKey(e.target.value)}
              placeholder="Key"
              className={inputClass}
            />
            <input
              type="text"
              value={newVarVal}
              onChange={(e) => setNewVarVal(e.target.value)}
              placeholder="Value"
              className={inputClass}
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

        {/* Submit */}
        <button
          onClick={() => addWsMur.mutate(wsName)}
          disabled={!wsName || !gitTarget || addWsMur.isPending}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addWsMur.isPending ? "Adding…" : "Add Workspace"}
        </button>
      </div>
    </div>
  );
}
