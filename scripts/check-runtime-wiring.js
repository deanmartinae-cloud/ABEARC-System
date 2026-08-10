const path = require('path');
const os = require('os');
const realFs = require('fs');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const TEST_DATA = realFs.mkdtempSync(path.join(os.tmpdir(), 'abearc-wiring-'));
const registrations = [];

function mapDataPath(value) {
  if (typeof value !== 'string') return value;
  const normalized = path.resolve(value);
  const localData = path.join(ROOT, 'data');
  if (normalized === '/data' || normalized.startsWith('/data' + path.sep)) {
    return path.join(TEST_DATA, path.relative('/data', normalized));
  }
  if (normalized === localData || normalized.startsWith(localData + path.sep)) {
    return path.join(TEST_DATA, path.relative(localData, normalized));
  }
  return value;
}

const fsStub = Object.create(realFs);
for (const method of ['existsSync', 'mkdirSync', 'writeFileSync', 'readFileSync', 'readdirSync', 'statSync', 'rmSync', 'unlinkSync']) {
  fsStub[method] = (...args) => realFs[method](mapDataPath(args[0]), ...args.slice(1));
}
fsStub.existsSync = (value) => value === '/.dockerenv' ? false : realFs.existsSync(mapDataPath(value));

function middleware(req, res, next) { if (next) next(); }
function express() {
  const app = {
    set() { return app; },
    use(...args) {
      registrations.push({ method: 'USE', path: typeof args[0] === 'string' ? args[0] : '' });
      return app;
    },
    listen() {
      registrations.push({ method: 'LISTEN', path: '' });
      return { close() {} };
    }
  };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    app[method] = (route, ...handlers) => {
      registrations.push({ method: method.toUpperCase(), path: String(route), handlers: handlers.length });
      return app;
    };
  }
  return app;
}
express.json = () => middleware;
express.static = () => middleware;

class FakeDatabase {
  configure() {}
  serialize(fn) { if (fn) fn(); }
  exec() {}
  on() {}
  run() { return this; }
  get() { return this; }
  all() { return this; }
  prepare() { return { run() {}, finalize() {} }; }
  wait() {}
}

function multer() {
  return {
    single: () => middleware,
    array: () => middleware,
    fields: () => middleware,
    none: () => middleware
  };
}
multer.diskStorage = options => options;
multer.MulterError = class MulterError extends Error {};

const originalLoad = Module._load;
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'fs') return fsStub;
  if (request === 'express') return express;
  if (request === 'sqlite3') return { verbose: () => ({ Database: FakeDatabase }) };
  if (request === 'multer') return multer;
  if (request === 'express-rate-limit') return () => middleware;
  if (request === 'pdf-lib') return { PDFDocument: {}, StandardFonts: {}, rgb: () => ({}) };
  if (request === 'adm-zip') return class AdmZip {};
  if (request === 'pdf-parse') return { PDFParse: class PDFParse {} };
  if (request === 'mammoth') return {};
  if (request === 'xlsx') return {};
  if (request === 'qrcode') return {};
  if (request === 'jsqr') return () => null;
  if (request === 'sharp') return () => ({ rotate() { return this; }, resize() { return this; }, webp() { return this; }, async toFile() {} });
  return originalLoad(request, parent, isMain);
};
global.setInterval = () => 0;
global.setTimeout = () => 0;

try {
  require(path.join(ROOT, 'server.js'));
  const routeCount = registrations.filter(item => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(item.method)).length;
  const loginIndex = registrations.findIndex(item => item.method === 'POST' && item.path === '/api/auth/login');
  const protectionIndex = registrations.findIndex(item => item.method === 'USE' && item.path === '/api');
  const protectedIndex = registrations.findIndex(item => item.method === 'GET' && item.path === '/api/user-drive');

  if (routeCount !== 265) throw new Error(`Expected 265 runtime route registrations, received ${routeCount}.`);
  if (!(loginIndex >= 0 && protectionIndex > loginIndex && protectedIndex > protectionIndex)) {
    throw new Error(`API middleware order changed: login=${loginIndex}, protection=${protectionIndex}, protected=${protectedIndex}.`);
  }
  console.log(`Runtime wiring check passed: ${routeCount} routes; public authentication remains before API protection.`);
} finally {
  Module._load = originalLoad;
  global.setInterval = originalSetInterval;
  global.setTimeout = originalSetTimeout;
  realFs.rmSync(TEST_DATA, { recursive: true, force: true });
}
