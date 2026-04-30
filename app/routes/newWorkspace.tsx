import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { client } from "~/client";
import { useImmer } from "use-immer";
import { CloseIcon, PlusIcon } from "~/common/icons";
import { TextInput } from "~/common/input";
import type { TParamInsert } from "../../server/validation";
import { AutoComplete } from "~/common/autocomplete";

export function meta() {
  return [
    { title: `New Workspace` },
    { name: "description", content: "Create new Workspace" },
  ];
}

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

  const projInfo = useQuery({
    queryKey: ["proj-info", project],
    queryFn: async () => {
      const res = await client.project[":project"].$get({ param: { project } });
      return await res.json();
    },
  });

  const addWsMut = useMutation({
    mutationKey: ["add-workspace", project],
    mutationFn: async (ws: string) => {
      const newParams: TParamInsert[] = [];

      varFiles.forEach((vf) => {
        newParams.push({ key: vf, type: "var-file" });
      });
      vars.forEach((vs) => {
        newParams.push({ key: vs.key, value: vs.value, type: "var" });
      });

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

  const getVarFileSuggs = async (v: string) => {
    if (!projInfo.data) return [];

    const res = await client.repos[":repoId"]["var-files"].$get({
      param: { repoId: projInfo.data.repoId.toString() },
      query: { search: v },
    });
    return await res.json();
  };

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
            <TextInput
              value={wsName}
              setValue={setWsName}
              placeholder="e.g. dev"
              label="Workspace name"
            />
          </div>

          <div className="space-y-1">
            <TextInput
              value={gitTarget}
              setValue={setGitTarget}
              placeholder="e.g. main"
              label="Git Target"
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
            <AutoComplete
              onChange={(e) => setNewVarFile(e.target.value)}
              getSuggestions={getVarFileSuggs}
              renderSuggestion={({ val, active }) => (
                <div
                  className={`py-1 px-2 text-md border-y border-gray-800 ${active ? "bg-orange-900" : "bg-gray-900"}`}
                  key={val}
                >
                  {val}
                </div>
              )}
              onSelect={(v) =>
                setVarFiles((vfs) => {
                  vfs.push(v);
                })
              }
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

        {/* Submit */}
        <button
          onClick={() => addWsMut.mutate(wsName)}
          disabled={!wsName || !gitTarget || addWsMut.isPending}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addWsMut.isPending ? "Adding…" : "Add Workspace"}
        </button>
      </div>
    </div>
  );
}
