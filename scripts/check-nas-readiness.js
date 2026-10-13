const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const batch = fs.readFileSync(path.join(__dirname, '../2. Restart_Update ABEACR Server.bat'), 'utf8');
const start = batch.indexOf('echo [5/5] Waiting');
assert(start >= 0);
const command = batch.slice(start, batch.indexOf('" <nul', start));
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh';
for (const [health, state, expected] of [
  ['healthy', 'running', 0], ['starting', 'restarting', 1],
  ['unhealthy', 'running', 1], ['starting', 'running', 1], ['', 'exited', 1]
]) {
  const script = `
set -e
sleep() { :; }
docker_mock() {
  case "$1" in
    inspect)
      case "$3" in
        *Health.Status*) echo '${health}' ;;
        *State.Status*) echo '${state}' ;;
        *) echo diagnostics ;;
      esac ;;
    logs) echo startup-error-details ;;
    ps) echo container-status ;;
  esac
}
DOCKER=docker_mock
${command}
`;
  const result = spawnSync(shell, ['-s'], { input: script, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, result.stderr || result.stdout);
  if (expected) assert.match(result.stdout, /startup-error-details/);
  else assert.match(result.stdout, /Application is healthy/);
}
console.log('NAS readiness checks passed: healthy, restarting, unhealthy, timeout and exited states.');
