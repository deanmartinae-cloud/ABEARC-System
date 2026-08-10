const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const os = require('os');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const AdmZip = require('adm-zip');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MOBILE_QR_LOGIN_TTL_MS = 2 * 60 * 1000;
const MOBILE_QR_LOGIN_AUDIENCE = 'abearc-geocamera';
const MOBILE_QR_LOGIN_SECRET = String(process.env.MOBILE_QR_LOGIN_SECRET || process.env.SESSION_SECRET || '');
const backupRestoreMaxBytesEnv = Number(process.env.BACKUP_RESTORE_MAX_UNCOMPRESSED_BYTES);
const backupRestoreMaxEntriesEnv = Number(process.env.BACKUP_RESTORE_MAX_ENTRIES);
const BACKUP_RESTORE_MAX_UNCOMPRESSED_BYTES = Number.isFinite(backupRestoreMaxBytesEnv) && backupRestoreMaxBytesEnv > 0
  ? Math.max(1024 * 1024, Math.floor(backupRestoreMaxBytesEnv))
  : 20 * 1024 * 1024 * 1024;
const BACKUP_RESTORE_MAX_ENTRIES = Number.isFinite(backupRestoreMaxEntriesEnv) && backupRestoreMaxEntriesEnv > 0
  ? Math.max(1, Math.floor(backupRestoreMaxEntriesEnv))
  : 100000;

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

// Fix 3: Fix Rate Limit Error
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests, please slow down."
    });
  }
});
app.use(limiter);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
