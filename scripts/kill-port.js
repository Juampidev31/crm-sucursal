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

const PORT = process.env.PORT || 3000;

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

  const pids = getListeningPids(PORT);

  if (pids.length === 0) {
    console.log(`[kill-port] Port ${PORT} is free ✓`);
    return;
  }

  console.log(`[kill-port] Found ${pids.length} process(es) on port ${PORT}: ${pids.join(', ')}`);
  killPids(pids);

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
