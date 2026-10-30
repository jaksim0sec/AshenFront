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
   # Bot predeployment must not lock player army-size choice.
   page.evaluate('window.__ashenFlower.match.deployBot()')
   page.wait_for_function("document.querySelector('#army-size').disabled===false",timeout=3000)
   assert page.evaluate('__ashenFlower.match.counts.B')>=10
   page.locator('#army-size').select_option('100')
   page.wait_for_function('__ashenFlower.armySize===100',timeout=3000)
   assert page.evaluate('__ashenFlower.match.counts.A')==0
   page.locator('#army-size').select_option('40')
   page.wait_for_function('__ashenFlower.armySize===40',timeout=3000)
   assert not page.locator('#army-size').is_disabled()
   page.locator('#auto-deploy').click(timeout=10000)
   assert page.evaluate('__ashenFlower.match.counts.A')==40
   # Changing the choice after deployment intentionally creates a fresh preparation.
   page.locator('#army-size').select_option('100')
   page.wait_for_function('__ashenFlower.armySize===100 && __ashenFlower.match.counts.A===0',timeout=3000)
   page.locator('#army-size').select_option('40')
   page.wait_for_function('__ashenFlower.armySize===40',timeout=3000)
   page.locator('#auto-deploy').click(timeout=10000)
   assert page.evaluate('__ashenFlower.match.counts.A')==40
   assert page.locator('.squad-card').count()==4
   assert page.locator('.squad-card .squad-kind').count()==4
   assert page.locator('.squad-card .squad-activity').count()==4
   assert page.locator('.squad-card .commander-photo').count()==4
   # An actual painted face/hat at high resolution, not a tiny reused world sprite.
   page.wait_for_function("""()=>{const c=document.querySelector('.commander-photo');if(!c||c.width<240)return false;
     const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     let painted=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>80)painted++;
     return painted>1000;
   }""",timeout=15000)
   portrait=page.locator('.commander-photo').first.evaluate("""c=>{
     const {width,height}=c,p=c.getContext('2d').getImageData(0,0,width,height).data;
     let minY=height,maxY=0,minX=width,maxX=0,count=0;
     for(let y=0;y<height;y++)for(let x=0;x<width;x++){
       if(p[(y*width+x)*4+3]<80)continue;
       count++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);
       minX=Math.min(minX,x);maxX=Math.max(maxX,x);
     }
     return {width,height,minX,maxX,minY,maxY,count};
   }""")
   assert portrait['width']==240 and portrait['height']==240,portrait
   assert portrait['maxY']-portrait['minY']>=150,portrait
   assert portrait['minY']<50 and portrait['count']>1000,portrait
   card=page.locator('.squad-card').first
   metrics=card.evaluate("""el=>({
    width:el.getBoundingClientRect().width,
    height:el.getBoundingClientRect().height,
    color:getComputedStyle(el).color,
    background:getComputedStyle(el).backgroundImage,
    portrait:el.querySelector('.commander-photo').getBoundingClientRect().width
   })""")
   assert metrics['width']<=205 and metrics['height']<=90,metrics
   assert metrics['portrait']<metrics['width']*.55,metrics
   assert 'linear-gradient' in metrics['background'],metrics
   assert page.locator('#army-size').input_value()=='40'
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
   # Experienced units adopt the braced resting pose without a new game phase.
   stage=page.evaluate("""()=>{
     const u=__ashenFlower.board.units.find(u=>u.team==='A' && u.state==='idle');
     if(!u)return null;u.hasEngaged=true;return u.id;
   }""")
   if stage is not None:
    page.wait_for_function("""id=>{
      const u=__ashenFlower.board.unit(id);return u?._visualStance?.crouch>.45;
    }""",arg=stage,timeout=10000)
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
   assert metrics['spriteCache']['cachedFrames']>4,'small armies should animate rather than use only static distant sprites'
   assert metrics['terrainRebuilds']>0,metrics
   reports.append({'viewport':[width,height],'perf':metrics})
   assert not errors,errors
   page.screenshot(path=str(out/f'battle-{width}.png'))
   reports[-1].update({'player':40,'enemy':40,'squads':4,'pageErrors':errors})
   context.close()
  # Full-size renderer stress: 35 squads each, 700 live soldiers.
  stress=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True)
  stage=stress.new_page();stage_errors=[]
  stage.on('pageerror',lambda e:stage_errors.append(str(e)))
  stage.goto('http://127.0.0.1:8000/?army=350',wait_until='domcontentloaded',timeout=20000)
  stage.wait_for_function('window.__ashenFlower && __ashenFlower.armySize===350',timeout=15000)
  assert stage.locator('#army-size').input_value()=='350'
  stage.locator('#auto-deploy').click(timeout=30000)
  stage.wait_for_function('__ashenFlower.match.counts.A===350',timeout=30000)
  assert stage.locator('.squad-card').count()==35
  stage.locator('#start-battle').click(timeout=30000)
  stage.wait_for_function('__ashenFlower.match.counts.B===350 && __ashenFlower.match.phase==="battle"',timeout=30000)
  stage.wait_for_timeout(2500)
  stress_metrics=stage.evaluate('__ashenFlower.renderStats')
  assert stress_metrics['frames']>5,stress_metrics
  assert not stage_errors,stage_errors
  assert stage.evaluate('__ashenFlower.board.units.length')==700
  stage.screenshot(path=str(out/'battle-700-mobile.png'))
  reports.append({'viewport':[390,844],'army':700,'perf':stress_metrics,'pageErrors':stage_errors})
  stress.close()
  browser.close()
 print(json.dumps(reports,ensure_ascii=False))
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill()
