const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'src', 'frontend');
const PUBLIC = path.join(ROOT, 'public');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function copyVendorAsset(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyMapLibreAssets(destinationDir) {
  const dist = path.join(ROOT, 'node_modules', 'maplibre-gl', 'dist');
  if (!fs.existsSync(dist)) return;
  fs.mkdirSync(destinationDir, { recursive: true });
  copyVendorAsset(path.join(dist, 'maplibre-gl.css'), path.join(destinationDir, 'maplibre-gl.css'));
  for (const file of fs.readdirSync(dist)) {
    if (/^maplibre-gl.*\.mjs$/.test(file)) copyVendorAsset(path.join(dist, file), path.join(destinationDir, file));
  }
  fs.writeFileSync(path.join(destinationDir, 'maplibre-gl.js'), [
    "window.abearcMapLibreReady = import('/assets/vendor/maplibre-gl.mjs')",
    "  .then((module) => {",
    "    window.maplibregl = module.default || module;",
    "    return window.maplibregl;",
    "  })",
    "  .catch((error) => {",
    "    window.abearcMapLibreLoadError = error;",
    "    console.error('Failed to load MapLibre GL', error);",
    "    throw error;",
    "  });",
    ''
  ].join('\n'), 'utf8');
}

function copyPMTilesAssets(destinationDir) {
  const source = path.join(ROOT, 'node_modules', 'pmtiles', 'dist', 'pmtiles.js');
  copyVendorAsset(source, path.join(destinationDir, 'pmtiles.js'));
}

function clearPublicAssets() {
  const assetsDir = path.join(PUBLIC, 'assets');
  try {
    fs.rmSync(assetsDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EBUSY') throw err;
    console.warn(`Warning: could not remove ${assetsDir}; overwriting built assets in place.`);
  }
}

function buildFrontend() {
  fs.mkdirSync(PUBLIC, { recursive: true });
  const cssOut = path.join(PUBLIC, 'assets', 'css');
  const jsOut = path.join(PUBLIC, 'assets', 'js');
  clearPublicAssets();
  copyDir(path.join(FRONTEND, 'styles'), cssOut);
  copyDir(path.join(FRONTEND, 'services'), jsOut);
  copyDir(path.join(FRONTEND, 'scripts'), jsOut);
  copyDir(path.join(FRONTEND, 'data'), path.join(PUBLIC, 'assets', 'data'));
  copyMapLibreAssets(path.join(PUBLIC, 'assets', 'vendor'));
  copyPMTilesAssets(path.join(PUBLIC, 'assets', 'vendor'));

  const fragments = JSON.parse(fs.readFileSync(path.join(FRONTEND, 'manifest.json'), 'utf8'));
  const scripts = JSON.parse(fs.readFileSync(path.join(FRONTEND, 'script-manifest.json'), 'utf8'));
  const scriptTags = [
    'src/frontend/vendor/pmtiles.js',
    'src/frontend/vendor/maplibre-gl.js',
    ...scripts
  ].map(file => {
    const name = path.basename(file);
    return file.includes('/vendor/') ? `  <script src="/assets/vendor/${name}"></script>` : `  <script src="/assets/js/${name}"></script>`;
  }).join('\n');

  const html = [
    read('src/frontend/layout/head.html'),
    '  <link rel="stylesheet" href="/assets/vendor/maplibre-gl.css">\n',
    read('src/frontend/layout/body-open.html'),
    ...fragments.map(read),
    scriptTags + '\n',
    read('src/frontend/layout/body-close.html')
  ].join('');

  fs.writeFileSync(path.join(PUBLIC, 'index.html'), html, 'utf8');
  const logo = path.join(ROOT, 'psabe.png');
  if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(PUBLIC, 'psabe.png'));
  return path.join(PUBLIC, 'index.html');
}

if (require.main === module) {
  const output = buildFrontend();
  console.log(`Frontend built: ${output}`);
}

module.exports = { buildFrontend };
