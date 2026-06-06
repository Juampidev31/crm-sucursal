/**
 * kill-port.js — Cleanup script that runs BEFORE `next dev`.
 *
 * Root cause of the recurring "localhost doesn't load" bug:
 *   1. Previous `node.exe` (Next.js) processes are left running (zombie)
 *      after the terminal is closed / VS Code restarts / PC sleeps.
 *   2. These zombies hold port 3000 → new `next dev` can't bind.
 *   3. Even after killing the zombie Node, the *browser* (Chrome) keeps
 *      TCP sockets in CLOSE_WAIT state pointing at port 3000 from the
 *      dead server. The browser won't reconnect cleanly to the new server.
 *
 * This script:
 *   a) Finds any process LISTENING on port 3000 and kills it.
 *   b) Waits a beat for the OS to release the port.
 */

const { execSync } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Find ORPHANED Next.js node processes belonging to THIS project that are no
 * longer listening on the port (compiler workers / a dead `next dev` parent
 * left behind by a closed terminal or a sleeping PC). These don't show up in
 * netstat but pile up day after day and exhaust RAM, hanging compilation.
 *
 * Scoped by the project path so MCP servers, VS Code and other node tooling
 * are never touched.
 */
function getProjectNextPids() {
  const rootEsc = PROJECT_ROOT.replace(/'/g, "''");
  const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | `
    + `Where-Object { $_.CommandLine -like '*${rootEsc}*' -and $_.CommandLine -like '*next*' } | `
    + `Select-Object -ExpandProperty ProcessId`;
  try {
    const out = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    return out
      .split('\n')
      .map(s => parseInt(s.trim(), 10))
      .filter(pid => pid > 0 && pid !== process.pid && pid !== process.ppid);
  } catch {
    return [];
  }
}

function getListeningPids(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/);
      // Match lines like:  TCP  0.0.0.0:3000  0.0.0.0:0  LISTENING  <PID>
      if (parts.length >= 5 && parts[3] === 'LISTENING') {
        const localAddr = parts[1];
        // Ensure it ends with :PORT (not e.g. :30000)
        if (localAddr.endsWith(':' + port)) {
          const pid = parseInt(parts[4], 10);
          if (pid > 0 && pid !== process.pid) pids.add(pid);
        }
      }
    }
    return [...pids];
  } catch {
    return [];                // netstat found nothing → port is free
  }
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
      console.log(`  ✓ Killed PID ${pid}`);
    } catch (e) {
      console.log(`  ✗ Could not kill PID ${pid}: ${e.message}`);
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`[kill-port] Checking port ${PORT}…`);

  // 1) Kill whatever is LISTENING on the port.
  const portPids = getListeningPids(PORT);
  if (portPids.length === 0) {
    console.log(`[kill-port] Port ${PORT} is free ✓`);
  } else {
    console.log(`[kill-port] Found ${portPids.length} process(es) on port ${PORT}: ${portPids.join(', ')}`);
    killPids(portPids);
  }

  // 2) Kill ORPHANED Next.js processes of this project that survive elsewhere
  //    (not listening on the port) — the real cause of the daily "no carga".
  const orphanPids = getProjectNextPids().filter(pid => !portPids.includes(pid));
  if (orphanPids.length > 0) {
    console.log(`[kill-port] Found ${orphanPids.length} orphaned Next process(es): ${orphanPids.join(', ')}`);
    killPids(orphanPids);
  }

  // Give the OS a moment to fully release the port
  await sleep(1000);

  // Verify
  const remaining = getListeningPids(PORT);
  if (remaining.length === 0) {
    console.log(`[kill-port] Port ${PORT} is now free ✓`);
  } else {
    console.error(`[kill-port] WARNING: port ${PORT} still occupied by PID(s): ${remaining.join(', ')}`);
  }
}

main();
