const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const os = require('os');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const AdmZip = require('adm-zip');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { execFile } = require('child_process');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MOBILE_QR_LOGIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MOBILE_QR_LOGIN_AUDIENCE = 'abearc-geocamera';

const normalizeIpAddress = (value = '') => String(value || '')
  .trim()
  .replace(/^::ffff:/, '')
  .replace(/^\[|\]$/g, '');

const isTrustedProxyAddress = (value = '') => {
  const ip = normalizeIpAddress(value);
  return ip === '127.0.0.1'
    || ip === '::1'
    || ip === 'localhost'
    || ip.startsWith('10.')
    || ip.startsWith('172.16.')
    || ip.startsWith('172.17.')
    || ip.startsWith('172.18.')
    || ip.startsWith('172.19.')
    || ip.startsWith('172.20.')
    || ip.startsWith('172.21.')
    || ip.startsWith('172.22.')
    || ip.startsWith('172.23.')
    || ip.startsWith('172.24.')
    || ip.startsWith('172.25.')
    || ip.startsWith('172.26.')
    || ip.startsWith('172.27.')
    || ip.startsWith('172.28.')
    || ip.startsWith('172.29.')
    || ip.startsWith('172.30.')
    || ip.startsWith('172.31.')
    || ip.startsWith('192.168.');
};

app.set('trust proxy', isTrustedProxyAddress);

const getClientIp = (req = {}) => {
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map(normalizeIpAddress)
    .find(Boolean);
  const realIp = normalizeIpAddress(req.headers?.['x-real-ip']);
  const cfIp = normalizeIpAddress(req.headers?.['cf-connecting-ip']);
  const expressIp = normalizeIpAddress(req.ip);
  const socketIp = normalizeIpAddress(req.socket?.remoteAddress || req.connection?.remoteAddress);

  return forwardedFor || realIp || cfIp || expressIp || socketIp || '';
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  skip: req => Boolean(req.user) || !req.path.startsWith('/api') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  keyGenerator: req => req.user?.id ? `user:${req.user.id}` : `ip:${getClientIp(req)}`,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests, please slow down."
    });
  }
});

app.use(express.json());
app.use((req, res, next) => {
  const requestPath = String(req.path || '');
  if (requestPath === '/' || requestPath === '/index.html') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (requestPath.startsWith('/assets/')) {
    // Asset URLs are content-versioned by build-frontend.js. Revalidation here
    // prevents a reverse proxy/browser from mixing scripts from different builds.
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: true, maxAge: 0 }));
