'use strict';
// استفاده:  node scripts/make-admin.js 09123456789
const path = require('path');
const U = require('../lib/util');
U.loadEnv(path.join(__dirname, '..', '.env'));
const DB = require('../lib/db');
const mobile = U.normMobile(process.argv[2] || '');
if (!U.isMobile(mobile)) { console.error('شماره موبایل را وارد کنید:  node scripts/make-admin.js 09123456789'); process.exit(1); }
const db = new DB(path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')));
const u = db.d.users.find((x) => x.mobile === mobile);
if (!u) { console.error('کاربری با این شماره پیدا نشد. اول در سایت ثبت‌نام کنید.'); process.exit(1); }
u.role = 'admin'; db.flush();
console.log('✔ ' + u.name + ' (' + mobile + ') حالا مدیر است.');
