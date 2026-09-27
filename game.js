(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const ui = {
    hud: document.getElementById('hud'), score: document.getElementById('scoreValue'), combo: document.getElementById('comboValue'),
    wave: document.getElementById('waveValue'), waveStatus: document.getElementById('waveStatus'),
    shieldBar: document.getElementById('shieldBar'), shieldText: document.getElementById('shieldText'),
    hullBar: document.getElementById('hullBar'), hullText: document.getElementById('hullText'),
    soundButton: document.getElementById('soundButton'), soundIcon: document.getElementById('soundIcon'), pauseButton: document.getElementById('pauseButton'),
    menu: document.getElementById('menuScreen'), how: document.getElementById('howScreen'), pause: document.getElementById('pauseScreen'), gameOver: document.getElementById('gameOverScreen'),
    start: document.getElementById('startButton'), howButton: document.getElementById('howButton'), closeHow: document.getElementById('closeHowButton'), manualLaunch: document.getElementById('manualLaunchButton'),
    resume: document.getElementById('resumeButton'), quit: document.getElementById('quitButton'), restart: document.getElementById('restartButton'), menuButton: document.getElementById('menuButton'),
    bestScore: document.getElementById('bestScore'), bestWave: document.getElementById('bestWave'),
    finalScore: document.getElementById('finalScore'), finalWave: document.getElementById('finalWave'), finalKills: document.getElementById('finalKills'), finalCombo: document.getElementById('finalCombo'),
    toast: document.getElementById('missionToast'), toastEyebrow: document.getElementById('toastEyebrow'), toastTitle: document.getElementById('toastTitle'), toastSubtitle: document.getElementById('toastSubtitle'),
    mobileFire: document.getElementById('mobileFire'), mobileControls: document.getElementById('mobileControls')
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const chance = n => Math.random() < n;
  const pad = (num, size = 6) => String(Math.max(0, Math.floor(num))).padStart(size, '0');
  const distSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  let width = 0, height = 0, dpr = 1, lastTime = performance.now(), state = 'menu', screenShake = 0, flash = 0, elapsed = 0, waveDelay = 0, toastTimer = null;
  const keys = Object.create(null);
  const pointer = { active: false, x: 0, y: 0, fire: false, id: null };

  const game = {
    score: 0, wave: 1, kills: 0, maxCombo: 1, combo: 1, comboTimer: 0, spawnTimer: 0, enemiesToSpawn: 0, waveActive: false, bossWave: false,
    bestScore: Number(localStorage.getItem('nebula_best_score') || 0), bestWave: Number(localStorage.getItem('nebula_best_wave') || 1)
  };

  const player = {
    x: 0, y: 0, vx: 0, vy: 0, radius: 17, speed: 430, fireCooldown: 0, fireRate: 0.16, rapidTimer: 0,
    shield: 100, hull: 100, invuln: 0, damageCooldown: 0, enginePulse: 0
  };

  const bullets = [], enemyBullets = [], enemies = [], particles = [], powerups = [], stars = [], ambientDust = [];

  class AudioEngine {
    constructor() {
      this.ctx = null; this.master = null; this.music = null; this.sfx = null; this.noise = null;
      this.muted = localStorage.getItem('nebula_muted') === '1'; this.musicTimer = null; this.step = 0; this.musicActive = false;
    }
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72; this.music.gain.value = 0.22; this.sfx.gain.value = 0.72;
      this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.45, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    tone(freq, duration, volume, type = 'sine', target = this.sfx, endFreq = null, delay = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + delay, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(Math.max(20, freq), t);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(.018, duration * .2)); gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain); gain.connect(target || this.sfx); osc.start(t); osc.stop(t + duration + .03);
    }
    laser() { this.tone(760, .09, .06, 'square', this.sfx, 210); this.tone(1240, .055, .022, 'sine', this.sfx, 520, .012); }
    enemyLaser() { this.tone(210, .12, .03, 'sawtooth', this.sfx, 105); }
    explosion(big = false) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime, src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
      src.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.setValueAtTime(big ? 950 : 1400, t); filter.frequency.exponentialRampToValueAtTime(90, t + (big ? .5 : .26));
      gain.gain.setValueAtTime(big ? .18 : .09, t); gain.gain.exponentialRampToValueAtTime(.0001, t + (big ? .52 : .28));
      src.connect(filter); filter.connect(gain); gain.connect(this.sfx); src.start(t); src.stop(t + (big ? .56 : .32));
      this.tone(big ? 75 : 120, big ? .42 : .22, big ? .13 : .06, 'sine', this.sfx, 38);
    }
    hit() { this.tone(145, .09, .045, 'square', this.sfx, 65); }
    pickup() { this.tone(520, .11, .04, 'sine', this.sfx, 880); this.tone(780, .14, .035, 'triangle', this.sfx, 1260, .07); }
    ui() { this.tone(510, .065, .025, 'sine', this.sfx, 730); }
    bossAlert() { this.tone(92, .4, .08, 'sawtooth', this.sfx, 52); this.tone(132, .48, .055, 'square', this.sfx, 70, .18); }
    setMusicActive(active) {
      this.musicActive = active; if (!this.ctx) return; if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null; if (!active || this.muted) return;
      this.step = 0; const sequence = [55,55,82.41,55,73.42,55,98,82.41,55,65.41,82.41,55,73.42,49,55,82.41];
      const tick = () => {
        if (!this.musicActive || this.muted || state !== 'running') return;
        const root = sequence[this.step % sequence.length]; this.tone(root, .32, .032, 'triangle', this.music, root * .98);
        if (this.step % 4 === 0) this.tone(root * 2, .16, .012, 'sine', this.music, root * 2.04, .02);
        if (this.step % 8 === 6) this.tone(330, .05, .007, 'square', this.music, 220, .08); this.step++;
      };
      tick(); this.musicTimer = setInterval(tick, 360);
    }
    toggle() {
      this.init(); this.muted = !this.muted; localStorage.setItem('nebula_muted', this.muted ? '1' : '0');
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : .72, this.ctx.currentTime, .025);
      this.setMusicActive(!this.muted && state === 'running'); updateSoundIcon();
    }
  }
  const audio = new AudioEngine();

  function updateSoundIcon() { ui.soundIcon.textContent = audio.muted ? '×' : '♪'; ui.soundButton.setAttribute('aria-label', audio.muted ? 'Enable sound' : 'Mute sound'); }

  function resize() {
    width = window.innerWidth; height = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state === 'menu') { player.x = width * .5; player.y = height * .78; }
    else { player.x = clamp(player.x, 35, width - 35); player.y = clamp(player.y, height * .42, height - 40); }
    seedStars();
  }

  function seedStars() {
    stars.length = 0; ambientDust.length = 0; const count = Math.min(240, Math.floor((width * height) / 6000));
    for (let i = 0; i < count; i++) stars.push({x:Math.random()*width,y:Math.random()*height,z:Math.random(),size:rand(.35,1.55),twinkle:rand(0,Math.PI*2)});
    for (let i = 0; i < 24; i++) ambientDust.push({x:Math.random()*width,y:Math.random()*height,r:rand(18,70),a:rand(.01,.035)});
  }

  function resetPlayer() {
    Object.assign(player,{x:width/2,y:height*.82,vx:0,vy:0,fireCooldown:0,fireRate:.16,rapidTimer:0,shield:100,hull:100,invuln:1.1,damageCooldown:0,enginePulse:0});
  }
  function resetGame() {
    bullets.length=enemyBullets.length=enemies.length=particles.length=powerups.length=0;
    Object.assign(game,{score:0,wave:1,kills:0,maxCombo:1,combo:1,comboTimer:0,spawnTimer:.7,enemiesToSpawn:0,waveActive:false,bossWave:false});
    waveDelay=.5; resetPlayer(); updateHud(true);
  }
  function startGame() {
    audio.init(); audio.ui(); state='running'; resetGame(); hideAllScreens(); ui.hud.classList.remove('hud--hidden'); ui.mobileControls.setAttribute('aria-hidden','false'); beginWave(); audio.setMusicActive(true);
  }
  function showMenu() {
    state='menu'; audio.setMusicActive(false); bullets.length=enemyBullets.length=enemies.length=powerups.length=particles.length=0; hideAllScreens(); ui.menu.classList.add('screen--visible'); ui.hud.classList.add('hud--hidden'); ui.mobileControls.setAttribute('aria-hidden','true'); refreshBestStats();
  }
  function hideAllScreens() { [ui.menu,ui.how,ui.pause,ui.gameOver].forEach(el=>el.classList.remove('screen--visible')); }
  function pauseGame(force=null) {
    if(state!=='running'&&state!=='paused')return; const shouldPause=force===null?state==='running':force;
    if(shouldPause){state='paused';ui.pause.classList.add('screen--visible');audio.setMusicActive(false)}else{state='running';ui.pause.classList.remove('screen--visible');audio.setMusicActive(true);lastTime=performance.now()}
  }
  function endGame() {
    if(state==='gameover')return; state='gameover'; audio.setMusicActive(false); audio.explosion(true); screenShake=18; flash=.6; explode(player.x,player.y,'#7cf7ff',42,420,1.2);
    game.bestScore=Math.max(game.bestScore,game.score); game.bestWave=Math.max(game.bestWave,game.wave); localStorage.setItem('nebula_best_score',String(game.bestScore)); localStorage.setItem('nebula_best_wave',String(game.bestWave));
    ui.finalScore.textContent=pad(game.score);ui.finalWave.textContent=pad(game.wave,2);ui.finalKills.textContent=pad(game.kills,3);ui.finalCombo.textContent=`x${game.maxCombo}`;
    setTimeout(()=>{if(state==='gameover')ui.gameOver.classList.add('screen--visible')},650);
  }
  function refreshBestStats(){ui.bestScore.textContent=pad(game.bestScore);ui.bestWave.textContent=pad(game.bestWave,2)}

  function beginWave(){
    game.waveActive=true;game.bossWave=game.wave%5===0;enemyBullets.length=0;game.spawnTimer=game.bossWave?1.4:.8;game.enemiesToSpawn=game.bossWave?1:Math.min(28,6+game.wave*2);ui.waveStatus.textContent=game.bossWave?'COMMAND SHIP INBOUND':'CLEARING HOSTILES';showWaveToast();if(game.bossWave)audio.bossAlert();
  }
  function showWaveToast(){
    if(toastTimer)clearTimeout(toastTimer);ui.toastEyebrow.textContent=game.bossWave?'WARNING // COMMAND CLASS':'INCOMING WAVE';ui.toastTitle.textContent=game.bossWave?`BOSS SECTOR ${pad(game.wave,2)}`:`SECTOR ${pad(game.wave,2)}`;ui.toastSubtitle.textContent=game.bossWave?'Heavy hostile signature detected':'Hostile signatures detected';ui.toast.classList.add('show');toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1850);
  }
  function finishWave(){game.waveActive=false;waveDelay=2.25;game.score+=250*game.wave;ui.waveStatus.textContent='SECTOR SECURED';audio.pickup();explode(width/2,height*.22,'#74e8ff',22,160,.9)}
  function advanceWave(dt){if(game.waveActive)return;waveDelay-=dt;if(waveDelay<=0){game.wave++;game.bestWave=Math.max(game.bestWave,game.wave);player.shield=Math.min(100,player.shield+16);beginWave()}}

  function spawnEnemy(){
    if(game.enemiesToSpawn<=0)return;
    if(game.bossWave){const hp=300+game.wave*48;enemies.push({type:'boss',x:width/2,y:-120,targetY:Math.max(115,height*.18),vx:0,vy:0,radius:70,hp,maxHp:hp,t:0,shoot:1.1,phase:0,value:2500+game.wave*150});game.enemiesToSpawn=0;return}
    const roll=Math.random();let type='scout';if(game.wave>=2&&roll>.55)type='striker';if(game.wave>=3&&roll>.76)type='shooter';if(game.wave>=4&&roll>.9)type='tank';
    const x=rand(45,width-45),specs={scout:{r:17,hp:1,speed:120+game.wave*3.5,value:100},striker:{r:20,hp:2+Math.floor(game.wave/6),speed:105+game.wave*3,value:160},shooter:{r:22,hp:3+Math.floor(game.wave/5),speed:78+game.wave*2.2,value:220},tank:{r:30,hp:8+Math.floor(game.wave/3),speed:52+game.wave*1.6,value:360}}[type];
    enemies.push({type,x,y:-50,baseX:x,t:rand(0,Math.PI*2),radius:specs.r,hp:specs.hp,maxHp:specs.hp,speed:specs.speed,value:specs.value,shoot:rand(.8,2.1),phase:rand(0,Math.PI*2)});game.enemiesToSpawn--;
  }
  function spawnPowerup(x,y,forced=null){if(!forced&&!chance(.12))return;const roll=Math.random(),type=forced||(roll<.46?'rapid':roll<.78?'shield':'repair');powerups.push({type,x,y,vy:82,t:0,radius:14,life:10})}

  function shootPlayer(){
    if(player.fireCooldown>0||state!=='running')return;player.fireCooldown=player.rapidTimer>0?.075:player.fireRate;const spread=player.rapidTimer>0?7:5;
    bullets.push({x:player.x-spread,y:player.y-24,vy:-760,damage:1,life:1.5},{x:player.x+spread,y:player.y-24,vy:-760,damage:1,life:1.5});if(game.wave>=7&&player.rapidTimer>0)bullets.push({x:player.x,y:player.y-30,vy:-820,damage:1,life:1.4});audio.laser();
    for(let i=0;i<2;i++)particles.push({x:player.x+rand(-8,8),y:player.y-30,vx:rand(-20,20),vy:rand(-100,-50),life:.2,max:.2,size:rand(1,2.5),color:'#b7fbff',drag:.95});
  }
  function shootEnemy(enemy,pattern='aimed'){
    const dx=player.x-enemy.x,dy=player.y-enemy.y,len=Math.max(1,Math.hypot(dx,dy)),speed=enemy.type==='boss'?230+game.wave*2:210+game.wave*3;
    if(pattern==='radial'){for(let i=0;i<10;i++){const a=Math.PI*2*i/10+enemy.t*.3;enemyBullets.push({x:enemy.x,y:enemy.y+24,vx:Math.cos(a)*speed*.76,vy:Math.sin(a)*speed*.76,radius:5,life:6,damage:11})}}
    else if(pattern==='triple'){const angle=Math.atan2(dy,dx);[-.18,0,.18].forEach(offset=>enemyBullets.push({x:enemy.x,y:enemy.y+20,vx:Math.cos(angle+offset)*speed,vy:Math.sin(angle+offset)*speed,radius:5,life:6,damage:13}))}
    else enemyBullets.push({x:enemy.x,y:enemy.y+15,vx:dx/len*speed,vy:dy/len*speed,radius:4.5,life:6,damage:10});audio.enemyLaser();
  }

  function explode(x,y,color='#ff8a55',count=18,speed=220,life=.7){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=rand(speed*.25,speed);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(life*.55,life),max:life,size:rand(1.2,4.5),color:chance(.25)?'#ffffff':color,drag:rand(.91,.97)})}}
  function damagePlayer(amount){
    if(player.invuln>0||state!=='running')return;player.invuln=.55;player.damageCooldown=3.8;let remaining=amount;
    if(player.shield>0){const absorbed=Math.min(player.shield,remaining);player.shield-=absorbed;remaining-=absorbed}if(remaining>0)player.hull-=remaining;
    screenShake=Math.max(screenShake,8+amount*.18);flash=Math.max(flash,.24);game.combo=1;game.comboTimer=0;explode(player.x,player.y,'#7cecff',12,170,.45);audio.hit();if(player.hull<=0){player.hull=0;endGame()}
  }
  function killEnemy(enemy,index){
    enemies.splice(index,1);game.kills++;game.combo=clamp(game.combo+1,1,8);game.maxCombo=Math.max(game.maxCombo,game.combo);game.comboTimer=2.2;game.score+=Math.floor(enemy.value*game.combo);const boss=enemy.type==='boss';
    explode(enemy.x,enemy.y,boss?'#a76dff':'#ff765f',boss?64:20,boss?420:240,boss?1.25:.72);screenShake=Math.max(screenShake,boss?18:4);audio.explosion(boss);
    if(boss){spawnPowerup(enemy.x-30,enemy.y,'repair');spawnPowerup(enemy.x+30,enemy.y,'shield');game.score+=3500}else spawnPowerup(enemy.x,enemy.y);
  }
  function collectPowerup(p,index){if(p.type==='rapid')player.rapidTimer=Math.max(player.rapidTimer,7.5);if(p.type==='shield')player.shield=Math.min(100,player.shield+42);if(p.type==='repair')player.hull=Math.min(100,player.hull+30);powerups.splice(index,1);game.score+=175;explode(p.x,p.y,p.type==='repair'?'#67ffb2':p.type==='shield'?'#62dcff':'#ffd36b',16,140,.5);audio.pickup()}

  function update(dt){elapsed+=dt;updateBackground(dt);updateParticles(dt);if(state!=='running')return;updatePlayer(dt);updateWave(dt);updateBullets(dt);updateEnemies(dt);updateEnemyBullets(dt);updatePowerups(dt);resolveCollisions();advanceWave(dt);updateHud()}
  function updateBackground(dt){const factor=state==='running'?1:.32;for(const s of stars){s.y+=(13+s.z*72)*dt*factor;s.twinkle+=dt*(1+s.z*2);if(s.y>height+3){s.y=-3;s.x=Math.random()*width}}}
  function updatePlayer(dt){
    let mx=0,my=0;if(keys.KeyA||keys.ArrowLeft)mx--;if(keys.KeyD||keys.ArrowRight)mx++;if(keys.KeyW||keys.ArrowUp)my--;if(keys.KeyS||keys.ArrowDown)my++;
    if(mx||my){const len=Math.hypot(mx,my)||1;player.vx=lerp(player.vx,mx/len*player.speed,Math.min(1,dt*12));player.vy=lerp(player.vy,my/len*player.speed,Math.min(1,dt*12));pointer.active=false}
    else if(pointer.active){const dx=pointer.x-player.x,dy=pointer.y-player.y;player.vx=clamp(dx*8,-player.speed*1.05,player.speed*1.05);player.vy=clamp(dy*8,-player.speed*1.05,player.speed*1.05)}
    else{player.vx=lerp(player.vx,0,Math.min(1,dt*9));player.vy=lerp(player.vy,0,Math.min(1,dt*9))}
    player.x=clamp(player.x+player.vx*dt,26,width-26);player.y=clamp(player.y+player.vy*dt,Math.max(95,height*.32),height-34);player.fireCooldown-=dt;player.invuln-=dt;player.damageCooldown-=dt;player.rapidTimer-=dt;player.enginePulse+=dt*9;
    if((keys.Space||pointer.fire)&&player.fireCooldown<=0)shootPlayer();if(player.damageCooldown<=0&&player.shield<100)player.shield=Math.min(100,player.shield+6.5*dt);if(game.comboTimer>0){game.comboTimer-=dt;if(game.comboTimer<=0)game.combo=1}
  }
  function updateWave(dt){if(!game.waveActive||game.enemiesToSpawn<=0)return;game.spawnTimer-=dt;if(game.spawnTimer<=0){spawnEnemy();game.spawnTimer=game.bossWave?99:Math.max(.25,.82-game.wave*.018)*rand(.7,1.2)}}
  function updateBullets(dt){for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.y<-35)bullets.splice(i,1)}}
  function updateEnemyBullets(dt){for(let i=enemyBullets.length-1;i>=0;i--){const b=enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<-80||b.x>width+80||b.y<-80||b.y>height+80)enemyBullets.splice(i,1)}}
  function updateEnemies(dt){
    for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.t+=dt;
      if(e.type==='boss'){if(e.y<e.targetY)e.y=Math.min(e.targetY,e.y+88*dt);else{e.x=width/2+Math.sin(e.t*.72)*Math.min(width*.3,260);e.phase=(e.phase+dt)%8;e.shoot-=dt;if(e.shoot<=0){shootEnemy(e,e.phase>5.2?'radial':'triple');e.shoot=e.phase>5.2?1.55:.72}}continue}
      e.y+=e.speed*dt;if(e.type==='scout')e.x+=Math.sin(e.t*3.1+e.phase)*34*dt;if(e.type==='striker')e.x=e.baseX+Math.sin(e.t*2.45+e.phase)*Math.min(115,width*.12);
      if(e.type==='shooter'||e.type==='tank'){e.x+=Math.sin(e.t*1.55+e.phase)*(e.type==='tank'?18:30)*dt;e.shoot-=dt;if(e.shoot<=0&&e.y>40&&e.y<height*.65){shootEnemy(e,e.type==='tank'?'triple':'aimed');e.shoot=e.type==='tank'?rand(1.7,2.35):rand(1.25,1.9)}}
      e.x=clamp(e.x,25,width-25);if(e.y>height+e.radius+24){enemies.splice(i,1);damagePlayer(e.type==='tank'?26:14)}
    }
    if(game.waveActive&&game.enemiesToSpawn===0&&enemies.length===0)finishWave();
  }
  function updatePowerups(dt){for(let i=powerups.length-1;i>=0;i--){const p=powerups[i];p.t+=dt;p.y+=p.vy*dt;p.x+=Math.sin(p.t*3)*18*dt;p.life-=dt;if(p.life<=0||p.y>height+30)powerups.splice(i,1)}}
  function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=p.drag??.94;p.vy*=p.drag??.94;p.life-=dt;if(p.life<=0)particles.splice(i,1)}}

  function resolveCollisions(){
    for(let bi=bullets.length-1;bi>=0;bi--){const b=bullets[bi];for(let ei=enemies.length-1;ei>=0;ei--){const e=enemies[ei],rr=e.radius+6;if((b.x-e.x)**2+(b.y-e.y)**2<rr*rr){e.hp-=b.damage;bullets.splice(bi,1);particles.push({x:b.x,y:b.y,vx:rand(-70,70),vy:rand(-80,30),life:.24,max:.24,size:2.5,color:'#d9fbff',drag:.91});if(e.hp<=0)killEnemy(e,ei);break}}}
    for(let i=enemyBullets.length-1;i>=0;i--){const b=enemyBullets[i],rr=player.radius+b.radius;if((b.x-player.x)**2+(b.y-player.y)**2<rr*rr){enemyBullets.splice(i,1);damagePlayer(b.damage)}}
    for(let i=enemies.length-1;i>=0;i--){const e=enemies[i],rr=player.radius+e.radius*.72;if(distSq(player,e)<rr*rr){if(e.type!=='boss'){enemies.splice(i,1);explode(e.x,e.y,'#ff665c',18,230,.65);audio.explosion(false)}damagePlayer(e.type==='boss'?38:e.type==='tank'?34:22)}}
    for(let i=powerups.length-1;i>=0;i--){const p=powerups[i],rr=player.radius+p.radius+6;if(distSq(player,p)<rr*rr)collectPowerup(p,i)}
  }
  function updateHud(force=false){ui.score.textContent=pad(game.score);ui.combo.textContent=`x${game.combo}`;ui.combo.style.opacity=game.combo>1?'1':'.55';ui.wave.textContent=pad(game.wave,2);ui.shieldBar.style.width=`${clamp(player.shield,0,100)}%`;ui.hullBar.style.width=`${clamp(player.hull,0,100)}%`;ui.shieldText.textContent=`${Math.ceil(clamp(player.shield,0,100))}%`;ui.hullText.textContent=`${Math.ceil(clamp(player.hull,0,100))}%`;if(force)refreshBestStats()}

  function draw(){
    ctx.save();const shakeX=screenShake>.1?rand(-screenShake,screenShake):0,shakeY=screenShake>.1?rand(-screenShake,screenShake):0;ctx.translate(shakeX,shakeY);screenShake*=.88;
    drawBackground();drawStars();drawPowerups();drawEnemies();drawBullets();drawEnemyBullets();drawParticles();if(state!=='gameover'||particles.length>0)drawPlayer();drawBossBar();ctx.restore();
    if(flash>.01){ctx.fillStyle=`rgba(180,238,255,${flash*.22})`;ctx.fillRect(0,0,width,height);flash*=.82}
  }
  function drawBackground(){
    const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#02040d');bg.addColorStop(.48,'#05091a');bg.addColorStop(1,'#071126');ctx.fillStyle=bg;ctx.fillRect(-30,-30,width+60,height+60);
    const n1=ctx.createRadialGradient(width*.2,height*.2,0,width*.2,height*.2,Math.max(width,height)*.58);n1.addColorStop(0,'rgba(53,82,190,.13)');n1.addColorStop(.45,'rgba(36,61,141,.045)');n1.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=n1;ctx.fillRect(0,0,width,height);
    const n2=ctx.createRadialGradient(width*.83,height*.68,0,width*.83,height*.68,Math.max(width,height)*.46);n2.addColorStop(0,'rgba(124,53,184,.075)');n2.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=n2;ctx.fillRect(0,0,width,height);
    for(const d of ambientDust){const g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r);g.addColorStop(0,`rgba(92,150,255,${d.a})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill()}
  }
  function drawStars(){for(const s of stars){const a=.28+s.z*.55+Math.sin(s.twinkle)*.08;ctx.fillStyle=`rgba(${170+Math.floor(s.z*70)},${205+Math.floor(s.z*45)},255,${a})`;const len=state==='running'?s.size+s.z*4.5:s.size;ctx.fillRect(s.x,s.y,s.size,len)}}
  function drawPlayer(){
    if(player.hull<=0&&state==='gameover')return;ctx.save();ctx.translate(player.x,player.y);ctx.rotate(clamp(player.vx/player.speed,-1,1)*.16);if(player.invuln>0&&Math.floor(player.invuln*16)%2===0)ctx.globalAlpha=.45;
    const flame=14+Math.sin(player.enginePulse)*5+Math.abs(player.vy)*.012,fg=ctx.createLinearGradient(0,18,0,18+flame);fg.addColorStop(0,'#d7ffff');fg.addColorStop(.25,'#43e9ff');fg.addColorStop(1,'rgba(59,95,255,0)');ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(-7,18);ctx.lineTo(0,18+flame);ctx.lineTo(7,18);ctx.closePath();ctx.fill();
    ctx.shadowBlur=18;ctx.shadowColor='rgba(58,214,255,.48)';const body=ctx.createLinearGradient(-20,-25,20,24);body.addColorStop(0,'#e6fbff');body.addColorStop(.36,'#79cfe5');body.addColorStop(.68,'#244a7a');body.addColorStop(1,'#132a50');ctx.fillStyle=body;ctx.strokeStyle='rgba(157,241,255,.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,-28);ctx.lineTo(9,-12);ctx.lineTo(24,14);ctx.lineTo(10,10);ctx.lineTo(6,21);ctx.lineTo(0,16);ctx.lineTo(-6,21);ctx.lineTo(-10,10);ctx.lineTo(-24,14);ctx.lineTo(-9,-12);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowBlur=12;ctx.shadowColor='#65efff';ctx.fillStyle='#8ef7ff';ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(6,3);ctx.lineTo(0,9);ctx.lineTo(-6,3);ctx.closePath();ctx.fill();ctx.fillStyle='#5e79ff';ctx.fillRect(-15,9,6,3);ctx.fillRect(9,9,6,3);
    if(player.shield>0){ctx.globalAlpha=.08+player.shield/100*.08+(player.invuln>0?.2:0);ctx.strokeStyle='#79efff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,29,35,0,0,Math.PI*2);ctx.stroke()}ctx.restore();
  }
  function drawBullets(){ctx.save();ctx.globalCompositeOperation='lighter';for(const b of bullets){const g=ctx.createLinearGradient(b.x,b.y+16,b.x,b.y-14);g.addColorStop(0,'rgba(78,210,255,0)');g.addColorStop(.45,'#58e9ff');g.addColorStop(1,'#ffffff');ctx.strokeStyle=g;ctx.lineWidth=2.4;ctx.shadowBlur=8;ctx.shadowColor='#5be9ff';ctx.beginPath();ctx.moveTo(b.x,b.y+13);ctx.lineTo(b.x,b.y-14);ctx.stroke()}ctx.restore()}
  function drawEnemyBullets(){ctx.save();ctx.globalCompositeOperation='lighter';for(const b of enemyBullets){ctx.fillStyle='#ff5d72';ctx.shadowBlur=14;ctx.shadowColor='#ff3658';ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd6db';ctx.beginPath();ctx.arc(b.x,b.y,Math.max(1.5,b.radius*.38),0,Math.PI*2);ctx.fill()}ctx.restore()}
  function drawEnemies(){for(const e of enemies){ctx.save();ctx.translate(e.x,e.y);if(e.type==='boss')drawBoss(e);else drawEnemy(e);ctx.restore()}}
  function drawEnemy(e){
    const hpRatio=e.hp/e.maxHp;ctx.rotate(Math.sin(e.t*2+e.phase)*.12);ctx.shadowBlur=16;ctx.shadowColor=e.type==='tank'?'rgba(255,111,77,.4)':'rgba(255,72,110,.35)';const g=ctx.createLinearGradient(-e.radius,-e.radius,e.radius,e.radius);g.addColorStop(0,e.type==='tank'?'#ffb15e':'#ff7893');g.addColorStop(.45,e.type==='shooter'?'#b44fff':'#a52b50');g.addColorStop(1,'#35162b');ctx.fillStyle=g;ctx.strokeStyle='rgba(255,176,189,.62)';ctx.lineWidth=1;
    if(e.type==='scout'){ctx.beginPath();ctx.moveTo(0,e.radius);ctx.lineTo(-e.radius,-e.radius*.75);ctx.lineTo(-6,-e.radius*.42);ctx.lineTo(0,-e.radius);ctx.lineTo(6,-e.radius*.42);ctx.lineTo(e.radius,-e.radius*.75);ctx.closePath();ctx.fill();ctx.stroke()}
    else if(e.type==='striker'){ctx.beginPath();ctx.moveTo(0,e.radius);ctx.lineTo(-e.radius*1.15,-2);ctx.lineTo(-e.radius*.72,-e.radius);ctx.lineTo(0,-e.radius*.5);ctx.lineTo(e.radius*.72,-e.radius);ctx.lineTo(e.radius*1.15,-2);ctx.closePath();ctx.fill();ctx.stroke()}
    else if(e.type==='shooter'){polygonPath(6,e.radius,Math.PI/6);ctx.fill();ctx.stroke();ctx.fillStyle='#f7a6ff';ctx.shadowColor='#ef63ff';ctx.beginPath();ctx.arc(0,2,5,0,Math.PI*2);ctx.fill()}
    else{polygonPath(8,e.radius,Math.PI/8);ctx.fill();ctx.stroke();ctx.fillStyle='#532338';ctx.fillRect(-e.radius*.55,-5,e.radius*1.1,10);ctx.fillStyle='#ffd29d';ctx.fillRect(-4,-4,8,8)}
    if(e.maxHp>2&&e.hp<e.maxHp){ctx.shadowBlur=0;ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(-e.radius,-e.radius-11,e.radius*2,3);ctx.fillStyle='#ff6681';ctx.fillRect(-e.radius,-e.radius-11,e.radius*2*hpRatio,3)}
  }
  function drawBoss(e){
    const pulse=1+Math.sin(e.t*3)*.035;ctx.scale(pulse,pulse);ctx.rotate(Math.sin(e.t*.8)*.04);ctx.shadowBlur=30;ctx.shadowColor='rgba(172,91,255,.42)';const g=ctx.createLinearGradient(-80,-55,80,60);g.addColorStop(0,'#e291ff');g.addColorStop(.32,'#7c3db5');g.addColorStop(.72,'#32204f');g.addColorStop(1,'#171329');ctx.fillStyle=g;ctx.strokeStyle='rgba(222,174,255,.7)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,72);ctx.lineTo(-26,42);ctx.lineTo(-76,55);ctx.lineTo(-60,8);ctx.lineTo(-88,-28);ctx.lineTo(-35,-22);ctx.lineTo(0,-64);ctx.lineTo(35,-22);ctx.lineTo(88,-28);ctx.lineTo(60,8);ctx.lineTo(76,55);ctx.lineTo(26,42);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#e9b1ff';ctx.shadowBlur=18;ctx.shadowColor='#c95cff';ctx.beginPath();ctx.arc(0,-2,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#532c72';ctx.beginPath();ctx.arc(0,-2,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff7f9e';ctx.fillRect(-58,18,15,5);ctx.fillRect(43,18,15,5);
  }
  function polygonPath(sides,radius,rotation=0){ctx.beginPath();for(let i=0;i<sides;i++){const a=rotation+Math.PI*2*i/sides,x=Math.cos(a)*radius,y=Math.sin(a)*radius;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath()}
  function drawPowerups(){for(const p of powerups){const colors=p.type==='rapid'?['#ffd25d','#ff8d42']:p.type==='shield'?['#76f4ff','#388cff']:['#79ffb4','#21c77c'];ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.t*1.7);ctx.shadowBlur=18;ctx.shadowColor=colors[0];ctx.strokeStyle=colors[0];ctx.fillStyle='rgba(7,19,37,.86)';ctx.lineWidth=1.5;polygonPath(6,13,Math.PI/6);ctx.fill();ctx.stroke();ctx.rotate(-p.t*1.7);ctx.fillStyle=colors[0];ctx.shadowBlur=9;ctx.font='700 10px Orbitron, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.type==='rapid'?'R':p.type==='shield'?'S':'+',0,.5);ctx.restore()}}
  function drawParticles(){ctx.save();ctx.globalCompositeOperation='lighter';for(const p of particles){const alpha=clamp(p.life/(p.max||1),0,1);ctx.globalAlpha=alpha;ctx.fillStyle=p.color||'#fff';ctx.shadowBlur=7;ctx.shadowColor=p.color||'#fff';ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size)}ctx.restore();ctx.globalAlpha=1}
  function drawBossBar(){const boss=enemies.find(e=>e.type==='boss');if(!boss||state!=='running')return;const barW=Math.min(460,width*.58),x=width/2-barW/2,y=82;ctx.save();ctx.fillStyle='rgba(4,8,20,.72)';ctx.fillRect(x-12,y-18,barW+24,34);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x,y,barW,4);const grad=ctx.createLinearGradient(x,0,x+barW,0);grad.addColorStop(0,'#8d4cff');grad.addColorStop(1,'#ff5b8c');ctx.fillStyle=grad;ctx.shadowBlur=10;ctx.shadowColor='#bb55ff';ctx.fillRect(x,y,barW*clamp(boss.hp/boss.maxHp,0,1),4);ctx.shadowBlur=0;ctx.fillStyle='#a7b7ca';ctx.font='700 8px Orbitron, sans-serif';ctx.textAlign='center';ctx.fillText('COMMAND SHIP // OBLIVION CLASS',width/2,y-6);ctx.restore()}

  function frame(now){const dt=Math.min(.033,(now-lastTime)/1000||0);lastTime=now;if(state!=='paused')update(dt);draw();requestAnimationFrame(frame)}
  function setPointerFromEvent(e){const rect=canvas.getBoundingClientRect();pointer.x=e.clientX-rect.left;pointer.y=e.clientY-rect.top}

  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Enter'&&state==='menu')startGame();if(e.code==='KeyP'||e.code==='Escape'){if(state==='running'||state==='paused')pauseGame()}if(e.code==='KeyM')audio.toggle();if(e.code==='KeyR'&&state==='gameover')startGame()});
  window.addEventListener('keyup',e=>{keys[e.code]=false});window.addEventListener('blur',()=>{if(state==='running')pauseGame(true)});
  canvas.addEventListener('pointerdown',e=>{if(state!=='running')return;setPointerFromEvent(e);pointer.active=true;pointer.id=e.pointerId;if(e.pointerType!=='touch')pointer.fire=true;canvas.setPointerCapture?.(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(state!=='running'||!pointer.active)return;if(pointer.id!==null&&e.pointerId!==pointer.id)return;setPointerFromEvent(e)});
  const stopPointer=e=>{if(pointer.id!==null&&e.pointerId!==pointer.id)return;pointer.active=false;pointer.fire=false;pointer.id=null};canvas.addEventListener('pointerup',stopPointer);canvas.addEventListener('pointercancel',stopPointer);
  ui.mobileFire.addEventListener('pointerdown',e=>{e.preventDefault();pointer.fire=true});['pointerup','pointercancel','pointerleave'].forEach(evt=>ui.mobileFire.addEventListener(evt,()=>{pointer.fire=false}));
  ui.start.addEventListener('click',startGame);ui.manualLaunch.addEventListener('click',startGame);ui.howButton.addEventListener('click',()=>{audio.init();audio.ui();ui.how.classList.add('screen--visible')});ui.closeHow.addEventListener('click',()=>{audio.ui();ui.how.classList.remove('screen--visible')});ui.pauseButton.addEventListener('click',()=>pauseGame(true));ui.resume.addEventListener('click',()=>{audio.ui();pauseGame(false)});ui.quit.addEventListener('click',()=>{audio.ui();showMenu()});ui.restart.addEventListener('click',startGame);ui.menuButton.addEventListener('click',()=>{audio.ui();showMenu()});ui.soundButton.addEventListener('click',()=>audio.toggle());

  resize();updateSoundIcon();refreshBestStats();updateHud(true);requestAnimationFrame(frame);
})();
