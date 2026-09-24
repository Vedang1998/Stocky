import fs from "node:fs";
import path from "node:path";

/**
 * Path jail. Production enforcement lives here.
 * Tests may copy this file and disable `isInsideRoot` to revive escapes.
 */
export function resolveContained(root, requested) {
  if (typeof root !== "string" || typeof requested !== "string") {
    return { ok: false, code: "invalid_path_args" };
  }
  if (requested.includes("\0")) {
    return { ok: false, code: "nul_in_path" };
  }
  const absRoot = path.resolve(root);
  const candidate = path.resolve(absRoot, requested);
  if (!isInsideRoot(absRoot, candidate)) {
    return { ok: false, code: "path_escape", requested, candidate, root: absRoot };
  }
  let realRoot;
  let realCandidate;
  try {
    realRoot = fs.existsSync(absRoot) ? fs.realpathSync(absRoot) : absRoot;
  } catch {
    return { ok: false, code: "root_unreadable", root: absRoot };
  }
  try {
    if (fs.existsSync(candidate)) {
      realCandidate = fs.realpathSync(candidate);
    } else {
      const parent = path.dirname(candidate);
      if (!fs.existsSync(parent)) {
        return { ok: false, code: "missing_parent", requested };
      }
      const realParent = fs.realpathSync(parent);
      realCandidate = path.join(realParent, path.basename(candidate));
    }
  } catch {
    return { ok: false, code: "path_unreadable", requested };
  }
  if (!isInsideRoot(realRoot, realCandidate)) {
    return { ok: false, code: "symlink_escape", requested, realCandidate, realRoot };
  }
  const st = fs.existsSync(realCandidate) ? fs.lstatSync(realCandidate) : null;
  if (st?.isSymbolicLink()) {
    return { ok: false, code: "symlink_rejected", requested };
  }
  if (st?.isFIFO() || st?.isSocket()) {
    return { ok: false, code: "special_file_rejected", requested };
  }
  return { ok: true, path: realCandidate, root: realRoot };
}

/** Production enforcement: prefix check on resolved paths. */
export function isInsideRoot(root, candidate) {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  if (c === r) return true;
  const prefix = r.endsWith(path.sep) ? r : r + path.sep;
  return c.startsWith(prefix);
}

export function assertNoDockerSocket(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (
    normalized === "/var/run/docker.sock" ||
    normalized.endsWith("/docker.sock") ||
    normalized === "/run/docker.sock"
  ) {
    return { ok: false, code: "docker_socket_denied" };
  }
  return { ok: true };
}

export function walkAndRejectEscapes(root) {
  const absRoot = fs.realpathSync(path.resolve(root));
  const stack = [absRoot];
  const rejected = [];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      rejected.push({ path: dir, code: "readdir_failed", message: String(err) });
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink() || ent.isFIFO() || ent.isSocket()) {
        rejected.push({ path: full, code: "special_or_symlink" });
        continue;
      }
      if (ent.isDirectory()) {
        if (ent.name === ".git" || ent.name === ".husky") {
          rejected.push({ path: full, code: "executable_scm_dir" });
          continue;
        }
        stack.push(full);
        continue;
      }
      const contained = isInsideRoot(absRoot, full);
      if (!contained) {
        rejected.push({ path: full, code: "walk_escape" });
      }
    }
  }
  if (rejected.length) {
    return { ok: false, code: "snapshot_unsafe", rejected };
  }
  return { ok: true, root: absRoot };
}
