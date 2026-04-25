import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { client } from "~/client";
import { Dialog } from "~/common/dialog";
import { Dropdown } from "~/common/dropdown";
import { CloseIcon, EditIcon, RetryIcon } from "~/common/icons";
import { TextInput } from "~/common/input";
import Loader from "~/common/Loader";
import type { TRepo } from "../../server/db/schema";
import { useImmer } from "use-immer";
import type { TRepoUpdate } from "../../server/validation";

export default function ReposPage() {
  const qc = useQueryClient();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [editRepo, setEditRepo] = useImmer<TRepo | null>(null);

  const reposDataQuery = useQuery({
    queryKey: ["repos-list"],
    queryFn: async () => {
      const res = await client.repos.$get({ query: {} });
      return await res.json();
    },
    initialData: [],
  });

  const repoRetryMut = useMutation({
    mutationKey: ["repo-retry"],
    mutationFn: async (repoId: number) => {
      const res = await client.repos[":repoId"].retry.$post({
        param: { repoId: repoId.toString() },
      });
      return await res.json();
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["repos-list"] });
    },
  });

  const repoEditMut = useMutation({
    mutationKey: ["repo-edit"],
    mutationFn: async (repoInfo: TRepoUpdate & { id: number }) => {
      const res = await client.repos[":repoId"].$put({
        param: { repoId: repoInfo.id.toString() },
        json: repoInfo,
      });
      return await res.json();
    },
    onSuccess() {
      setEditRepo(null);
      qc.invalidateQueries({ queryKey: ["repos-list"] });
    },
  });

  const repoDelMut = useMutation({
    mutationKey: ["repo-del"],
    mutationFn: async (repoId: number) => {
      const res = await client.repos[":repoId"].$delete({
        param: { repoId: repoId.toString() },
      });
      return await res.json();
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["repos-list"] });
    },
  });

  const repoCreateMut = useMutation({
    mutationKey: ["repo-create"],
    mutationFn: async (info: { name: string; url: string }) => {
      const res = await client.repos.$post({ json: info });
      return await res.json();
    },
    onSuccess() {
      setShowAddDialog(false);
      qc.invalidateQueries({ queryKey: ["repos-list"] });
    },
  });

  const summary = {
    connected: reposDataQuery.data.filter((r) => r.connected).length,
    notConnected: reposDataQuery.data.filter((r) => !r.connected).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Breadcrumb */}
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-1 tracking-wide">
              <span className="text-gray-600 dark:text-gray-300">Virgo</span>
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Repositories
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <Dialog
              onClose={() => setShowAddDialog(false)}
              actions={[
                {
                  label: "Add",
                  onClick() {
                    if (!repoName || !repoUrl) {
                      alert("Name and URL must be defined");
                      return;
                    }
                    repoCreateMut.mutate({ name: repoName, url: repoUrl });
                  },
                  variant: "secondary",
                },
                {
                  label: "Cancel",
                  onClick() {
                    setShowAddDialog(false);
                  },
                },
              ]}
              title="Connect Repository"
              open={showAddDialog}
            >
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Repository Name
                  </label>
                  <TextInput
                    value={repoName}
                    setValue={setRepoName}
                    placeholder="e.g. infra"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Repo Url
                  </label>
                  <TextInput
                    value={repoUrl}
                    setValue={setRepoUrl}
                    placeholder="e.g. https://github.com/org/repo.git"
                  />
                </div>
              </div>
            </Dialog>
            <button
              onClick={() => setShowAddDialog(true)}
              className="cursor-pointer border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
            >
              Add Repo
            </button>
          </div>
        </div>

        {/* Edit Repo */}
        <Dialog
          onClose={() => setEditRepo(null)}
          actions={[
            {
              label: "Edit",
              onClick() {
                if (!editRepo || !editRepo.name || !editRepo.url) {
                  alert("Name and URL must be defined");
                  return;
                }
                repoEditMut.mutate(editRepo);
              },
              variant: "primary",
            },
            {
              label: "Cancel",
              onClick() {
                setEditRepo(null);
              },
            },
          ]}
          title="Edit Repository"
          open={!!editRepo}
        >
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Repository Name
              </label>
              <TextInput
                value={editRepo?.name}
                setValue={(val) =>
                  setEditRepo((e) => {
                    e!.name = val;
                  })
                }
                placeholder="e.g. infra"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Repo Url
              </label>
              <TextInput
                value={editRepo?.url}
                setValue={(val) =>
                  setEditRepo((e) => {
                    e!.url = val;
                  })
                }
                placeholder="e.g. https://github.com/org/repo.git"
              />
            </div>
          </div>
        </Dialog>

        {/* Summary bar */}
        <div className="mb-6 flex flex-wrap gap-3">
          {summary.connected > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-2">
              <span className="text-lg font-bold text-green-700 dark:text-green-300">
                {summary.connected}
              </span>
              <span className="text-sm text-green-700 dark:text-green-300">
                Connected
              </span>
            </div>
          )}
          {summary.notConnected > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-2">
              <span className="text-lg font-bold text-red-700 dark:text-red-300">
                {summary.notConnected}
              </span>
              <span className="text-sm text-red-700 dark:text-red-300">
                Failed
              </span>
            </div>
          )}
        </div>

        {reposDataQuery.isLoading && <Loader />}

        <div className="flex flex-col gap-3">
          {reposDataQuery.data.map((repo) => (
            <div
              key={repo.id}
              className="rounded-lg p-4 border bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {repo.name}
                </p>
                <Link
                  to={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate hover:text-gray-600 dark:hover:text-gray-300 transition-colors block"
                >
                  {repo.url}
                </Link>
              </div>
              {repo.connected == 0 ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                  <span className="size-1.5 rounded-full bg-red-500 dark:bg-red-400" />
                  Failed
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
                  <span className="size-1.5 rounded-full bg-green-500 dark:bg-green-400" />
                  Connected
                </span>
              )}

              <Dropdown
                actions={[
                  {
                    disabled: repo.connected == 1,
                    render: () => (
                      <button
                        disabled={repoRetryMut.isPending}
                        className={`w-full flex flex-1 gap-2 items-center block px-3 py-2 text-sm transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700  disabled:opacity-50`}
                      >
                        <RetryIcon />
                        {repoRetryMut.isPending ? "Retrying..." : "Retry"}
                      </button>
                    ),
                    onClick: () => {
                      repoRetryMut.mutate(repo.id);
                    },
                  },
                  {
                    render: () => (
                      <button
                        disabled={repoDelMut.isPending}
                        className={`w-full flex flex-1 gap-2 items-center block px-3 py-2 text-sm transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700  disabled:opacity-50`}
                      >
                        <EditIcon />
                        {repoEditMut.isPending ? "Editing..." : "Edit"}
                      </button>
                    ),
                    onClick: ({ close }) => {
                      setEditRepo(repo);
                      close();
                    },
                  },
                  {
                    disabled: repoDelMut.isPending,
                    render: () => (
                      <button
                        onClick={() => repoDelMut.mutate(repo.id)}
                        className={`w-full flex flex-1 gap-2 items-center block px-3 py-2 text-sm transition-colors text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950  disabled:opacity-50`}
                      >
                        <CloseIcon />
                        {repoDelMut.isPending ? "Deleting..." : "Delete"}
                      </button>
                    ),
                    onClick: () => {
                      repoDelMut.mutate(repo.id);
                    },
                  },
                ]}
                title={""}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
