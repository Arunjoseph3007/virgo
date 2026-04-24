/**
 * server/git-ffi.ts
 *
 * Node.js FFI bindings for libgit2 using koffi.
 *
 * Prerequisites:
 *   npm install koffi
 *
 * libgit2 shared library must be installed:
 *   Windows : ships with Git for Windows — git2.dll in <Git>/mingw64/bin
 *   macOS   : brew install libgit2
 *   Linux   : apt install libgit2-dev  (or equivalent)
 */

import koffi from "koffi";
import path from "path";

// ─── Library resolution ───────────────────────────────────────────────────────

function resolveLibPath(): string {
  switch (process.platform) {
    case "win32":
      return path.join(
        process.env["PROGRAMFILES"] ?? "C:\\Program Files",
        "Git",
        "mingw64",
        "bin",
        "git2.dll"
      );
    case "darwin":
      return "/usr/local/lib/libgit2.dylib";
    default:
      return "libgit2.so.1";
  }
}

let lib: ReturnType<typeof koffi.load>;
try {
  lib = koffi.load(resolveLibPath());
} catch (err) {
  throw new Error(
    `Failed to load libgit2.\n` +
      `  Windows : install Git for Windows (https://git-scm.com)\n` +
      `  macOS   : brew install libgit2\n` +
      `  Linux   : apt install libgit2-dev\n` +
      `Underlying error: ${err}`
  );
}

// ─── Opaque pointer types ─────────────────────────────────────────────────────

const git_repository      = koffi.opaque("git_repository");
const git_reference       = koffi.opaque("git_reference");
const git_status_list     = koffi.opaque("git_status_list");
const git_remote          = koffi.opaque("git_remote");
const git_branch_iterator = koffi.opaque("git_branch_iterator");

const git_repository_p      = koffi.pointer("git_repository_p",      git_repository);
const git_reference_p       = koffi.pointer("git_reference_p",       git_reference);
const git_status_list_p     = koffi.pointer("git_status_list_p",     git_status_list);
const git_remote_p          = koffi.pointer("git_remote_p",          git_remote);
const git_branch_iterator_p = koffi.pointer("git_branch_iterator_p", git_branch_iterator);

// ─── Structs ──────────────────────────────────────────────────────────────────

// git_strarray — used by git_remote_list, git_reference_list, etc.
const git_strarray = koffi.struct("git_strarray", {
  strings: koffi.pointer("char_pp", koffi.pointer("char")),
  count: "size_t",
});

// git_error — first field is the message char*, second is the error class int
const git_error_t = koffi.struct("git_error_t", {
  message: koffi.pointer("char"),
  klass: "int",
});

// git_oid — 20-byte SHA-1 hash
const git_oid = koffi.struct("git_oid", {
  id: koffi.array("uint8", 20),
});

// git_diff_file — per-side file info inside a diff delta
const git_diff_file = koffi.struct("git_diff_file", {
  id:        git_oid,
  path:      koffi.pointer("char"),
  size:      "int64",   // git_object_size_t
  flags:     "uint32",
  mode:      "uint16",
  id_abbrev: "uint16",
});

// git_diff_delta — describes one changed file
const git_diff_delta = koffi.struct("git_diff_delta", {
  status:     "int",     // git_delta_t enum
  flags:      "uint",
  similarity: "uint16",
  nfiles:     "uint16",
  old_file:   git_diff_file,
  new_file:   git_diff_file,
});

// git_status_entry — one entry from git_status_list
const git_status_entry = koffi.struct("git_status_entry", {
  status:           "uint",
  head_to_index:    koffi.pointer(git_diff_delta),
  index_to_workdir: koffi.pointer(git_diff_delta),
});

// ─── Status flag constants (GIT_STATUS_*) ────────────────────────────────────

export const GIT_STATUS = {
  CURRENT:          0,
  INDEX_NEW:        1 << 0,
  INDEX_MODIFIED:   1 << 1,
  INDEX_DELETED:    1 << 2,
  INDEX_RENAMED:    1 << 3,
  INDEX_TYPECHANGE: 1 << 4,
  WT_NEW:           1 << 7,
  WT_MODIFIED:      1 << 8,
  WT_DELETED:       1 << 9,
  WT_TYPECHANGE:    1 << 10,
  WT_RENAMED:       1 << 11,
  IGNORED:          1 << 14,
  CONFLICTED:       1 << 15,
} as const;

// Delta type enum values
export const GIT_DELTA = {
  UNMODIFIED: 0,
  ADDED:      1,
  DELETED:    2,
  MODIFIED:   3,
  RENAMED:    4,
  COPIED:     5,
  IGNORED:    6,
  UNTRACKED:  7,
  TYPECHANGE: 8,
  UNREADABLE: 9,
  CONFLICTED: 10,
} as const;

// Branch type flags
export const GIT_BRANCH = {
  LOCAL:  1,
  REMOTE: 2,
  ALL:    3,
} as const;

// ─── Raw libgit2 function bindings ────────────────────────────────────────────

// Library lifecycle
const _libgit2_init     = lib.func("int git_libgit2_init()");
const _libgit2_shutdown = lib.func("int git_libgit2_shutdown()");
const _libgit2_version  = lib.func("void git_libgit2_version(int *major, int *minor, int *rev)");

// Repository open / init / free
const _repo_open    = lib.func("int git_repository_open(git_repository_p *out, const char *path)");
const _repo_init    = lib.func("int git_repository_init(git_repository_p *out, const char *path, unsigned int is_bare)");
const _repo_discover = lib.func("int git_repository_discover(char *out, size_t size, const char *start_path, int across_fs, const char *ceiling_dirs)");
const _repo_free    = lib.func("void git_repository_free(git_repository_p repo)");
const _repo_path    = lib.func("const char *git_repository_path(git_repository_p repo)");
const _repo_workdir = lib.func("const char *git_repository_workdir(git_repository_p repo)");
const _repo_is_bare = lib.func("int git_repository_is_bare(git_repository_p repo)");
const _repo_is_empty = lib.func("int git_repository_is_empty(git_repository_p repo)");
const _repo_head    = lib.func("int git_repository_head(git_reference_p *out, git_repository_p repo)");
const _repo_head_detached = lib.func("int git_repository_head_detached(git_repository_p repo)");

// Clone
const _clone = lib.func("int git_clone(git_repository_p *out, const char *url, const char *local_path, const void *options)");

// References
const _ref_free      = lib.func("void git_reference_free(git_reference_p ref)");
const _ref_shorthand = lib.func("const char *git_reference_shorthand(git_reference_p ref)");
const _ref_name      = lib.func("const char *git_reference_name(git_reference_p ref)");

// Branches
const _branch_iter_new  = lib.func("int git_branch_iterator_new(git_branch_iterator_p *out, git_repository_p repo, int list_flags)");
const _branch_next      = lib.func("int git_branch_next(git_reference_p *out, int *out_type, git_branch_iterator_p iter)");
const _branch_iter_free = lib.func("void git_branch_iterator_free(git_branch_iterator_p iter)");
const _branch_name      = lib.func("int git_branch_name(const char **out, git_reference_p ref)");

// Status
const _status_list_new    = lib.func("int git_status_list_new(git_status_list_p *out, git_repository_p repo, const void *opts)");
const _status_entry_count = lib.func("size_t git_status_list_entrycount(git_status_list_p statuslist)");
const _status_byindex     = lib.func("const void *git_status_byindex(git_status_list_p statuslist, size_t idx)");
const _status_file        = lib.func("int git_status_file(unsigned int *status_flags, git_repository_p repo, const char *path)");
const _status_list_free   = lib.func("void git_status_list_free(git_status_list_p statuslist)");

// Remotes
const _remote_list   = lib.func("int git_remote_list(git_strarray *out, git_repository_p repo)");
const _remote_lookup = lib.func("int git_remote_lookup(git_remote_p *out, git_repository_p repo, const char *name)");
const _remote_url    = lib.func("const char *git_remote_url(git_remote_p remote)");
const _remote_push_url = lib.func("const char *git_remote_pushurl(git_remote_p remote)");
const _remote_free   = lib.func("void git_remote_free(git_remote_p remote)");
const _strarray_free = lib.func("void git_strarray_free(git_strarray *array)");

// Errors
const _error_last = lib.func("const git_error_t *git_error_last()");

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** GIT_ITEROVER constant — returned by branch_next at end of iteration */
const GIT_ITEROVER = -31;

function getLastError(): string {
  try {
    const errPtr = _error_last();
    if (!errPtr) return "no additional error info";
    const err = koffi.decode(errPtr as object, git_error_t) as {
      message: object;
      klass: number;
    };
    return koffi.decode(err.message, "str") as string;
  } catch {
    return "could not read libgit2 error";
  }
}

function check(code: number, op: string): void {
  if (code < 0) {
    throw new GitFFIError(code, op, getLastError());
  }
}

/** Decode a koffi char* pointer to a JS string, returning null for null pointers */
function decodeStr(ptr: object | null): string | null {
  if (!ptr) return null;
  return koffi.decode(ptr, "str") as string;
}

/** Read a git_strarray's strings into a JS string array, then free the array */
function consumeStrArray(arr: { strings: object | null; count: number }): string[] {
  if (arr.count === 0 || !arr.strings) return [];
  // Decode char** as an array of char* pointers
  const ptrs = koffi.decode(arr.strings, koffi.pointer("char"), arr.count) as (object | null)[];
  const result = ptrs.map((p) => (p ? (koffi.decode(p, "str") as string) : ""));
  _strarray_free(arr);
  return result;
}

/** Convert a 20-byte git_oid id array to a hex SHA string */
function oidToHex(id: number[]): string {
  return id.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class GitFFIError extends Error {
  constructor(
    public readonly code: number,
    public readonly operation: string,
    message: string
  ) {
    super(`git_${operation} failed (code ${code}): ${message}`);
    this.name = "GitFFIError";
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LibGit2Version {
  major: number;
  minor: number;
  rev: number;
}

export interface StatusEntry {
  /** Bitmask of GIT_STATUS_* flags */
  status: number;
  /** Path of the file relative to the workdir */
  path: string;
  /** Previous path, present only for renames/copies */
  oldPath?: string;
}

export interface BranchInfo {
  name: string;
  type: "local" | "remote";
}

export interface RemoteInfo {
  name: string;
  /** Fetch URL */
  fetchUrl: string;
  /** Push URL (may differ from fetchUrl) */
  pushUrl: string | null;
}

export interface DiffFileInfo {
  path: string;
  size: bigint;
  mode: number;
  sha: string;
}

export interface DiffDelta {
  /** git_delta_t value — compare with GIT_DELTA constants */
  deltaType: number;
  oldFile: DiffFileInfo;
  newFile: DiffFileInfo;
}

// ─── Library-level functions ──────────────────────────────────────────────────

/**
 * Initialize libgit2. Must be called before any other git operations.
 * libgit2 is reference-counted; each init must be paired with a shutdown.
 */
export function libgit2Init(): number {
  const count = _libgit2_init() as number;
  if (count < 0) throw new GitFFIError(count, "libgit2_init", getLastError());
  return count;
}

/** Release a libgit2 reference. Call once per libgit2Init(). */
export function libgit2Shutdown(): number {
  return _libgit2_shutdown() as number;
}

/** Return the linked libgit2 version. */
export function libgit2Version(): LibGit2Version {
  const major = [0], minor = [0], rev = [0];
  _libgit2_version(major, minor, rev);
  return { major: major[0], minor: minor[0], rev: rev[0] };
}

/**
 * Walk upward from startPath to find the root of a git repository.
 * Returns the discovered .git path, or throws if none found.
 */
export function discoverRepo(startPath: string): string {
  const buf = Buffer.alloc(4096);
  check(
    _repo_discover(buf, buf.length, startPath, 0, null) as number,
    "repository_discover"
  );
  return buf.toString("utf8").replace(/\0.*$/, "");
}

// ─── GitRepo class ────────────────────────────────────────────────────────────

/**
 * Represents an open git repository.
 *
 * Always call `.free()` when done to release the native handle, or use
 * `GitRepo.withRepo()` for automatic cleanup.
 *
 * @example
 * const repo = GitRepo.open('/path/to/repo');
 * try {
 *   console.log(repo.currentBranch());
 *   console.log(repo.status());
 * } finally {
 *   repo.free();
 * }
 */
export class GitRepo {
  private _freed = false;

  private constructor(private readonly _ptr: object) {}

  // ── Factory methods ──────────────────────────────────────────────────────

  /**
   * Open an existing repository.
   * Walks upward from `repoPath` to find a .git directory.
   */
  static open(repoPath: string): GitRepo {
    const out = [null];
    check(_repo_open(out, repoPath) as number, "repository_open");
    return new GitRepo(out[0] as object);
  }

  /**
   * Initialize a new git repository at `repoPath`.
   * @param isBare - create a bare repository if true (default: false)
   */
  static init(repoPath: string, isBare = false): GitRepo {
    const out = [null];
    check(_repo_init(out, repoPath, isBare ? 1 : 0) as number, "repository_init");
    return new GitRepo(out[0] as object);
  }

  /**
   * Clone a remote repository into `localPath`.
   * Equivalent to `git clone <url> <localPath>`.
   */
  static clone(url: string, localPath: string): GitRepo {
    const out = [null];
    check(_clone(out, url, localPath, null) as number, "clone");
    return new GitRepo(out[0] as object);
  }

  /**
   * Open a repository, call `fn` with it, then automatically free the handle.
   *
   * @example
   * const branch = await GitRepo.withRepo('/path/to/repo', r => r.currentBranch());
   */
  static withRepo<T>(repoPath: string, fn: (repo: GitRepo) => T): T {
    const repo = GitRepo.open(repoPath);
    try {
      return fn(repo);
    } finally {
      repo.free();
    }
  }

  // ── Guard ────────────────────────────────────────────────────────────────

  private get ptr(): object {
    if (this._freed) throw new Error("GitRepo: handle has been freed");
    return this._ptr;
  }

  // ── Repository properties ────────────────────────────────────────────────

  /**
   * Absolute path to the .git directory (always ends with a path separator).
   * For bare repos this is the repo root itself.
   */
  get gitDir(): string {
    return _repo_path(this.ptr) as string;
  }

  /**
   * Absolute path to the working directory, or null for bare repos.
   * Always ends with a path separator.
   */
  get workdir(): string | null {
    const raw = _repo_workdir(this.ptr);
    return (raw as string | null) ?? null;
  }

  /** True if this is a bare repository (no working directory). */
  get isBare(): boolean {
    return (_repo_is_bare(this.ptr) as number) === 1;
  }

  /**
   * True if the repository has no commits yet.
   * Throws GitFFIError if the check fails.
   */
  get isEmpty(): boolean {
    const rc = _repo_is_empty(this.ptr) as number;
    check(rc, "repository_is_empty");
    return rc === 1;
  }

  /** True if HEAD is detached (points directly to a commit, not a branch). */
  get isHeadDetached(): boolean {
    return (_repo_head_detached(this.ptr) as number) === 1;
  }

  // ── HEAD / branch ────────────────────────────────────────────────────────

  /**
   * Short name of the current branch (e.g. `"main"`).
   * Throws if HEAD is detached — check `isHeadDetached` first.
   */
  currentBranch(): string {
    const out = [null];
    check(_repo_head(out, this.ptr) as number, "repository_head");
    const refPtr = out[0] as object;
    try {
      return _ref_shorthand(refPtr) as string;
    } finally {
      _ref_free(refPtr);
    }
  }

  /**
   * Full ref name of HEAD (e.g. `"refs/heads/main"`).
   * For a detached HEAD this is `"HEAD"`.
   */
  headRefName(): string {
    const out = [null];
    check(_repo_head(out, this.ptr) as number, "repository_head");
    const refPtr = out[0] as object;
    try {
      return _ref_name(refPtr) as string;
    } finally {
      _ref_free(refPtr);
    }
  }

  // ── Branches ─────────────────────────────────────────────────────────────

  /**
   * List branches in the repository.
   *
   * @param filter - `"local"` (default), `"remote"`, or `"all"`
   *
   * @example
   * repo.branches();           // → [{ name: 'main', type: 'local' }, ...]
   * repo.branches('remote');   // → [{ name: 'origin/main', type: 'remote' }, ...]
   */
  branches(filter: "local" | "remote" | "all" = "local"): BranchInfo[] {
    const flagMap = { local: GIT_BRANCH.LOCAL, remote: GIT_BRANCH.REMOTE, all: GIT_BRANCH.ALL };
    const iterOut = [null];
    check(
      _branch_iter_new(iterOut, this.ptr, flagMap[filter]) as number,
      "branch_iterator_new"
    );
    const iter = iterOut[0] as object;
    const results: BranchInfo[] = [];

    try {
      while (true) {
        const refOut  = [null];
        const typeOut = [0];
        const code    = _branch_next(refOut, typeOut, iter) as number;

        if (code === GIT_ITEROVER) break;
        check(code, "branch_next");

        const refPtr = refOut[0] as object;
        try {
          const nameOut = [null];
          check(_branch_name(nameOut, refPtr) as number, "branch_name");
          results.push({
            name: nameOut[0] as string,
            type: typeOut[0] === GIT_BRANCH.REMOTE ? "remote" : "local",
          });
        } finally {
          _ref_free(refPtr);
        }
      }
    } finally {
      _branch_iter_free(iter);
    }

    return results;
  }

  // ── Status ───────────────────────────────────────────────────────────────

  /**
   * Return status of all changed files (staged + unstaged + untracked).
   * Equivalent to `git status --short`.
   *
   * Each entry's `status` field is a bitmask — compare with `GIT_STATUS` constants.
   *
   * @example
   * for (const e of repo.status()) {
   *   if (e.status & GIT_STATUS.WT_MODIFIED) console.log('modified:', e.path);
   *   if (e.status & GIT_STATUS.INDEX_NEW)   console.log('staged new:', e.path);
   * }
   */
  status(): StatusEntry[] {
    const listOut = [null];
    check(_status_list_new(listOut, this.ptr, null) as number, "status_list_new");
    const list = listOut[0] as object;

    try {
      const count = _status_entry_count(list) as number;
      const entries: StatusEntry[] = [];

      for (let i = 0; i < count; i++) {
        const entryPtr = _status_byindex(list, i) as object | null;
        if (!entryPtr) continue;

        const entry = koffi.decode(entryPtr, git_status_entry) as {
          status: number;
          head_to_index: object | null;
          index_to_workdir: object | null;
        };

        // Prefer index_to_workdir delta (workdir changes); fall back to head_to_index
        const deltaPtr = entry.index_to_workdir ?? entry.head_to_index;
        let filePath = "(unknown)";
        let oldPath: string | undefined;

        if (deltaPtr) {
          const delta = koffi.decode(deltaPtr, git_diff_delta) as {
            status: number;
            old_file: { path: object | null };
            new_file: { path: object | null };
          };
          filePath = decodeStr(delta.new_file.path as object | null) ?? "(unknown)";
          const old = decodeStr(delta.old_file.path as object | null);
          if (old && old !== filePath) oldPath = old;
        }

        entries.push({ status: entry.status, path: filePath, ...(oldPath ? { oldPath } : {}) });
      }

      return entries;
    } finally {
      _status_list_free(list);
    }
  }

  /**
   * Return status flags for a single file path relative to the workdir.
   * Returns 0 (GIT_STATUS.CURRENT) if the file is unmodified.
   */
  fileStatus(filePath: string): number {
    const flags = [0];
    check(_status_file(flags, this.ptr, filePath) as number, "status_file");
    return flags[0];
  }

  // ── Remotes ──────────────────────────────────────────────────────────────

  /**
   * List all configured remotes with their fetch and push URLs.
   *
   * @example
   * repo.remotes();
   * // → [{ name: 'origin', fetchUrl: 'https://...', pushUrl: null }]
   */
  remotes(): RemoteInfo[] {
    const arr: { strings: object | null; count: number } = { strings: null, count: 0 };
    check(_remote_list(arr, this.ptr) as number, "remote_list");
    const names = consumeStrArray(arr);

    return names.map((name) => {
      const remoteOut = [null];
      check(_remote_lookup(remoteOut, this.ptr, name) as number, "remote_lookup");
      const remPtr = remoteOut[0] as object;
      try {
        const fetchUrl = (_remote_url(remPtr) as string | null) ?? "";
        const pushUrl  = (_remote_push_url(remPtr) as string | null) ?? null;
        return { name, fetchUrl, pushUrl: pushUrl !== fetchUrl ? pushUrl : null };
      } finally {
        _remote_free(remPtr);
      }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** Free the native repository handle. Do not use the object after calling this. */
  free(): void {
    if (this._freed) return;
    _repo_free(this.ptr);
    this._freed = true;
  }
}
