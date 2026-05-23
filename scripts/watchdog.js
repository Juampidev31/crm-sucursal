/**
 * watchdog.js — Memory watchdog for the Next.js dev server.
 *
 * Problem: Turbopack's dev server leaks memory over time, growing to 1.5-2GB+
 * and eventually becoming unresponsive ("localhost doesn't load").
 *
 * Solution: This script spawns `next dev` as a child process and monitors its
 * memory usage. If it exceeds the threshold, it automatically restarts the
 * server — no manual intervention needed.
 *
 * Usage: `node scripts/watchdog.js` (or `npm run dev` after updating package.json)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────
const MAX_MEMORY_MB = 1200;          // Restart if Node.js exceeds this (MB)
const CHECK_INTERVAL_MS = 30_000;    // Check memory every 30 seconds
const RESTART_COOLDOWN_MS = 10_000;  // Wait 10s after restart before monitoring
const PORT = process.env.PORT || 3000;
// ─────────────────────────────────────────────────────────────────

const PROJECT_DIR = path.resolve(__dirname, '..');
let child = null;
let checkTimer = null;
let restartCount = 0;
let lastRestartTime = 0;

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-AR');
  console.log(`[watchdog ${ts}] ${msg}`);
}

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[3] === 'LISTENING') {
        const localAddr = parts[1];
        if (localAddr.endsWith(':' + port)) {
          const pid = parseInt(parts[4], 10);
          if (pid > 0 && pid !== process.pid) pids.add(pid);
        }
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
        log(`Killed stale PID ${pid} on port ${port}`);
      } catch { /* already dead */ }
    }
  } catch { /* port is free */ }
}

function getProcessMemoryMB(pid) {
  try {
    // Use tasklist to get memory of the specific PID and its children
    const out = execSync(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).WorkingSet64"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const bytes = parseInt(out.trim(), 10);
    if (!isNaN(bytes)) return Math.round(bytes / 1024 / 1024);
  } catch { /* process might be dead */ }
  return 0;
}

function getNodeChildrenMemoryMB() {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-Process -Name node -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const bytes = parseInt(out.trim(), 10);
    if (!isNaN(bytes)) return Math.round(bytes / 1024 / 1024);
  } catch { /* no node processes */ }
  return 0;
}

function startServer() {
  // Clean up before starting
  killPort(PORT);

  log(`Starting Next.js dev server... (restart #${restartCount})`);

  child = spawn('npx', ['next', 'dev', '--hostname', '0.0.0.0'], {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      // Limit V8 heap to prevent runaway growth
      NODE_OPTIONS: '--max-old-space-size=1024',
    },
  });

  child.on('exit', (code, signal) => {
    log(`Server exited (code=${code}, signal=${signal})`);
    child = null;

    // Don't restart if we intentionally killed it (signal will be set)
    // or if user pressed Ctrl+C
    if (signal === 'SIGTERM' || signal === 'SIGINT') return;

    // Auto-restart on crash
    log('Server crashed — restarting in 3 seconds...');
    setTimeout(startServer, 3000);
  });

  lastRestartTime = Date.now();

  // Start memory monitoring after cooldown
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(checkMemory, CHECK_INTERVAL_MS);
}

function checkMemory() {
  // Don't check during cooldown period
  if (Date.now() - lastRestartTime < RESTART_COOLDOWN_MS) return;
  if (!child || child.exitCode !== null) return;

  const memMB = getNodeChildrenMemoryMB();

  if (memMB === 0) return; // Couldn't read memory

  if (memMB > MAX_MEMORY_MB) {
    log(`⚠ Memory usage: ${memMB}MB (limit: ${MAX_MEMORY_MB}MB) — RESTARTING`);
    restartCount++;
    restartServer();
  } else if (memMB > MAX_MEMORY_MB * 0.75) {
    log(`⚡ Memory usage: ${memMB}MB (75% of limit) — watching closely`);
  }
}

function restartServer() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }

  // Kill all node processes except ourselves
  try {
    const myPid = process.pid;
    execSync(
      `powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${myPid} } | Stop-Process -Force"`,
      { encoding: 'utf8', timeout: 10000 }
    );
  } catch { /* best effort */ }

  child = null;

  // Wait a moment then restart
  setTimeout(startServer, 2000);
}

// ─── Handle graceful shutdown ────────────────────────────────────
function shutdown() {
  log('Shutting down...');
  if (checkTimer) clearInterval(checkTimer);
  if (child) {
    child.kill('SIGTERM');
    // Force kill after 3s if still alive
    setTimeout(() => {
      if (child) {
        try { process.kill(child.pid, 'SIGKILL'); } catch {}
      }
      process.exit(0);
    }, 3000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.message}`);
  shutdown();
});

// ─── Start ───────────────────────────────────────────────────────
console.log('');
console.log('  ┌─────────────────────────────────────────────┐');
console.log('  │  🐕 Next.js Watchdog - Auto Memory Manager  │');
console.log('  │                                              │');
console.log(`  │  Memory limit: ${MAX_MEMORY_MB}MB                      │`);
console.log(`  │  Check interval: ${CHECK_INTERVAL_MS / 1000}s                        │`);
console.log('  │                                              │');
console.log('  │  The server will auto-restart if memory      │');
console.log('  │  usage gets too high. No more frozen pages!  │');
console.log('  └─────────────────────────────────────────────┘');
console.log('');

startServer();
