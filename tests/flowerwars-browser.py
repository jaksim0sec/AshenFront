"""Exercise the transplanted FlowerWars simulation in actual Chromium."""
import os,shutil,subprocess,time,json
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('artifacts/flowerwars');out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','tools/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
reports=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
  for width,height in [(390,844),(1280,800)]:
   context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,has_touch=True)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:8000/',wait_until='domcontentloaded',timeout=15000)
   page.wait_for_function('window.__ashenFlower && window.__ashenFlower.match',timeout=15000)
   assert page.evaluate('__ashenFlower.match.phase')=='preparation'
   page.wait_for_timeout(250)
   assert not errors, 'preparation canvas error: '+repr(errors)
   assert page.evaluate('__ashenFlower.match.counts.A')==0
   page.locator('#auto-deploy').click(timeout=10000)
   assert page.evaluate('__ashenFlower.match.counts.A')==40
   assert page.locator('.squad-card').count()==4
   assert page.locator('.squad-card .squad-kind').count()==4
   assert page.locator('.squad-card .squad-activity').count()==4
   assert page.locator('.squad-card .commander-photo').count()==4
   assert all('소총보병' in text for text in page.locator('.squad-kind').all_text_contents())
   page.evaluate("window.__rosterCardNode=document.querySelector('.squad-card')")
   page.wait_for_timeout(950)
   assert page.evaluate("window.__rosterCardNode===document.querySelector('.squad-card')"),'roster DOM must be stable'
   page.screenshot(path=str(out/f'deployment-{width}.png'))
   page.locator('#start-battle').click(timeout=10000)
   page.wait_for_function('__ashenFlower.match.phase==="battle"',timeout=10000)
   page.wait_for_function('__ashenFlower.flagsLoaded',timeout=12000)
   assert page.evaluate("document.querySelectorAll('#faction-ribbon img').length")==2
   assert page.evaluate("Array.from(document.querySelectorAll('#faction-ribbon img')).every(img=>img.complete && img.naturalWidth>0)")
   assert page.evaluate('__ashenFlower.match.counts.B')==40
   assert page.locator('.squad-card').count()==4
   await_s=page.evaluate('({n:__ashenFlower.board.units.length,squads:__ashenFlower.match.squadIds.A.length})')
   assert await_s['n']==80,await_s
   assert page.locator('#command-dock').is_visible()
   assert page.locator('#roster-panel').is_visible()
   positions=page.evaluate("""()=>({
    roster:document.querySelector('#roster-panel').getBoundingClientRect().toJSON(),
    dock:document.querySelector('#command-dock').getBoundingClientRect().toJSON(),
    viewport:{width:innerWidth,height:innerHeight}
   })""")
   assert positions['roster']['y']>height*.72,positions
   assert positions['roster']['width']>width*.9,positions
   assert positions['dock']['y']+positions['dock']['height']<=positions['roster']['y']+12,positions
   # Verify the original source command overlay actually draws a move label on Canvas.
   move=page.evaluate("""()=>{
     const ctx=document.querySelector('#battlefield').getContext('2d');
     window.__seenMoveLabel=false;
     const original=ctx.fillText.bind(ctx);
     ctx.fillText=function(value,...args){if(value==='이동')window.__seenMoveLabel=true;return original(value,...args);};
     const id=__ashenFlower.match.squadIds.A[0],board=__ashenFlower.board;
     const result=__ashenFlower.order([id],'advance',{x:Math.floor(board.width*.4),y:Math.floor(board.height*.5)});
     return {accepted:result.accepted.length};
   }""")
   assert move['accepted']==1,move
   page.wait_for_function('window.__seenMoveLabel',timeout=8000)
   assert '소총보병' in page.locator('.squad-kind').first.text_content()
   page.wait_for_timeout(1150)
   metrics=page.evaluate('__ashenFlower.renderStats')
   assert metrics['frames']>2,metrics
   assert metrics['terrainRebuilds']>0,metrics
   reports.append({'viewport':[width,height],'perf':metrics})
   assert not errors,errors
   page.screenshot(path=str(out/f'battle-{width}.png'))
   reports[-1].update({'player':40,'enemy':40,'squads':4,'pageErrors':errors})
   context.close()
  browser.close()
 print(json.dumps(reports,ensure_ascii=False))
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill()
