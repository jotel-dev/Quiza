import { spawn } from "child_process";
import readline from "readline";

console.log("Starting Quiza backend API (port 3001) & Vite frontend (port 5173)...");

const isWin = process.platform === "win32";

// 1. Spawn Backend API (apps/api)
const api = isWin
  ? spawn("npm --prefix apps/api run dev", {
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    })
  : spawn("npm", ["--prefix", "apps/api", "run", "dev"], {
      stdio: ["inherit", "pipe", "pipe"],
    });

// 2. Spawn Frontend Vite (npx vite)
// On Windows, pass single command string with shell: true to avoid ENOENT / EINVAL / DEP0190
const vite = isWin
  ? spawn("npx vite", {
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    })
  : spawn("npx", ["vite"], {
      stdio: ["inherit", "pipe", "pipe"],
    });

function pipePrefix(stream, prefix, outStream = process.stdout) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    outStream.write(`${prefix} ${line}\n`);
  });
}

pipePrefix(api.stdout, "[api]");
pipePrefix(api.stderr, "[api]", process.stderr);
pipePrefix(vite.stdout, "[vite]");
pipePrefix(vite.stderr, "[vite]", process.stderr);

let apiExited = false;
let viteExited = false;

api.on("error", (err) => {
  console.error(`[api] Process failed to start: ${err.message}`);
});

vite.on("error", (err) => {
  console.error(`[vite] Process failed to start: ${err.message}`);
});

api.on("exit", (code, signal) => {
  apiExited = true;
  console.log(`[api] Exited with code ${code ?? signal}`);
  if (viteExited) {
    process.exit(code || 0);
  }
});

vite.on("exit", (code, signal) => {
  viteExited = true;
  console.log(`[vite] Exited with code ${code ?? signal}`);
  if (apiExited) {
    process.exit(code || 0);
  }
});

function cleanup() {
  console.log("\nShutting down dev processes...");
  if (api && !api.killed && api.pid) {
    if (isWin) {
      try { spawn("taskkill", ["/pid", api.pid.toString(), "/t", "/f"]); } catch (e) {}
    } else {
      try { api.kill("SIGTERM"); } catch (e) {}
    }
  }
  if (vite && !vite.killed && vite.pid) {
    if (isWin) {
      try { spawn("taskkill", ["/pid", vite.pid.toString(), "/t", "/f"]); } catch (e) {}
    } else {
      try { vite.kill("SIGTERM"); } catch (e) {}
    }
  }
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
