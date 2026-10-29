import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
Path('artifacts/infra').mkdir(exist_ok=True,parents=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for width,height,dpr in [(390,844,1),(390,844,2),(1280,800,1),(1280,800,2)]:
  c=b.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,has_touch=True);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8000/?debug=1');page.wait_for_function('window.__ashen && __ashen.state.tick>2');page.locator('#pause').click()
  events=[]
  for x,y,zoom in [(25,24,.3),(17,24,1.6),(30,7,1.0)]:
   page.evaluate('(p)=>{__ashen.camera.zoom=p.zoom;__ashen.focus(p.x,p.y);}',{'x':x,'y':y,'zoom':zoom});page.wait_for_timeout(60)
   page.locator('#move').click();pt=page.evaluate('(p)=>__ashen.screenCell(p.x,p.y)',{'x':x,'y':y});page.locator('#battlefield').tap(position=pt)
   order=page.evaluate('window.lastResolvedOrder');assert order['target']==y*64+x,order
   s=page.evaluate('JSON.parse(JSON.stringify(__ashen.state.squads[0]))');assert s['orderId']==order['orderId'];assert s['targetElevation']==order['elevation'];assert len(set(s['slots'].values()))==len(s['slots']);events.append(order)
  page.screenshot(path=f'artifacts/infra/commands-{width}-{dpr}.png');assert not errors,errors
  print(json.dumps({'width':width,'dpr':dpr,'orders':events,'errors':errors}));c.close()
 b.close()
