const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-frontend.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'src', 'backend', 'config', '00-dependencies-and-app.config.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

const fail = (message) => { console.error(`Frontend cache safety check failed: ${message}`); process.exit(1); };
if (!buildScript.includes('computeFrontendBuildId')) fail('content build ID missing');
if (!buildScript.includes('abearcFrontendBuildId')) fail('build-change recovery missing');
if (!backend.includes("requestPath === '/' || requestPath === '/index.html'")) fail('index no-store policy missing');
if (!backend.includes("requestPath.startsWith('/assets/')")) fail('asset revalidation policy missing');
if (!/\/assets\/js\/[^"?]+\.js\?v=[a-f0-9]{12}/.test(html)) fail('versioned JS URLs missing from generated index');
if (!/\/assets\/css\/[^"?]+\.css\?v=[a-f0-9]{12}/.test(html)) fail('versioned CSS URLs missing from generated index');
if (!html.includes('window.__ABEARC_BUILD_ID')) fail('generated build bootstrap missing');
console.log('Frontend cache safety check passed: content-versioned assets, no-store HTML, and build-state recovery verified.');
