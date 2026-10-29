"""Browser integration. Start npm start first. Requires Python Playwright + Chromium."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
Path('artifacts').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for width,height,dpr in [(390,844,1),(390,844,2),(1280,800,1),(1280,800,2)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,has_touch=True)
  page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8000/?debug=1');page.wait_for_function('window.__ashen && window.__ashen.state.tick > 2')
  assert page.locator('#status').inner_text()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.locator('#pause').click()
  before=page.evaluate('__ashen.state.commandLog.length')
  page.locator('#move').click()
  pt=page.evaluate('__ashen.screenCell(10,22)');page.locator('#battlefield').tap(position=pt)
  assert page.evaluate('__ashen.state.commandLog.length')==before+1
  page.locator('#battlefield').tap(position=pt)
  assert page.evaluate('__ashen.state.commandLog.length')==before+1, 'second tap accidentally orders'
  page.locator('#hold').click();assert page.evaluate('__ashen.state.squads[0].order')=='hold'
  page.locator('#rally').click();assert page.evaluate('__ashen.state.squads[0].order')=='rally'
  page.locator('#zoom-in').click();page.locator('#zoom-out').click()
  page.locator('#focus-objective').click();page.locator('#focus-squad').click()
  # Real drag and two-pointer touch gesture must not produce orders.
  page.locator('#move').click();n=page.evaluate('__ashen.state.commandLog.length')
  box=page.locator('#battlefield').bounding_box();x=box['x']+80;y=box['y']+120
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+60,y+35,steps=6);page.mouse.up()
  assert page.evaluate('__ashen.state.commandLog.length')==n
  cdp=ctx.new_cdp_session(page)
  for pts in [[{'x':x,'y':y},{'x':x+80,'y':y}],[{'x':x-10,'y':y},{'x':x+100,'y':y}]]:
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart' if pts[0]['x']==x else 'touchMove','touchPoints':[dict(t,id=i) for i,t in enumerate(pts)]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  assert page.evaluate('__ashen.state.commandLog.length')==n
  page.locator('#cancel').click()
  page.locator('#focus-squad').click()
  page.locator('#support').click()
  friendly=page.evaluate('({x:__ashen.state.units[0].x,y:__ashen.state.units[0].y})')
  aim=page.evaluate('(p)=>__ashen.screenCell(p.x,p.y)',friendly)
  page.locator('#battlefield').tap(position=aim)
  assert page.evaluate('__ashen.state.support.A.uses')==1
  assert page.evaluate('__ashen.state.units[0].hp')==85
  page.locator('#low-mode').check()
  page.screenshot(path=f'artifacts/play-{width}-{dpr}.png')
  for b in page.locator('.commands button').all():
   r=b.bounding_box();assert r['height']>=44 and r['width']>=44
  builds=page.evaluate('__ashen.scene.terrain.rebuilds');page.wait_for_timeout(150)
  assert page.evaluate('__ashen.scene.terrain.rebuilds')==builds,'stationary terrain rebuilt'
  page.locator('#low-mode').uncheck()
  page.evaluate('__ashen.finishMatch()');assert page.locator('#result').is_visible()
  page.screenshot(path=f'artifacts/game-{width}-{dpr}.png')
  assert not errors,errors
  print(json.dumps({'viewport':[width,height],'dpr':dpr,'errors':errors,'winner':page.evaluate('__ashen.state.winner')}))
  ctx.close()
 # Focused renderer/input regressions, isolated from match-outcome assertions.
 ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True)
 page=ctx.new_page();page.goto('http://127.0.0.1:8000/?debug=1');page.wait_for_function('window.__ashen && __ashen.state.tick>2');page.locator('#pause').click()
 page.locator('#squad-2').click()
 page.evaluate("""()=>{const w=__ashen.state,u=w.units[0],m=w.map;m.occupancy[u.y*m.width+u.x]=0;u.x=10;u.y=20;u.moveTo=20*m.width+11;u.moveProgress=7;m.occupancy[20*m.width+10]=u.id;m.reservation[u.moveTo]=u.id;__ashen.clock.backlog=0;__ashen.camera.zoom=1.6;__ashen.focus(10.875,20);}""")
 page.wait_for_timeout(60)
 rect=page.locator('#battlefield').bounding_box();page.locator('#battlefield').tap(position={'x':rect['width']/2,'y':rect['height']/2-18*1.6})
 assert page.locator('#squad-1').evaluate("e=>e.classList.contains('active')"),'moving silhouette could not be selected'
 page.evaluate("""()=>{const w=__ashen.state,u=w.units[0],m=w.map;u.moveTo=-1;u.moveProgress=0;m.floorLevel[u.y*m.width+u.x]=0;m.terrainKind[u.y*m.width+u.x]=1;m.revision++;__ashen.clock.backlog=0;__ashen.camera.zoom=1;__ashen.focus(10,20);}""")
 page.wait_for_timeout(60)
 pixel=page.evaluate("""()=>{const c=document.querySelector('#battlefield'),ctx=c.getContext('2d');return Array.from(ctx.getImageData(Math.round(c.width/2),Math.round(c.height/2-4),1,1).data);}""")
 assert pixel[:3]==[81,67,51],f'trench lower silhouette not occluded by soil rim: {pixel}'
 page.screenshot(path='artifacts/trench-occlusion.png');ctx.close()
 browser.close()
