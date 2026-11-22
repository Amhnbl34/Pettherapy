"""تست مرورگر پنل مدیریت با نقش «مدیر فروشگاه» (manager) روی موبایل.
بررسی می‌کند مدیر فروشگاه فقط فروشگاه خودش را ببیند و به بخش‌های مدیر کل دسترسی نداشته باشد.
اجرا: python3 scripts/e2e-manager.py"""
import subprocess, time, os, sys
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT='3114'; B='http://localhost:'+PORT; D='/tmp/pt-e2e-manager'
env=dict(os.environ, PORT=PORT, DATA_DIR=D, ADMIN_MOBILE='09120000001')
subprocess.run(['rm','-rf',D]); os.makedirs('/tmp/shots',exist_ok=True)
srv=subprocess.Popen(['node','server.js'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
time.sleep(1.5)
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('✔' if c else '✘'),n)
TO={'n':'مشتری تست','m':'09120000003','c':'تهران','a':'تهران خیابان تست پلاک ۱۰'}
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    # --- مدیر کل: آماده‌سازی دیتا با API ---
    A=b.new_context(); a=A.request
    ok('ثبت‌نام مدیر کل', a.post(B+'/api/register',data={'name':'مدیر کل','mobile':'09120000001','password':'secret12'}).status==201)
    s2=a.post(B+'/api/admin/stores',data={'name':'شعبه‌ی دوم','slug':'second','city':'کرج','active':True,'shipFree':1000000,'shipFee':30000}).json()['store']['id']
    p2=a.post(B+'/api/admin/products',data={'storeId':s2,'name':'محصول ویژه‌ی شعبه دوم','brand':'TestBrand','animal':'dog','cat':1,'price':50000,'stock':10,'emoji':'🦴','active':True}).json()['product']['id']
    boot1=a.get(B+'/api/bootstrap?store=1').json(); p1=boot1['products'][0]['id']
    # --- مشتری: یک سفارش در هر فروشگاه ---
    C=b.new_context(); c=C.request
    c.post(B+'/api/register',data={'name':'مشتری تست','mobile':'09120000003','password':'secret12'})
    o1=c.post(B+'/api/orders',data={'items':[{'pid':p1,'q':1}],'to':TO}); a.put(B+'/api/admin/settings',data={'mainStore':s2}); o2=c.post(B+'/api/orders',data={'items':[{'pid':p2,'q':1}],'to':TO}); a.put(B+'/api/admin/settings',data={'mainStore':1})
    ok('دو سفارش (یکی در هر فروشگاه) ثبت شد', o1.status==201 and o2.status==201)
    o1id=o1.json()['order']['id']
    # --- ساخت مدیر فروشگاه ---
    M=b.new_context(viewport={'width':390,'height':800},locale='fa-IR'); m=M.request
    mid=m.post(B+'/api/register',data={'name':'مدیر شعبه دوم','mobile':'09120000002','password':'secret12'}).json()['user']['id']
    users=a.get(B+'/api/admin/users').json()['users']
    r=a.put(B+f'/api/admin/users/{mid}',data={'role':'manager','stores':[s2]}); ok('مدیر کل نقش manager را تعیین کرد', r.ok)
    # --- رابط مرورگر مدیر فروشگاه ---
    pg=M.new_page()
    pg.on('console',lambda x: errs.append(x.text[:200]) if x.type=='error' else None); pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:200]))
    pg.goto(B+'/admin#users'); pg.wait_for_selector('.tabs',timeout=8000)
    labels=pg.locator('.tabs button').all_inner_texts()
    ok('فقط ۳ تب (داشبورد، محصولات، سفارش‌ها)', len(labels)==3)
    ok('تب‌های مدیر کل دیده نمی‌شود', not any(k in ' '.join(labels) for k in ['کاربران','فروشگاه‌ها','تنظیمات']))
    ok('آدرس #users به داشبورد برمی‌گردد (نه خطا)', pg.locator('.tabs .on').inner_text().strip().endswith('داشبورد'))
    ok('انتخابگر فروشگاه دیده نمی‌شود (فقط یک فروشگاه)', not pg.locator('#storeSel').is_visible())
    time.sleep(.6)
    ok('داشبورد: فقط ۱ سفارش (فروشگاه خودش)', pg.locator('.stats .card b').first.inner_text().strip() in ('۱','1'))
    ok('داشبورد: آمار «کاربر» (مخصوص مدیر کل) نیست', 'کاربر' not in pg.locator('.stats').inner_text())
    pg.screenshot(path='/tmp/shots/mgr-stats.png')
    pg.click('[data-t=products]'); pg.wait_for_selector('[data-act=pedit][data-id]:not([data-id=new])')
    ok('محصولات: فقط محصول فروشگاه خودش', pg.locator('.card [data-act=pedit]').count()==1 and 'محصول ویژه‌ی شعبه دوم' in pg.inner_text('#body'))
    pg.screenshot(path='/tmp/shots/mgr-products.png')
    # ساخت محصول جدید: باید خودکار برای فروشگاه خودش ثبت شود
    pg.click('[data-act=pedit][data-id=new]'); pg.wait_for_selector('#f-name')
    ok('فرم محصول جدید: انتخاب فروشگاه نشان داده نمی‌شود', pg.locator('#f-store').count()==0)
    pg.fill('#f-name','محصول ساخته‌شده توسط مدیر شعبه'); pg.fill('#f-brand','X'); pg.fill('#f-price','7000'); pg.click('[data-act=psave]'); time.sleep(1)
    pg.wait_for_selector('.card [data-act=pedit]')
    ok('مدیر شعبه محصول جدید ساخت', pg.locator('.card [data-act=pedit]').count()==2)
    mine=m.get(B+'/api/admin/products').json()['products']; ok('محصول جدید برای فروشگاه خودش ثبت شد', all(x['storeId']==s2 for x in mine) and len(mine)==2)
    # سفارش‌ها
    pg.click('[data-t=orders]'); pg.wait_for_selector('[data-st]')
    ok('سفارش‌ها: فقط سفارش فروشگاه خودش', pg.locator('[data-st]').count()==1)
    pg.screenshot(path='/tmp/shots/mgr-orders.png')
    pg.select_option('[data-st]','prep'); time.sleep(1)
    pg.wait_for_selector('[data-st]')
    ok('مدیر شعبه وضعیت سفارش را عوض کرد', pg.locator('[data-st]').first.input_value()=='prep')
    # --- دسترسی‌های ممنوع (API) ---
    ok('GET کاربران → ۴۰۳', m.get(B+'/api/admin/users').status==403)
    ok('POST فروشگاه → ۴۰۳', m.post(B+'/api/admin/stores',data={'name':'هک','slug':'hack'}).status==403)
    ok('PUT تنظیمات سایت → ۴۰۳', m.put(B+'/api/admin/settings',data={'siteName':'هک'}).status==403)
    ok('محصولات فروشگاه ۱ (?store=1) → ۴۰۳', m.get(B+'/api/admin/products?store=1').status==403)
    ok('ساخت محصول در فروشگاه ۱ → ۴۰۳', m.post(B+'/api/admin/products',data={'storeId':1,'name':'هک','price':1,'animal':'dog','cat':1}).status==403)
    ok('تغییر سفارش فروشگاه ۱ → ۴۰۳/۴۰۴', m.put(B+f'/api/admin/orders/{o1id}',data={'st':'can'}).status in (403,404))
    ok('ارتقای نقش (PUT users) → ۴۰۳', m.put(B+f'/api/admin/users/{mid}',data={'role':'admin'}).status==403)
    me=[u for u in a.get(B+'/api/admin/users').json()['users'] if u['id']==mid][0]; ok('نقش و فروشگاه مدیر بعد از تلاش‌های ممنوع دست‌نخورده ماند', me['role']=='manager' and me['stores']==[s2])
    # --- سناریوی دوم: مدیری که دو فروشگاه دارد ---
    a.put(B+f'/api/admin/users/{mid}',data={'role':'manager','stores':[1,s2]})
    pg.goto(B+'/admin'); pg.wait_for_selector('.tabs'); time.sleep(.6)
    ok('مدیر دو فروشگاه: انتخابگر فروشگاه دیده می‌شود', pg.locator('#storeSel').is_visible() and pg.locator('#storeSel option').count()==3)
    pg.click('[data-t=orders]'); pg.wait_for_selector('[data-st]'); time.sleep(.4)
    ok('مدیر دو فروشگاه: هر دو سفارش را می‌بیند', pg.locator('[data-st]').count()==2)
    pg.select_option('#storeSel',str(s2)); time.sleep(1)
    ok('فیلتر به یک فروشگاه فقط همان سفارش را نشان می‌دهد', pg.locator('[data-st]').count()==1)
    pg.screenshot(path='/tmp/shots/mgr-two-stores.png')
    ok('مدیر دو فروشگاه هنوز به کاربران/تنظیمات دسترسی ندارد', m.get(B+'/api/admin/users').status==403)
    b.close()
finally:
  srv.terminate()
real=[e for e in errs if not any(k in e for k in ['ERR_NAME_NOT_RESOLVED','status of 4','favicon'])]
ok('بدون خطای JS/کنسول', not real)
if real: print(real[:6])
print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
