const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');

function loadBackend(parentModule) {
  const manifestPath = path.join(ROOT, 'src', 'backend', 'manifest.json');
  const fragments = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const source = fragments.map((fragment) => {
    const absolute = path.join(ROOT, fragment);
    return `\n// ===== MODULE: ${fragment} =====\n${fs.readFileSync(absolute, 'utf8')}`;
  }).join('\n');

  // Compile as one compatibility scope so all existing lexical bindings and
  // route ordering remain intact while source ownership is split by module.
  const runtimeFilename = path.join(ROOT, 'server.runtime.js');
  const runtimeModule = new Module(runtimeFilename, parentModule);
  runtimeModule.filename = runtimeFilename;
  runtimeModule.paths = Module._nodeModulePaths(ROOT);
  runtimeModule._compile(source, runtimeFilename);
  return runtimeModule.exports;
}

module.exports = { loadBackend };
