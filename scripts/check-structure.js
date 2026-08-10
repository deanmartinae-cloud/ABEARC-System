const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildFrontend } = require('./build-frontend');

const ROOT = path.resolve(__dirname, '..');
function fail(message) { console.error(`CHECK FAILED: ${message}`); process.exitCode = 1; }

const backendManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/backend/manifest.json'), 'utf8'));
const backendSource = backendManifest.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
try { new vm.Script(`(function(require,module,exports,__filename,__dirname){\n${backendSource}\n})`); }
catch (error) { fail(`Backend syntax: ${error.message}`); }

for (const relative of backendManifest) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const mapMediaInsertPattern = /INSERT INTO MapMedia\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/g;
  for (const match of source.matchAll(mapMediaInsertPattern)) {
    const columnCount = match[1].split(',').filter(value => value.trim()).length;
    const valueCount = match[2].split(',').filter(value => value.trim()).length;
    if (columnCount !== valueCount) fail(`${relative}: MapMedia insert has ${valueCount} values for ${columnCount} columns.`);
  }
}

const output = buildFrontend();
const generated = fs.readFileSync(output, 'utf8');
const baselineIds = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/frontend-dom-id-baseline.json'), 'utf8'));
const idPattern = /\bid="([^"]+)"/g;
const stripScripts = text => text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const ids = text => [...stripScripts(text).matchAll(idPattern)].map(m => m[1]).sort();
const generatedIds = ids(generated);
if (JSON.stringify(baselineIds) !== JSON.stringify(generatedIds)) fail('Generated frontend DOM IDs differ from compatibility baseline.');

for (const relative of JSON.parse(fs.readFileSync(path.join(ROOT, 'src/frontend/script-manifest.json'), 'utf8'))) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  try { new vm.Script(source, { filename: relative }); }
  catch (error) { fail(`${relative}: ${error.message}`); }
}

if (!process.exitCode) console.log(`Structure check passed: ${backendManifest.length} backend modules, ${baselineIds.length} DOM IDs preserved.`);
