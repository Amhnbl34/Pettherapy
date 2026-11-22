"""تست مرورگر پنل مدیریت (موبایل). اجرا: python3 scripts/e2e-admin.py"""
import subprocess, time, os, sys
from playwright.sync_api import sync_playwright
env=dict(os.environ, PORT='3111', DATA_DIR='/tmp/ptdata', ADMIN_MOBILE='09120000001')
subprocess.run('rm -rf /tmp/ptdata',shell=True)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('/tmp/shots',exist_ok=True)
srv=subprocess.Popen(['node','server.js'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
time.sleep(1.5)
errs=[]; res=[]
def ok(n,c): res.append((n,bool(c))); print(('✔' if c else '✘'),n)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='fa-IR')
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
    B='http://localhost:3111'
    pg.goto(B+'/admin'); pg.wait_for_selector('#app .card')
    ok('بدون ورود: فرم ورود مدیر نمایش داده می‌شود', pg.locator('#l-id').is_visible() and 'ورود مدیر' in pg.inner_text('#app'))
    r=ctx.request.post(B+'/api/register',data={'name':'مدیر تست','mobile':'09120000001','password':'secret12'})
    ok('ثبت‌نام مدیر', r.status==201)
    pg.goto(B+'/admin'); pg.wait_for_selector('.tabs')
    labels=pg.locator('.tabs button').all_inner_texts()
    ok('۶ تب برای مدیر کل', len(labels)==6)
    pg.screenshot(path='/tmp/shots/1-stats.png')
    for k in ['products','orders','users','stores','settings','stats']:
        pg.click(f'[data-t={k}]'); pg.wait_for_function("!document.querySelector('#body').innerText.includes('در حال بارگذاری')")
        ok('تب '+k+' رندر شد', len(pg.inner_text('#body').strip())>5)
        pg.screenshot(path=f'/tmp/shots/tab-{k}.png')
    # محصولات: باز کردن دیالوگ ویرایش
    pg.click('[data-t=products]'); pg.wait_for_selector('[data-act=pedit]')
    pg.locator('.card [data-act=pedit], [data-act=pedit][data-id]:not([data-id=new])').first.click(); pg.wait_for_selector('#dlg[open]')
    ok('دیالوگ محصول باز شد', pg.locator('#f-name').count()==1)
    pg.screenshot(path='/tmp/shots/product-dlg.png')
    old=pg.input_value('#f-price'); pg.fill('#f-price','12345'); pg.click('[data-act=psave]')
    time.sleep(.8)
    ok('ذخیره‌ی قیمت محصول', pg.evaluate("document.querySelector('#dlg').open===false"))
    # تنظیمات سایت
    pg.click('[data-t=settings]'); pg.wait_for_selector('#t-name'); pg.fill('#t-tag','شعار تست'); pg.click('[data-act=tsave]'); time.sleep(.6)
    s=ctx.request.get(B+'/api/bootstrap').json()
    ok('تنظیمات سایت ذخیره شد', (s.get('settings') or {}).get('tagline')=='شعار تست' or 'شعار تست' in str(s.get('settings')))
    # فروشگاه جدید
    pg.click('[data-t=stores]'); pg.wait_for_selector('[data-act=sedit]')
    n0=pg.locator('[data-act=sedit]').count()
    ok('فهرست فروشگاه‌ها', n0>=1)
    # فروشگاه جدید
    pg.click('[data-act=sedit][data-id=new]'); pg.wait_for_selector('#s-name')
    pg.fill('#s-name','شعبه‌ی تست'); pg.fill('#s-slug','test-branch'); pg.fill('#s-city','تهران'); pg.click('[data-act=ssave]'); time.sleep(.8)
    ok('فروشگاه جدید ساخته شد', pg.locator('[data-act=sedit]').count()>n0 and 'شعبه‌ی تست' in pg.inner_text('#body'))
    ok('انتخابگر فروشگاه بالای صفحه ظاهر شد', pg.locator('#storeSel').is_visible())
    pg.screenshot(path='/tmp/shots/stores.png')
    b.close()
finally:
  srv.terminate()
real=[e for e in errs if 'favicon' not in e and 'ERR_NAME_NOT_RESOLVED' not in e and 'status of 400' not in e]
ok('بدون خطای کنسول', not real)
if real: print(real[:5])
print(sum(1 for _,c in res if c),'/',len(res))
sys.exit(0 if all(c for _,c in res) else 1)
