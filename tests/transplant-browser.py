"""Integrated FlowerWars-style offline command UI; uses only current AshenFront assets/rules."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('BASE_URL','http://127.0.0.1:8000');out=Path('artifacts/transplant');out.mkdir(parents=True,exist_ok=True);reports=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for width,height in [(390,844),(1280,800)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'/?debug=1');page.wait_for_function('window.__ashen && __ashen.scene.soldiers.loaded');page.locator('#pause').click();page.locator('#select-squad').click()
  assert page.locator('.squad-card').count()==4
  page.locator('#multi-select').click();page.locator('#squad-2').click();assert page.evaluate('__ashen.selection.length')==2
  page.locator('[data-formation=column]').click();assert page.evaluate('__ashen.selection.every(id=>__ashen.state.squads[id-1].formation==="column")')
  page.locator('#move').click();page.evaluate('__ashen.focus(14,21)');pt=page.evaluate('__ashen.screenCell(14,21)');page.locator('#battlefield').tap(position=pt);assert page.evaluate('new Set(__ashen.selection.map(id=>__ashen.state.squads[id-1].goal)).size')==2
  assert page.locator('#command-feedback').is_visible()
  page.locator('#hold').click();assert page.evaluate('__ashen.selection.every(id=>__ashen.state.squads[id-1].order==="hold")')
  page.locator('#flank').click();page.evaluate('__ashen.focus(20,25)');pt=page.evaluate('__ashen.screenCell(20,25)');page.locator('#battlefield').tap(position=pt);assert page.evaluate('__ashen.selection.every(id=>__ashen.state.squads[id-1].order==="flank" && __ashen.state.squads[id-1].waypoints.length>0)')
  page.locator('#hold').click();assert page.evaluate('__ashen.selection.every(id=>__ashen.state.squads[id-1].waypoints.length===0)')
  page.evaluate('__ashen.step(100)');assert page.evaluate('__ashen.state.metrics.navPeak<=2048')
  page.locator('#select-squad').click();page.screenshot(path=str(out/f'commands-{width}.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Collapse/expand and grouped platoon selection preserve a real command target set.
  if not page.locator('#roster-panel').is_visible():page.locator('#select-squad').click()
  page.locator('.platoon-heading button').first.click();assert page.evaluate('JSON.stringify(__ashen.selection)')=='[1,2]'
  target=page.evaluate("""()=>{const w=__ashen.state,a=w.units[0],u=w.units.find(u=>u.team==='B');w.botTeams=[];w.combat=false;if(u.moveTo>=0&&w.map.reservation[u.moveTo]===u.id)w.map.reservation[u.moveTo]=0;if(w.map.occupancy[u.y*w.map.width+u.x]===u.id)w.map.occupancy[u.y*w.map.width+u.x]=0;u.x=a.x+5;u.y=a.y;u.hp=100;u.moveTo=-1;u.moveProgress=0;w.map.occupancy[u.y*w.map.width+u.x]=u.id;w.squads[u.squadId-1].order='hold';w.squads[u.squadId-1].goal=null;w.spatialRevision++;__ashen.selectSquads([1]);__ashen.step(5);__ashen.focus(a.x+2.5,a.y);return {id:u.id,x:u.x,y:u.y};}""")
  page.locator('#attack').click();pt=page.evaluate('(u)=>{const p=__ashen.screenCell(u.x,u.y);p.y-=32*__ashen.camera.zoom;return p}',target);page.locator('#battlefield').tap(position=pt)
  assert page.evaluate('(id)=>__ashen.state.squads[0].order==="attack"&&__ashen.state.squads[0].targetUnitId===id',target['id']), (target,pt,page.evaluate('({selected:__ashen.selection,visible:[...__ashen.visible.keys()],s:__ashen.state.squads[0],status:document.querySelector("#status").textContent})'))
  assert not errors,errors
  reports.append({'viewport':[width,height],'cards':4,'multipleSelection':True,'formation':True,'groupAnchors':True,'flankAndCancel':True,'navBudget':True,'visibleTargetAttack':True,'pageErrors':errors});ctx.close()
 browser.close()
(out/'browser.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
