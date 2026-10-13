const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'src', 'frontend');
const PUBLIC = path.join(ROOT, 'public');


function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out.sort();
}

function computeFrontendBuildId() {
  const hash = crypto.createHash('sha256');
  const roots = [
    path.join(FRONTEND, 'layout'),
    path.join(FRONTEND, 'pages'),
    path.join(FRONTEND, 'components'),
    path.join(FRONTEND, 'modals'),
    path.join(FRONTEND, 'styles'),
    path.join(FRONTEND, 'services'),
    path.join(FRONTEND, 'scripts'),
    path.join(FRONTEND, 'data'),
    path.join(FRONTEND, 'media')
  ];
  const manifestFiles = [
    path.join(FRONTEND, 'manifest.json'),
    path.join(FRONTEND, 'script-manifest.json')
  ];
  const files = [...roots.flatMap(listFilesRecursive), ...manifestFiles.filter(fs.existsSync)].sort();
  for (const file of files) {
    hash.update(path.relative(ROOT, file));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

function versionAssetRefs(html, buildId) {
  return String(html || '').replace(/(src|href)="(\/assets\/[^"?]+)(?:\?[^"#]*)?"/g, (_m, attr, url) => `${attr}="${url}?v=${buildId}"`);
}

function buildRecoveryBootstrap(buildId) {
  return [
    '  <script>',
    `    window.__ABEARC_BUILD_ID = ${JSON.stringify(buildId)};`,
    '    try {',
    "      const buildKey = 'abearcFrontendBuildId';",
    '      const previousBuild = localStorage.getItem(buildKey);',
    '      if (previousBuild && previousBuild !== window.__ABEARC_BUILD_ID) {',
    "        sessionStorage.removeItem('abedSessionAppState');",
    "        localStorage.removeItem('abedSessionAppState');",
    '      }',
    '      localStorage.setItem(buildKey, window.__ABEARC_BUILD_ID);',
    '    } catch (_) {}',
    '  </script>',
    ''
  ].join('\n');
}

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

function copyMapLibreAssets(destinationDir, buildId) {
  const dist = path.join(ROOT, 'node_modules', 'maplibre-gl', 'dist');
  if (!fs.existsSync(dist)) return;
  fs.mkdirSync(destinationDir, { recursive: true });
  copyVendorAsset(path.join(dist, 'maplibre-gl.css'), path.join(destinationDir, 'maplibre-gl.css'));
  for (const file of fs.readdirSync(dist)) {
    if (/^maplibre-gl.*\.mjs$/.test(file)) copyVendorAsset(path.join(dist, file), path.join(destinationDir, file));
  }
  fs.writeFileSync(path.join(destinationDir, 'maplibre-gl.js'), [
    `window.abearcMapLibreReady = import('/assets/vendor/maplibre-gl.mjs?v=${buildId}')`,
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
  const buildId = computeFrontendBuildId();
  fs.mkdirSync(PUBLIC, { recursive: true });
  const cssOut = path.join(PUBLIC, 'assets', 'css');
  const jsOut = path.join(PUBLIC, 'assets', 'js');
  clearPublicAssets();
  copyDir(path.join(FRONTEND, 'styles'), cssOut);
  copyDir(path.join(FRONTEND, 'services'), jsOut);
  copyDir(path.join(FRONTEND, 'scripts'), jsOut);
  copyDir(path.join(FRONTEND, 'data'), path.join(PUBLIC, 'assets', 'data'));
  if (fs.existsSync(path.join(FRONTEND, 'media'))) copyDir(path.join(FRONTEND, 'media'), path.join(PUBLIC, 'assets', 'media'));
  copyMapLibreAssets(path.join(PUBLIC, 'assets', 'vendor'), buildId);
  copyPMTilesAssets(path.join(PUBLIC, 'assets', 'vendor'));
  copyVendorAsset(path.join(ROOT, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.min.js'), path.join(PUBLIC, 'assets', 'vendor', 'pdf-lib.min.js'));

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

  const html = versionAssetRefs([
    read('src/frontend/layout/head.html'),
    buildRecoveryBootstrap(buildId),
    '  <link rel="stylesheet" href="/assets/vendor/maplibre-gl.css">\n',
    read('src/frontend/layout/body-open.html'),
    ...fragments.map(read),
    scriptTags + '\n',
    read('src/frontend/layout/body-close.html')
  ].join(''), buildId);

  fs.writeFileSync(path.join(PUBLIC, 'index.html'), html, 'utf8');
  const logo = path.join(ROOT, 'psabe.png');
  if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(PUBLIC, 'psabe.png'));
  return path.join(PUBLIC, 'index.html');
}

if (require.main === module) {
  const output = buildFrontend();
  console.log(`Frontend built: ${output} (build ${computeFrontendBuildId()})`);
}

module.exports = { buildFrontend };
