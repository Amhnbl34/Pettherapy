"""تست مرورگر سایت اصلی (موبایل). نیاز: pip install playwright && playwright install chromium
اجرا:  python3 scripts/e2e-site.py   (سرور موقت خودش بالا می‌آورد)"""
import subprocess, time, os, sys, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT='3113'; B='http://localhost:'+PORT; D='/tmp/pt-e2e-site'
env=dict(os.environ, PORT=PORT, DATA_DIR=D, ADMIN_MOBILE='09120000001')
subprocess.run(['rm','-rf',D]); os.makedirs('/tmp/shots',exist_ok=True)
srv=subprocess.Popen(['node','server.js'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
time.sleep(1.5)
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('✔' if c else '✘'),n)
def clean(e): return not any(k in e for k in ['ERR_NAME_NOT_RESOLVED','status of 4','favicon'])
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},locale='fa-IR',service_workers='allow')
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:200]))
    pg.goto(B+'/'); pg.wait_for_selector('#grid, .hero, header', timeout=8000); time.sleep(1)
    ok('صفحه‌ی اصلی لود شد', 'Petherapy' in pg.title())
    ok('manifest لینک شده', pg.locator('link[rel=manifest]').count()==1)
    # ثبت‌نام و ورود با API (کوکی در همین context می‌ماند)
    r=ctx.request.post(B+'/api/register',data={'name':'کاربر تست','mobile':'09120000001','password':'secret12'}); ok('ثبت‌نام',r.status==201)
    pg.reload(); time.sleep(1.2)
    # فروشگاه
    pg.locator('.cat[data-a=dog]').first.click(); time.sleep(1)
    pg.wait_for_selector('#grid .add', timeout=8000)
    n=pg.locator('#grid .add').count(); ok('محصولات در فروشگاه نمایش داده می‌شود', n>0)
    pg.locator('#grid .add').first.click(); time.sleep(.4)
    ok('محصول به سبد اضافه شد', pg.locator('#grid .stp').count()>=1)
    pg.screenshot(path='/tmp/shots/site-shop.png')
    # سبد → تسویه
    pg.click('#menu'); time.sleep(.8)
    pg.wait_for_selector('#gock',timeout=5000); pg.screenshot(path='/tmp/shots/site-cart.png')
    pg.click('#gock'); pg.wait_for_selector('#co-n')
    pg.fill('#co-n','کاربر تست'); pg.fill('#co-m','09120000001'); pg.fill('#co-c','تهران'); pg.fill('#co-a','خیابان تست، پلاک ۱')
    pg.click('#plc'); time.sleep(1.2)
    ok('سفارش ثبت شد (صفحه‌ی تأیید)', 'سفارشت ثبت شد' in pg.inner_text('body'))
    pg.screenshot(path='/tmp/shots/site-done.png')
    st=ctx.request.get(B+'/api/admin/orders').json()
    ok('سفارش در پنل مدیر دیده می‌شود', len(st.get('orders',[]))==1)
    # تنظیمات
    pg.evaluate("location.hash='#settings'"); time.sleep(.8)
    ok('صفحه‌ی تنظیمات باز شد', 'تنظیم' in pg.inner_text('body') or 'تم' in pg.inner_text('body'))
    pg.screenshot(path='/tmp/shots/site-settings.png')
    # تغییر تم
    pg.evaluate("PREFS.theme='dark';savePrefs();applyPrefs()")
    ok('تم تیره اعمال شد', pg.evaluate("document.documentElement.dataset.theme")=='dark')
    # تنظیمات سایت و حالت تعمیر
    r=ctx.request.put(B+'/api/admin/settings',data={'maintenance':True}); ok('فعال‌سازی حالت تعمیر',r.ok)
    pg.evaluate("localStorage.clear()"); pg.goto(B+'/'); time.sleep(1.2)
    bs=ctx.request.get(B+'/api/bootstrap').json(); ok('تعمیر در bootstrap عمومی است', bs['settings'].get('maintenance'))
    ctx.request.put(B+'/api/admin/settings',data={'maintenance':False})
    # چندفروشگاهی: صفحه‌ی انتخاب فروشگاه
    r=ctx.request.post(B+'/api/admin/stores',data={'name':'شعبه‌ی دوم','slug':'second','city':'کرج','active':True,'shipFree':1000000,'shipFee':30000}); ok('ساخت فروشگاه دوم',r.status in (200,201))
    ctx2=b.new_context(viewport={'width':390,'height':800},locale='fa-IR'); pg2=ctx2.new_page(); pg2.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:200]))
    pg2.goto(B+'/'); time.sleep(1.5)
    ok('با دو فروشگاه، مشتری صفحه‌ی انتخاب فروشگاه نمی‌بیند', pg2.locator('#storegate').count()==0 and 'شعبه‌ی دوم' not in pg2.inner_text('body'))
    ok('دکمه‌ی تغییر فروشگاه برای مشتری پنهان است', pg2.locator('#storeBtn').is_hidden())
    pg.goto(B+'/'); time.sleep(1.5)
    ok('مدیر کل دکمه‌ی تغییر فروشگاه را می‌بیند', pg.locator('#storeBtn').is_visible())
    pg2.screenshot(path='/tmp/shots/site-storepick.png')
    # service worker
    time.sleep(1); regs=pg.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)")
    ok('service worker ثبت شده', regs>=1)
    # بدون overflow افقی در موبایل
    ok('بدون اسکرول افقی', pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"))
    b.close()
finally:
  srv.terminate()
real=[e for e in errs if clean(e)]
ok('بدون خطای JS/کنسول', not real)
if real: print(real[:6])
print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
