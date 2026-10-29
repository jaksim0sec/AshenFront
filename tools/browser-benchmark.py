"""Cloud headless Chromium measurements. No physical-device performance claim."""
import json, os, platform
from pathlib import Path
from playwright.sync_api import sync_playwright
Path('artifacts').mkdir(exist_ok=True)
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 version=browser.version
 for size in [64,128,256]:
  for low,zoom in [(False,.3),(False,1.0),(True,.3)]:
   ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True)
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:8000/?debug=1');page.wait_for_function('window.__ashen')
   page.evaluate('(s)=>__ashen.loadFixture(s)',size)
   # Advance the real simulation to the approach/fighting phase before profiling.
   page.evaluate('''()=>{let guard=0;while(__ashen.state.metrics.shots<30 && !__ashen.state.winner && guard++<40)__ashen.step(100);}''')
   page.evaluate('(z)=>__ashen.camera.zoom=z',zoom)
   page.evaluate('''()=>{const e=__ashen.state.events.findLast(e=>e.kind==='shot');if(e)__ashen.focus(e.x,e.y);}''')
   if low:
    page.locator('#select-squad').click();page.locator('#low-mode').check();page.evaluate("()=>{const e=__ashen.state.events.findLast(e=>e.kind==='shot');if(e)__ashen.focus(e.x,e.y);}")
   page.evaluate("""()=>{let id=null;window.__profileFollow=setInterval(()=>{const w=__ashen.state;let u=w.units.find(u=>u.id===id&&u.hp>0);if(!u){const e=w.events.findLast(e=>e.kind==='shot'&&e.team==='A');const alive=w.units.filter(u=>u.hp>0&&u.team==='A');alive.sort((a,b)=>e?Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y):a.id-b.id);u=alive[0];id=u?.id;}if(u)__ashen.focus(u.x,u.y);},100);}""")
   page.wait_for_timeout(1200)
   page.evaluate('__ashen.resetStats()')
   start=page.evaluate('performance.now()');tick0=page.evaluate('__ashen.state.tick')
   page.wait_for_timeout(4000)
   stats=page.evaluate('__ashen.stats()');end=page.evaluate('performance.now()');tick1=page.evaluate('__ashen.state.tick')
   stats['longTasks']=[v for v in stats['longTasks'] if v['start']>=start]
   results.append({'map':size,'initialActors':80 if size==64 else 180 if size==128 else 360,'liveActors':page.evaluate('__ashen.state.units.filter(u=>u.hp>0).length'),'viewport':[390,844],'dpr':2,'zoom':zoom,'low':low,'sampleMs':end-start,'simTicksDuringSample':tick1-tick0,'stats':stats,'pageErrors':errors})
   page.screenshot(path=f'artifacts/profile-{size}-{zoom}-{low}.png')
   assert not errors,errors
   assert stats['rendered']>0, 'empty viewport is not a fighting benchmark'
   print(json.dumps(results[-1]),flush=True);ctx.close()
 browser.close()
Path('artifacts/browser-benchmark.json').write_text(json.dumps({'browser':version,'host':platform.platform(),'note':'Headless Chromium mobile viewport on cloud CPU. No CPU throttling; not physical Android. Each sample 4 wall seconds after warmup, camera follows a living friendly shooter; debug fixture load/fast-forward excluded from long-task window.','results':results},indent=2))
