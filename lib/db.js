'use strict';
const fs = require('fs');
const path = require('path');

// دیتابیس فایلی (JSON) با نوشتن امن؛ مناسب فروشگاه‌های کوچک تا متوسط
class DB {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
    this.d = { users: [], sessions: [], products: [], orders: [], pets: [], rates: [], stores: [], settings: {}, seq: { user: 0, product: 0, order: 1000, pet: 0, store: 0 } };
    this.fresh = !fs.existsSync(this.file);
    if (!this.fresh) {
      try { Object.assign(this.d, JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
      catch (e) {
        const bad = this.file + '.corrupt-' + Date.now();
        fs.copyFileSync(this.file, bad);
        throw new Error('فایل db.json خراب است. یک کپی در ' + bad + ' ذخیره شد؛ از پوشه‌ی backups جایگزینش کنید.');
      }
      this.backup();
    }
    this.t = null;
  }
  backup() {
    try {
      const f = path.join(this.dir, 'backups', 'db-' + new Date().toISOString().slice(0, 10) + '.json');
      if (!fs.existsSync(f)) fs.copyFileSync(this.file, f);
      const all = fs.readdirSync(path.join(this.dir, 'backups')).sort();
      all.slice(0, Math.max(0, all.length - 14)).forEach((x) => fs.unlinkSync(path.join(this.dir, 'backups', x)));
    } catch (e) { console.error('backup:', e.message); }
  }
  next(k) { this.d.seq[k] = (this.d.seq[k] || (k === 'order' ? 1000 : 0)) + 1; return this.d.seq[k]; }
  save() { clearTimeout(this.t); this.t = setTimeout(() => this.flush(), 150); }
  flush() {
    clearTimeout(this.t);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.d));
    fs.renameSync(tmp, this.file);
  }
}
module.exports = DB;
