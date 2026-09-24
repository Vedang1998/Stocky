"use strict";

/**
 * Userland jail preload for process-backend probes.
 * Not a kernel jail. Docker --internal is the stronger plane.
 * Disable this file in a disposable copy to revive host-path reads (authoring proof).
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");
const net = require("net");
const childProcess = require("child_process");

const roots = (process.env.STOCKY_JAIL_ROOTS || "")
  .split(path.delimiter)
  .filter(Boolean)
  .map((r) => path.resolve(r));
const allowHosts = new Set(
  (process.env.STOCKY_JAIL_NET_HOSTS || "127.0.0.1,localhost").split(",").filter(Boolean),
);
const allowPorts = new Set(
  (process.env.STOCKY_JAIL_NET_PORTS || "5432,6379")
    .split(",")
    .map((p) => Number(p))
    .filter((n) => Number.isInteger(n)),
);
const allowBinaries = new Set(["psql", "redis-cli", "node"]);

function inside(candidate) {
  const c = path.resolve(candidate);
  return roots.some((r) => c === r || c.startsWith(r + path.sep));
}

function deny(kind, detail) {
  throw new Error(`STOCKY_JAIL:${kind}:${detail}`);
}

function guardPath(p, op) {
  if (typeof p !== "string") return;
  const normalized = p.replaceAll("\\", "/");
  if (normalized.includes("docker.sock") || normalized.endsWith("/.git-credentials")) {
    deny("credential_path", p);
  }
  if (process.env.STOCKY_CANARY_PATH && path.resolve(p) === path.resolve(process.env.STOCKY_CANARY_PATH)) {
    deny("canary_path", p);
  }
  if (roots.length && !inside(p)) {
    deny("path", `${op} ${p}`);
  }
}

const origReadFileSync = fs.readFileSync;
fs.readFileSync = function (file, ...rest) {
  guardPath(String(file), "readFileSync");
  return origReadFileSync.call(this, file, ...rest);
};
const origReadFile = fs.readFile;
fs.readFile = function (file, ...rest) {
  guardPath(String(file), "readFile");
  return origReadFile.call(this, file, ...rest);
};
const origOpenSync = fs.openSync;
fs.openSync = function (file, ...rest) {
  guardPath(String(file), "openSync");
  return origOpenSync.call(this, file, ...rest);
};
const origCreateReadStream = fs.createReadStream;
fs.createReadStream = function (file, ...rest) {
  guardPath(String(file), "createReadStream");
  return origCreateReadStream.call(this, file, ...rest);
};
const origWriteFileSync = fs.writeFileSync;
fs.writeFileSync = function (file, ...rest) {
  guardPath(String(file), "writeFileSync");
  return origWriteFileSync.call(this, file, ...rest);
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.startsWith("node:") || Module.builtinModules.includes(request)) {
    return origLoad.call(this, request, parent, isMain);
  }
  if (typeof request === "string" && path.isAbsolute(request) && inside(request)) {
    return origLoad.call(this, request, parent, isMain);
  }
  deny("module", String(request));
};

function guardConnect(options) {
  let host = "127.0.0.1";
  let port = 0;
  if (typeof options === "string") {
    deny("net", options);
  }
  if (typeof options === "number") {
    port = options;
  } else if (options && typeof options === "object") {
    host = options.host || options.hostname || host;
    port = Number(options.port || 0);
    if (options.path) deny("unix_socket", options.path);
  }
  if (!allowHosts.has(host) || !allowPorts.has(port)) {
    deny("net", `${host}:${port}`);
  }
}

const origConnect = net.connect;
net.connect = function (...args) {
  guardConnect(args[0]);
  return origConnect.apply(this, args);
};
const origCreateConnection = net.createConnection;
net.createConnection = function (...args) {
  guardConnect(args[0]);
  return origCreateConnection.apply(this, args);
};

function guardSpawn(command, args) {
  const bin = path.basename(String(command));
  if (!allowBinaries.has(bin)) {
    deny("spawn", bin);
  }
  const joined = Array.isArray(args) ? args.join(" ") : "";
  if (joined.includes("docker.sock") || joined.includes(".git-credentials")) {
    deny("spawn_args", joined);
  }
}

const origSpawnSync = childProcess.spawnSync;
childProcess.spawnSync = function (command, args, options) {
  guardSpawn(command, args);
  return origSpawnSync.call(this, command, args, options);
};
const origSpawn = childProcess.spawn;
childProcess.spawn = function (command, args, options) {
  guardSpawn(command, args);
  return origSpawn.call(this, command, args, options);
};
const origExecSync = childProcess.execSync;
childProcess.execSync = function () {
  deny("exec", "execSync");
};
const origExec = childProcess.exec;
childProcess.exec = function () {
  deny("exec", "exec");
};

if (typeof fetch === "function") {
  globalThis.fetch = function () {
    deny("fetch", "fetch");
  };
}

try {
  const http = require("http");
  http.request = function () {
    deny("http", "request");
  };
  http.get = function () {
    deny("http", "get");
  };
} catch {
  /* ignore */
}
try {
  const https = require("https");
  https.request = function () {
    deny("https", "request");
  };
  https.get = function () {
    deny("https", "get");
  };
} catch {
  /* ignore */
}
