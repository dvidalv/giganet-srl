#!/usr/bin/env node
/**
 * Finds the first free TCP port (preferring PORT from .env.local / project.json)
 * and starts the app on it. Runtime port is the source of truth.
 *
 * Usage:
 *   node ./scripts/dev-free-port.mjs [dev|start]
 *   node ./scripts/dev-free-port.mjs --kind next|vite|vinext|env --mode dev|start -- <cmd...>
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const portfinder = require("portfinder");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = { mode: "dev", kind: null, passthrough: [] };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      out.passthrough = args.slice(i + 1);
      break;
    }
    if (a === "--kind") {
      out.kind = args[++i];
      continue;
    }
    if (a === "--mode") {
      out.mode = args[++i];
      continue;
    }
    if (a === "dev" || a === "start" || a === "preview") {
      out.mode = a;
      continue;
    }
    out.passthrough.push(a);
  }
  return out;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readPreferredPort() {
  const envPath = join(root, ".env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^\s*PORT\s*=\s*(\d+)/m);
    if (m) return Number(m[1]);
  }
  const pj = readJson(join(root, "project.json"));
  if (pj && pj.port) return Number(pj.port);
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0) return envPort;
  return 3000;
}

function detectKind(cliKind) {
  if (cliKind) return cliKind;
  const pj = readJson(join(root, "project.json"));
  const fw = (pj && pj.framework) || "";
  if (fw === "vite") return "vite";
  if (fw === "vinext") return "vinext";
  if (fw === "express" || fw === "node" || fw === "node-server" || fw === "cra" || fw === "other") {
    return "env";
  }
  const pkg = readJson(join(root, "package.json"));
  const scripts = (pkg && pkg.scripts) || {};
  const blob = `${scripts.dev || ""} ${scripts.start || ""}`;
  if (/\bvinext\b/.test(blob)) return "vinext";
  if (existsSync(join(root, "node_modules", "next"))) return "next";
  if (existsSync(join(root, "node_modules", "vite"))) return "vite";
  return "env";
}

function binPath(...parts) {
  return join(root, "node_modules", ...parts);
}

function localBin(name) {
  const unix = binPath(".bin", name);
  const win = binPath(".bin", `${name}.cmd`);
  if (existsSync(unix)) return unix;
  if (existsSync(win)) return win;
  return null;
}

function run(command, args, { shell = false, envExtra = {} } = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell,
    env: { ...process.env, PATH: `${binPath(".bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH || ""}`, ...envExtra },
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      try {
        process.kill(process.pid, signal);
      } catch {
        process.exit(1);
      }
      return;
    }
    process.exit(code ?? 1);
  });
  child.on("error", (err) => {
    console.error("[dev-free-port] failed to start:", err.message);
    process.exit(1);
  });
}

const cli = parseArgs(process.argv);
const preferred = readPreferredPort();
portfinder.setBasePort(preferred);
const port = await portfinder.getPortPromise();
const kind = detectKind(cli.kind);
const extra = cli.passthrough;

console.log(
  `[dev-free-port] free port ${port} (preferred ${preferred}, kind=${kind}, mode=${cli.mode})`
);

const envExtra = { PORT: String(port) };

if (kind === "next") {
  const nextBin = binPath("next", "dist", "bin", "next");
  if (!existsSync(nextBin)) {
    console.error("[dev-free-port] next binary not found — run npm/pnpm install");
    process.exit(1);
  }
  const modeArgs = cli.mode === "start" ? ["start"] : ["dev"];
  run(process.execPath, [nextBin, ...modeArgs, "-p", String(port), ...extra], { envExtra });
} else if (kind === "vinext") {
  const vinext = localBin("vinext");
  if (!vinext) {
    console.error("[dev-free-port] vinext binary not found — run pnpm install");
    process.exit(1);
  }
  const modeArgs = cli.mode === "start" ? ["start"] : ["dev"];
  run(vinext, [...modeArgs, "-p", String(port), ...extra], { envExtra });
} else if (kind === "vite") {
  const viteBin = binPath("vite", "bin", "vite.js");
  if (!existsSync(viteBin)) {
    console.error("[dev-free-port] vite binary not found — run npm install");
    process.exit(1);
  }
  const modeArgs = cli.mode === "preview" ? ["preview"] : [];
  run(process.execPath, [viteBin, ...modeArgs, "--port", String(port), "--strictPort", ...extra], {
    envExtra,
  });
} else {
  let cmd = extra.slice();
  if (cmd.length === 0) {
    console.error(
      "[dev-free-port] --kind env requires a command after -- (e.g. -- node app.js)"
    );
    process.exit(1);
  }
  // Resolve local binaries (nodemon, parcel, react-scripts, …)
  const local = localBin(cmd[0]);
  if (local) cmd[0] = local;
  run(cmd[0], cmd.slice(1), { envExtra });
}
