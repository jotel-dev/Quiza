import { spawn } from "child_process";

console.log("Starting Quiza backend API (port 3001) & Vite frontend (port 5173)...");

const api = spawn("node", ["server-dev.js"], { stdio: "inherit" });
const vite = spawn("npx", ["vite"], { stdio: "inherit" });

function cleanup() {
  try { api.kill(); } catch (e) {}
  try { vite.kill(); } catch (e) {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
