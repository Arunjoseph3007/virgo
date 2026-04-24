import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CloseIcon } from "~/common/icons";
import { TextInput } from "~/common/input";
import { client } from "~/client";
import type { TRepo } from "../../server/db/schema";
import { AutoComplete } from "~/common/autocomplete";
import { useNavigate } from "react-router";

export default function NewProjectPage() {
  const [projName, setProjName] = useState("");
  const [folder, setFolder] = useState(".");
  const [repo, setRepo] = useState<TRepo>();

  const navigate = useNavigate();

  const addProjMut = useMutation({
    mutationKey: ["add-proj"],
    mutationFn: async () => {
      if (!projName || !folder || !repo) return;

      const res = await client.project.$post({
        json: {
          name: projName,
          repoId: repo.id,
          folder,
        },
      });

      return await res.json();
    },
    onSuccess() {
      navigate("/projects");
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-orange-500">
            virgo
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            New Project
          </h1>
        </div>

        {/* Basic info */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
          <div className="space-y-1">
            <TextInput
              label="Project Name"
              type="text"
              value={projName}
              setValue={setProjName}
              placeholder="e.g. dev"
            />
          </div>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Repository
          </label>
          {repo ? (
            <div className="rounded-lg border border-orange-900 px-4 py-2 relative">
              <p className="font-semibold ">{repo.name}</p>
              <p className="font-mono font-semibold truncate text-xs text-gray-600">
                {repo.url}
              </p>
              <button
                className="absolute text-xl right-0 top-0 text-orange-500 p-1 m-1 hover:bg-gray-800 transition-colors rounded-md cursor-pointer"
                onClick={() => setRepo(undefined)}
              >
                <CloseIcon />
              </button>
            </div>
          ) : (
            <AutoComplete
              getSuggestions={async (v) => {
                const res = await client.repos.$get({
                  query: { connected: "true", search: v },
                });
                return await res.json();
              }}
              renderSuggestion={({ val, active }) => (
                <div
                  className={`cursor-pointer px-3 py-2 text-sm flex items-center gap-2 ${
                    active
                      ? "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
                      : "text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{val.name}</span>
                  <div className="w-1 h-1 bg-gray-500 rounded-full" />
                  <span className="font-mono font-semibold truncate text-gray-600">
                    {val.url}
                  </span>
                </div>
              )}
              getKey={(v) => v.id}
              onSelect={setRepo}
              placeholder="eg. my repo"
            />
          )}

          <div className="space-y-1">
            <TextInput
              label="Folder"
              type="text"
              value={folder}
              setValue={setFolder}
              placeholder="e.g. ., ./infra"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={() => {
            addProjMut.mutate();
          }}
          disabled={!projName || !repo || !folder || addProjMut.isPending}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addProjMut.isPending ? "Creating…" : "Create Project"}
        </button>
      </div>
    </div>
  );
}
