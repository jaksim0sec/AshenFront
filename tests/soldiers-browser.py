"""Actual PNG assembly, editor data round trips, touch editing and live game integration."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
IMAGE_COUNT=len(json.loads(Path('assets/soldiers/manifest.json').read_text())['assets'])+1
BASE=os.environ.get('BASE_URL','http://127.0.0.1:8010');out=Path('artifacts/soldiers');out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for w,h,dpr in [(1400,1000,1),(390,844,2)]:
  context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr,has_touch=True,accept_downloads=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/soldier-workshop.html');page.wait_for_function('window.__soldierWorkshop && __soldierWorkshop.ready && __soldierWorkshop.pose')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert page.evaluate('__soldierWorkshop.renderer.images.size')==IMAGE_COUNT
  assert page.locator('#error').inner_text()==''
  # Save several exact phase samples for direct visual inspection; image content must change.
  hashes=[]
  for state,t in [('idle',.1),('walk',.15),('shoot',.025),('shoot',.32),('hit',.1),('death',.65)]:
   page.evaluate('(a)=>__soldierWorkshop.sample(a[0],a[1])',[state,t]);page.wait_for_timeout(35)
   hashes.append(page.locator('#stage').evaluate('c=>c.toDataURL()'))
   page.locator('#stage').screenshot(path=str(out/f'{w}-{state}-{t}.png'))
  assert len(set(hashes))==6,'animation states did not change the rendered assembly'
  page.select_option('#nation','velian');page.select_option('#rank','captain');page.select_option('#part','hat');page.evaluate("__soldierWorkshop.sample('idle',0)")
  old=page.evaluate('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x')
  page.locator('#field-x').fill('9');page.locator('#field-x').dispatch_event('change');page.wait_for_function('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x===9')
  assert page.evaluate('__soldierWorkshop.catalog.profiles["arken:captain"].parts.hat.x')==old
  with page.expect_download() as e:page.locator('#export-all').click()
  saved=out/f'export-{w}.json';e.value.save_as(saved);data=json.loads(saved.read_text());assert len(data['profiles'])==16;assert data['profiles']['velian:captain']['parts']['hat']['x']==9
  page.locator('#undo').click();assert page.evaluate('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x')==old
  page.locator('#redo').click();assert page.evaluate('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x')==9
  page.locator('#field-x').fill('18');page.locator('#field-x').dispatch_event('change');page.locator('#import').set_input_files(str(saved));page.wait_for_function('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x===9')
  malicious=json.loads(saved.read_text());malicious['profiles']['velian:captain']['parts']['hat']['asset']='https://invalid.example/a.png';bad=out/f'bad-{w}.json';bad.write_text(json.dumps(malicious));page.locator('#import').set_input_files(str(bad));page.wait_for_function('document.querySelector("#error").textContent.length>0');assert page.evaluate('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x')==9
  page.locator('#import').set_input_files(str(saved));page.wait_for_function('document.querySelector("#error").textContent.length===0')
  # Same storage data is consumed by the real battle, without changing combat state.
  game=context.new_page();game.on('pageerror',lambda e:errors.append(str(e)));game.goto(BASE+'/?debug=1');game.wait_for_function('window.__ashen && __ashen.scene.soldiers.loaded')
  assert game.evaluate('__ashen.scene.soldiers.catalog.profiles["velian:captain"].parts.hat.x')==9
  page.locator('#field-x').fill('12');page.locator('#field-x').dispatch_event('change');game.wait_for_function('__ashen.scene.soldiers.catalog.profiles["velian:captain"].parts.hat.x===12')
  # Touch drag the visible hat; movement is converted from screen space into rig space.
  page.locator('#stage').scroll_into_view_if_needed();page.wait_for_timeout(50)
  pos=page.evaluate('''()=>{const d=__soldierWorkshop.pose.draws.find(d=>d.part==='hat'),m=d.matrix,x=d.w*.5,y=d.h*.4,v=__soldierWorkshop.view(),r=document.querySelector('#stage').getBoundingClientRect();return {x:r.left+v.x+(m[0]*x+m[2]*y+m[4])*v.scale,y:r.top+v.y+(m[1]*x+m[3]*y+m[5])*v.scale};}''')
  session=context.new_cdp_session(page)
  for typ,dx in [('touchStart',0),('touchMove',16)]:session.send('Input.dispatchTouchEvent',{'type':typ,'touchPoints':[{'id':0,'x':pos['x']+dx,'y':pos['y']}]})
  session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  assert page.evaluate('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x')>12
  page.evaluate('__soldierWorkshop.save()');x=page.evaluate('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x');page.reload();page.wait_for_function('window.__soldierWorkshop && __soldierWorkshop.pose');assert page.evaluate('__soldierWorkshop.profileId')=='velian:captain';assert page.evaluate('__soldierWorkshop.catalog.profiles["velian:captain"].parts.hat.x')==x
  page.locator('#stage').screenshot(path=str(out/f'editor-final-{w}.png'))
  game.locator('#pause').click();game.evaluate("__ashen.camera.zoom=1;__ashen.focus(6,18)");game.wait_for_timeout(60);game.screenshot(path=str(out/f'battle-parts-{w}.png'))
  # A moving actor's tracer begins at its rendered rifle, not its source cell.
  checksum_before=game.evaluate('__ashen.step(0)')
  game.evaluate('''()=>{const w=__ashen.state,u=w.units[0];window.__oldMove=[u.moveTo,u.moveProgress];u.moveTo=u.y*w.map.width+u.x+1;u.moveProgress=7;__ashen.scene.eventTick=-1;w.events.push({kind:'shot',unitId:u.id,eventId:99991,x:u.x,y:u.y,tx:u.x+5,ty:u.y,team:u.team,hit:false,tick:w.tick});}''')
  game.wait_for_function('__ashen.scene.muzzles.has(99991)')
  assert game.evaluate('''()=>{const scene=__ashen.scene,f=scene.actorFrames.get(1),m=scene.soldiers.muzzle('A',f.rank,f.animation,false),actual=scene.muzzles.get(99991);return Math.hypot(actual.x-f.foot.x-m.x,actual.y-f.foot.y-m.y)<1e-6;}''')
  game.evaluate('''()=>{const w=__ashen.state,u=w.units[0];[u.moveTo,u.moveProgress]=__oldMove;w.events=w.events.filter(e=>e.eventId!==99991);}''')
  assert game.evaluate('__ashen.step(0)')==checksum_before,'rendering changed authoritative game state'
  # Cached death frames use full transformed bounds, including larger edited hats.
  assert game.evaluate('''async()=>{const {poseCharacter,poseBounds}=await import('/src/characters/animation.mjs'),{sampleAnimation}=await import('/src/characters/renderer.mjs');const r=__ashen.scene.soldiers,c=structuredClone(r.catalog);c.profiles['arken:captain'].parts.hat.x=300;c.profiles['arken:captain'].parts.hat.w=240;r.setCatalog(c);const options={state:'death',time:.65,facing:1};r.draw(__ashen.scene.canvas.getContext('2d'),'A','captain',options);const frame=[...r.cache.values()].at(-1),b=poseBounds(poseCharacter(r.catalog.profiles['arken:captain'],sampleAnimation(options)));return JSON.stringify(frame.bounds)===JSON.stringify(b)&&frame.bitmap.width<=384&&frame.bitmap.height<=384;}''')
  game.evaluate('__ashen.step(180)');assert game.evaluate('__ashen.scene.soldiers.stats.cachedFrames')<=256
  assert game.evaluate('__ashen.scene.soldiers.stats.cacheBytes')<=16*1024*1024
  reports.append({'viewport':[w,h],'dpr':dpr,'images':IMAGE_COUNT,'profiles':16,'animationStates':6,'roundTrip':'passed','touchDrag':'passed','liveGameUpdates':'passed','pageErrors':errors});assert not errors,errors;context.close()
 browser.close()
(out/'browser-results.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
