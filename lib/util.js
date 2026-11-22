'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// خواندن ساده‌ی فایل .env (بدون وابستگی)
function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) { /* .env اختیاری است */ }
}

const hashPw = (pw) => {
  const salt = crypto.randomBytes(16);
  return 's1$' + salt.toString('hex') + '$' + crypto.scryptSync(pw, salt, 64).toString('hex');
};
const checkPw = (pw, stored) => {
  const [v, s, h] = String(stored || '').split('$');
  if (v !== 's1' || !s || !h) return false;
  const a = crypto.scryptSync(String(pw), Buffer.from(s, 'hex'), 64), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const token = () => crypto.randomBytes(32).toString('hex');
const digits = (t) => String(t == null ? '' : t).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 1776).replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632);
const normMobile = (t) => digits(t).replace(/[\s-]/g, '');
const isMobile = (t) => /^09\d{9}$/.test(t);
const isEmail = (t) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) && t.length <= 120;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// محدودکننده‌ی ساده‌ی تعداد درخواست (در حافظه)
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > max;
}

module.exports = { loadEnv, hashPw, checkPw, sha, token, digits, normMobile, isMobile, isEmail, str, limited };
