import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
Path('artifacts/infra').mkdir(exist_ok=True,parents=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for width,height,dpr in [(390,844,1),(390,844,2),(1280,800,1),(1280,800,2)]:
  c=b.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,has_touch=True);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8000/?debug=1');page.wait_for_function('window.__ashen && __ashen.state.tick>2');page.locator('#pause').click()
  unobstructed=page.evaluate('''()=>{let area=0;for(const selector of ['header','#objective','#view-controls','#select-squad','#toggle-map']){const r=document.querySelector(selector).getBoundingClientRect();area+=r.width*r.height;}return 1-area/(innerWidth*innerHeight);}''')
  assert unobstructed>=.85,unobstructed
  assert not page.locator('#overview').is_visible()
  page.screenshot(path=f'artifacts/infra/after-{width}-{dpr}.png')
  page.locator('#select-squad').click()
  events=[]
  for x,y,zoom in [(25,24,.3),(17,24,1.6),(30,7,1.0)]:
   page.evaluate('(p)=>{__ashen.camera.zoom=p.zoom;__ashen.focus(p.x,p.y);}',{'x':x,'y':y,'zoom':zoom});page.wait_for_timeout(60)
   page.locator('#move').click();pt=page.evaluate('(p)=>__ashen.screenCell(p.x,p.y)',{'x':x,'y':y});page.locator('#battlefield').tap(position=pt)
   order=page.evaluate('window.lastResolvedOrder');assert order['target']==y*64+x,order
   s=page.evaluate('JSON.parse(JSON.stringify(__ashen.state.squads[0]))');assert s['orderId']==order['orderId'];assert s['targetElevation']==order['elevation'];assert len(set(s['slots'].values()))==len(s['slots']);events.append(order)
  page.wait_for_timeout(60);cache=page.evaluate('__ashen.scene.terrain.rebuilds');page.evaluate('__ashen.camera.x+=20');page.wait_for_timeout(60);assert page.evaluate('__ashen.scene.terrain.rebuilds')==cache,'small pan rebuilt cache'
  assert page.evaluate('''()=>{const s=__ashen.scene,t=s.terrain,n=t.rebuilds;t.draw(s.canvas.getContext('2d'),{...__ashen.state.map},__ashen.camera,s.width,s.height);return t.rebuilds===n+1;}'''),'new map reused old terrain cache'
  page.screenshot(path=f'artifacts/infra/commands-{width}-{dpr}.png');assert not errors,errors
  print(json.dumps({'width':width,'dpr':dpr,'orders':events,'errors':errors,'unobstructed':unobstructed,'smallPanCache':'reused'}));c.close()
 b.close()
