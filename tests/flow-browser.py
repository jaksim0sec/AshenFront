"""Offline deploy -> prepare -> command -> battle integration."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('artifacts/flow');out.mkdir(parents=True,exist_ok=True);reports=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(390,844),(1280,800)]:
  ctx=b.new_context(viewport={'width':width,'height':height},has_touch=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('BASE_URL','http://127.0.0.1:8000')+'/?debug=1');page.wait_for_function('window.__ashen && __ashen.scene.soldiers.loaded')
  assert page.evaluate('__ashen.state.tick')==0;assert page.evaluate('__ashen.matchFlow.preparation.remaining')==40
  page.screenshot(path=str(out/f'deployment-{width}.png'))
  point=page.evaluate('__ashen.screenCell(8,24)');page.locator('#battlefield').tap(position=point)
  assert page.evaluate('__ashen.matchFlow.preparation.remaining')==30
  assert page.evaluate('__ashen.state.units.filter(u=>u.team==="A"&&u.hp>0).length')==10
  page.locator('#auto-deploy').click();assert page.evaluate('__ashen.matchFlow.preparation.remaining')==0
  assert page.evaluate('document.body.dataset.playMode')=='control';assert page.locator('.squad-card').count()==4
  page.locator('#squad-1').click();assert page.locator('#command-dock').is_visible()
  page.locator('#formation-toggle').click();page.locator('[data-formation=spread]').click();assert page.evaluate('__ashen.state.squads[0].formation')=='spread'
  page.wait_for_timeout(80);assert page.evaluate('__ashen.state.tick')==0
  page.locator('#start-battle').click();page.wait_for_function('__ashen.state.tick>1');page.locator('#pause').click()
  assert page.evaluate('__ashen.matchFlow.phase')=='battle';assert page.locator('#start-battle').is_hidden()
  page.locator('#orders-toggle').click();assert page.locator('#primary-orders').is_hidden();page.locator('#orders-toggle').click()
  page.locator('#tools-toggle').click();page.locator('#support').click();assert page.locator('#game-tools').is_hidden()
  a=page.evaluate('({x:__ashen.state.units[0].x,y:__ashen.state.units[0].y})');page.evaluate('(a)=>__ashen.focus(a.x,a.y)',a);point=page.evaluate('(a)=>__ashen.screenCell(a.x,a.y)',a);page.locator('#battlefield').tap(position=point);assert page.evaluate('__ashen.state.support.A.uses')==1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
  page.screenshot(path=str(out/f'command-{width}.png'));reports.append({'viewport':[width,height],'deployment':True,'noCombatDuringPreparation':True,'formationBeforeBattle':True,'battleStart':True,'contextDock':True,'artillery':True,'pageErrors':errors});ctx.close()
 b.close()
(out/'browser.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
