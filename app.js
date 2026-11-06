(() => {
  'use strict';
  const modes = [
    ['fixed','target','FIXO','Alvos estáticos'],['reflex','zap','REFLEXO','Reação rápida'],
    ['moving','move','MÓVEL','Alvos em movimento'],['precision','focus','PRECISÃO','Alvos menores'],
    ['tracking','eye','TRACKING','Siga e segure']
  ];
  const iconPaths={
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
    zap:'<path d="m13 2-9 11h7l-1 9 10-12h-7z"/>',
    move:'<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
    focus:'<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4M21 16v4a1 1 0 0 1-1 1h-4"/><circle cx="12" cy="12" r="3"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    flame:'<path d="M12 22c5 0 8-3.5 8-8 0-3-1.6-5.5-4-8-.2 3-1.3 4-2 4C14 6 11 3.5 9 2c0 4-5 7-5 12 0 4.5 3 8 8 8z"/><path d="M12 22c2.2 0 3.5-1.5 3.5-3.5S13 15 12 14c-.5 2-3.5 3-3.5 4.5S9.8 22 12 22z"/>',
    burst:'<path d="m12 2 2.3 6.3L21 6l-3.1 6 4.1 4-7.1.4L12 23l-2.9-6.6L2 16l4.1-4L3 6l6.7 2.3z"/>',
    medal:'<circle cx="12" cy="15" r="6"/><path d="m8.5 9-3-7H10l2 5 2-5h4.5l-3 7M12 12v6M9 15h6"/>',
    repeat:'<path d="M20 7h-11a6 6 0 0 0-6 6M4 17h11a6 6 0 0 0 6-6M17 4l3 3-3 3M7 14l-3 3 3 3"/>'
  };
  function icon(name){return `<svg class="game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.target}</svg>`;}
  const difficulties = [['easy','FÁCIL',.8],['normal','NORMAL',1],['hard','DIFÍCIL',1.25],['insane','INSANO',1.55],['god','AIM GOD',1.95]];
  const xpPerLevel = 250;
  const $ = id => document.getElementById(id);
  const storeKey = 'aimboost_mobile_v1';
  let data;
  try { data = JSON.parse(localStorage.getItem(storeKey)) || {}; } catch { data = {}; }
  data = { xp: Number(data.xp)||0, sessions: Array.isArray(data.sessions)?data.sessions.slice(0,40):[], mission: data.mission||{date:'',count:0,claimed:false} };
  let mode='fixed', diff='normal', running=false, raf=0, countdownId=0, score=0, hits=0, attempts=0, trackingMs=0, last=0, remaining=30, target=null, pointerDown=false, pointerX=0, pointerY=0, lastTarget=0, targetExpires=0;
  const canvas=$('game'), ctx=canvas.getContext('2d');
  const modeMeta=()=>modes.find(x=>x[0]===mode);
  const diffMeta=()=>difficulties.find(x=>x[0]===diff);
  function save(){try{localStorage.setItem(storeKey,JSON.stringify(data));}catch{}}
  function today(){return new Date().toLocaleDateString('en-CA');}
  function freshMission(){return {date:today(),count:0,claimed:false,hits:0,tracking:0,hitReward:false,trackingReward:false,precision:0,accurate:0,modes:[],extraRewards:{}};}
  function refreshMission(){if(data.mission.date!==today()){data.mission=freshMission();save();}}
  function missionDefinitions(m){return [
    {id:'first',icon:'flame',title:'PRIMEIRO PASSO',desc:'Conclua 1 treino.',value:m.count||0,goal:1,reward:25,done:!!m.extraRewards?.first},
    {id:'three',icon:'target',title:'AQUECIMENTO DIÁRIO',desc:'Complete 3 treinos.',value:m.count||0,goal:3,reward:50,done:!!m.claimed},
    {id:'hits15',icon:'zap',title:'MIRA AFIADA',desc:'Acerte 15 alvos.',value:m.hits||0,goal:15,reward:30,done:!!m.hitReward},
    {id:'hits30',icon:'burst',title:'CHUVA DE ACERTOS',desc:'Acerte 30 alvos.',value:m.hits||0,goal:30,reward:60,done:!!m.extraRewards?.hits30},
    {id:'tracking',icon:'eye',title:'OLHO NO ALVO',desc:'Complete 1 treino de Tracking.',value:m.tracking||0,goal:1,reward:40,done:!!m.trackingReward},
    {id:'precision',icon:'focus',title:'MÃO FIRME',desc:'Complete 1 treino de Precisão.',value:m.precision||0,goal:1,reward:45,done:!!m.extraRewards?.precision},
    {id:'accurate',icon:'medal',title:'ATIRADOR CERTEIRO',desc:'Termine 1 treino com pelo menos 70% de precisão.',value:m.accurate||0,goal:1,reward:50,done:!!m.extraRewards?.accurate},
    {id:'variety',icon:'repeat',title:'VERSATILIDADE',desc:'Jogue 2 modos diferentes.',value:m.modes?.length||0,goal:2,reward:55,done:!!m.extraRewards?.variety}
  ];}
  function show(view){document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===view));document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));document.querySelector('.bottom-nav').style.display=view==='arena'?'none':'';document.querySelector('main').style.paddingBottom=view==='arena'?'12px':'';document.body.classList.toggle('in-game',view==='arena');updateOrientation();if(['home','profile','missions'].includes(view))renderStats();scrollTo(0,0);}
  let resizeDelay=0;
  function scheduleArenaResize(){clearTimeout(resizeDelay);resizeDelay=setTimeout(()=>{if(document.body.classList.contains('in-game'))resizeCanvas();},160);}
  function updateOrientation(){const active=document.body.classList.contains('in-game');const rotated=active&&innerHeight>innerWidth;const changed=document.body.classList.contains('rotate-game')!==rotated;document.body.classList.toggle('rotate-game',rotated);if(changed)scheduleArenaResize();}
  async function enterLandscape(){
    // Browsers generally require fullscreen and a user gesture for orientation lock.
    try{if(document.documentElement.requestFullscreen&&!document.fullscreenElement)await document.documentElement.requestFullscreen();}catch{}
    try{if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch{}
    updateOrientation();
  }
  function leaveLandscape(){try{screen.orientation?.unlock?.();}catch{}if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});}document.body.classList.remove('rotate-game');}
  function renderChoices(){
    $('modeGrid').innerHTML=modes.map(m=>`<button class="mode-button ${m[0]===mode?'active':''}" data-mode="${m[0]}"><span class="mode-icon">${icon(m[1])}</span><b>${m[2]}</b><small>${m[3]}</small></button>`).join('');
    $('difficultyGrid').innerHTML=difficulties.map(d=>`<button data-diff="${d[0]}" class="${d[0]===diff?'active':''}">${d[1]}</button>`).join('');
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;renderChoices();});
    document.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{diff=b.dataset.diff;renderChoices();});
  }
  function renderStats(){
    refreshMission();const ss=data.sessions;const level=Math.floor(data.xp/xpPerLevel)+1;
    $('totalSessions').textContent=ss.length;$('avgAcc').textContent=ss.length?Math.round(ss.reduce((a,s)=>a+s.accuracy,0)/ss.length)+'%':'0%';$('bestScore').textContent=ss.reduce((a,s)=>Math.max(a,s.score),0);$('xp').textContent=data.xp;$('level').textContent=level;
    $('profileLevel').textContent='NÍVEL '+level;$('xpProgressLabel').textContent=`${data.xp%xpPerLevel} / ${xpPerLevel} XP`;$('xpFill').style.width=(data.xp%xpPerLevel)/xpPerLevel*100+'%';
    $('missionLabel').textContent=Math.min(3,data.mission.count)+'/3';$('missionFill').style.width=Math.min(100,data.mission.count/3*100)+'%';$('missionHelp').textContent=data.mission.claimed?'Missão concluída! Bônus recebido.':'Complete 3 treinos para receber 50 XP.';
    $('history').innerHTML=ss.length?ss.slice(0,10).map(s=>`<div class="history-item"><div><b>${modes.find(m=>m[0]===s.mode)?.[2]||'TREINO'} · ${s.difficulty.toUpperCase()}</b><small>${new Date(s.date).toLocaleString('pt-BR')}</small></div><strong>${s.score} PTS</strong></div>`).join(''):'<div class="history-empty">Nenhum treino registrado. Comece seu primeiro treino!</div>';
    renderMissions();
  }
  function renderMissions(){
    const m=data.mission;
    const cards=missionDefinitions(m);
    const done=cards.filter(c=>c.done).length;$('missionsDone').textContent=`${done} / ${cards.length}`;$('missionsTotalFill').style.width=(done/cards.length*100)+'%';
    $('missionCards').innerHTML=cards.map(c=>`<article class="mission-detail ${c.done?'complete':''}"><div class="mission-detail-head"><span class="mission-emoji">${icon(c.icon)}</span><div><b>${c.title}</b><p>${c.desc}</p></div><span class="mission-reward">+${c.reward} XP</span></div><div class="mission-detail-progress"><span>${c.done?'CONCLUÍDA':'EM PROGRESSO'}</span><strong>${Math.min(c.goal,c.value)} / ${c.goal}</strong></div><div class="progress"><div style="width:${Math.min(100,c.value/c.goal*100)}%"></div></div></article>`).join('');
  }
  function resizeCanvas(){
    // clientWidth/Height stay in canvas coordinates even when its parent is rotated.
    // getBoundingClientRect() swaps these axes and caused repeated resets/flicker.
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(w<1||h<1)return {w,h};
    const pixelW=Math.round(w*dpr),pixelH=Math.round(h*dpr);
    if(canvas.width!==pixelW||canvas.height!==pixelH){canvas.width=pixelW;canvas.height=pixelH;ctx.setTransform(dpr,0,0,dpr,0,0);}
    return {w,h};
  }
  function dimensions(){return {w:canvas.clientWidth,h:canvas.clientHeight};}
  function spawn(){const {w,h}=dimensions(), mult=diffMeta()[2];let radius=mode==='precision'?15:mode==='tracking'?29:25;radius=Math.max(10,radius/Math.sqrt(mult));radius=Math.min(radius,w/8,h/10);const margin=radius+14;const x=margin+Math.random()*Math.max(1,w-margin*2), y=margin+25+Math.random()*Math.max(1,h-margin*2-25);const angle=Math.random()*Math.PI*2;target={x,y,radius,vx:Math.cos(angle)*(45*mult),vy:Math.sin(angle)*(45*mult),phase:Math.random()*7};lastTarget=performance.now();targetExpires=lastTarget+1150/Math.sqrt(mult);}
  function updateHUD(){$('score').textContent=score;$('hits').textContent=hits;$('accuracy').textContent=(mode==='tracking'?Math.min(100,Math.round(trackingMs/30000*100)):attempts?Math.round(hits/attempts*100):0)+'%';$('timer').textContent=remaining.toFixed(1);}
  function finish(){if(!running)return;running=false;cancelAnimationFrame(raf);pointerDown=false;const accuracy=mode==='tracking'?Math.min(100,Math.round(trackingMs/30000*100)):attempts?Math.round(100*hits/attempts):0;const earned=Math.max(25,Math.round(score/12)+25);data.xp+=earned;refreshMission();const m=data.mission;m.count++;m.hits=(m.hits||0)+hits;if(mode==='tracking')m.tracking=(m.tracking||0)+1;if(mode==='precision')m.precision=(m.precision||0)+1;if(accuracy>=70)m.accurate=(m.accurate||0)+1;if(!Array.isArray(m.modes))m.modes=[];if(!m.modes.includes(mode))m.modes.push(mode);if(!m.extraRewards)m.extraRewards={};let bonus=0;for(const quest of missionDefinitions(m)){if(quest.value<quest.goal||quest.done)continue;bonus+=quest.reward;if(quest.id==='three')m.claimed=true;else if(quest.id==='hits15')m.hitReward=true;else if(quest.id==='tracking')m.trackingReward=true;else m.extraRewards[quest.id]=true;}data.xp+=bonus;data.sessions.unshift({mode,difficulty:diff,score,hits,accuracy,date:new Date().toISOString()});data.sessions=data.sessions.slice(0,40);save();$('finalScore').textContent=score;$('finalHits').textContent=hits;$('finalAccuracy').textContent=accuracy+'%';$('earnedXp').textContent=`+${earned+bonus} XP${bonus?' (inclui missões)':''}`;$('results').classList.remove('hidden');}
  function stop(){running=false;cancelAnimationFrame(raf);clearInterval(countdownId);pointerDown=false;$('countdown').classList.add('hidden');$('results').classList.add('hidden');}
  function start(){stop();enterLandscape();score=hits=attempts=trackingMs=0;remaining=30;target=null;pointerDown=false;$('arenaMode').textContent=modeMeta()[2];$('arenaDiff').textContent=diffMeta()[1];$('gameHint').textContent=mode==='tracking'?'MANTENHA O DEDO SOBRE O ALVO':'TOQUE NOS ALVOS';$('arenaTip').textContent=mode==='tracking'?'Acompanhe o alvo com o dedo pressionado.':'Toque diretamente nos alvos para pontuar.';show('arena');resizeCanvas();updateHUD();let count=3;$('countdown').classList.remove('hidden');$('countdown').firstElementChild.textContent=count;countdownId=setInterval(()=>{count--;if(count>0){$('countdown').firstElementChild.textContent=count;}else{clearInterval(countdownId);$('countdown').classList.add('hidden');resizeCanvas();running=true;spawn();last=performance.now();raf=requestAnimationFrame(frame);}},750);}
  function frame(now){if(!running)return;let dt=Math.min(.05,(now-last)/1000);last=now;remaining=Math.max(0,remaining-dt);if(remaining<=0){updateHUD();finish();return;}const {w,h}=dimensions();if(!target)spawn();const moving=['moving','tracking'].includes(mode);if(moving&&target){const m=diffMeta()[2];target.phase+=dt*2;if(mode==='tracking'){target.vx+=Math.sin(target.phase)*dt*70*m;target.vy+=Math.cos(target.phase*.77)*dt*70*m;const s=Math.hypot(target.vx,target.vy);if(s>110*m){target.vx*=110*m/s;target.vy*=110*m/s;}}target.x+=target.vx*dt;target.y+=target.vy*dt;let min=target.radius+5,maxX=w-min,maxY=h-min;if(target.x<min||target.x>maxX){target.vx*=-1;target.x=Math.max(min,Math.min(maxX,target.x));}if(target.y<min+17||target.y>maxY){target.vy*=-1;target.y=Math.max(min+17,Math.min(maxY,target.y));}}
    if(mode==='tracking'&&pointerDown&&target&&Math.hypot(pointerX-target.x,pointerY-target.y)<target.radius+12){trackingMs+=dt*1000;score+=Math.round(110*dt);if(now-lastTarget>200){hits++;lastTarget=now;}}
    if(mode==='reflex'&&now>targetExpires){attempts++;spawn();}
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1018';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#222936';ctx.lineWidth=1;for(let x=0;x<w;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.strokeStyle='#354252';ctx.beginPath();ctx.moveTo(w/2-12,h/2);ctx.lineTo(w/2+12,h/2);ctx.moveTo(w/2,h/2-12);ctx.lineTo(w/2,h/2+12);ctx.stroke();if(target){const t=target;ctx.shadowBlur=24;ctx.shadowColor='#ff641c88';ctx.fillStyle='#ff641c';ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#ffcb9e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(t.x,t.y,t.radius*.65,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff4e8';ctx.beginPath();ctx.arc(t.x,t.y,Math.max(3,t.radius*.2),0,Math.PI*2);ctx.fill();}
    updateHUD();raf=requestAnimationFrame(frame);
  }
  function inputPosition(ev){const r=canvas.getBoundingClientRect();if(document.body.classList.contains('rotate-game'))return {x:ev.clientY-r.top,y:r.right-ev.clientX};return {x:ev.clientX-r.left,y:ev.clientY-r.top};}
  canvas.addEventListener('pointerdown',e=>{if(!running)return;e.preventDefault();const p=inputPosition(e);pointerX=p.x;pointerY=p.y;pointerDown=true;try{canvas.setPointerCapture(e.pointerId);}catch{}if(mode==='tracking')return;attempts++;if(target&&Math.hypot(p.x-target.x,p.y-target.y)<=target.radius+7){hits++;score+=Math.round(100*diffMeta()[2]*(mode==='precision'?1.5:1));spawn();}updateHUD();});
  canvas.addEventListener('pointermove',e=>{if(pointerDown){const p=inputPosition(e);pointerX=p.x;pointerY=p.y;}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>pointerDown=false);
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(running)stop();leaveLandscape();show(b.dataset.view);});
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{mode=b.dataset.go;renderChoices();show('train');});
  $('quickStart').onclick=()=>show('train');$('startButton').onclick=start;$('restart').onclick=start;$('backToTrain').onclick=()=>{stop();leaveLandscape();show('train');};$('leaveArena').onclick=()=>{stop();leaveLandscape();show('train');};
  $('missionTrain').onclick=()=>show('train');
  $('resetData').onclick=()=>{if(confirm('Apagar todos os treinos e XP salvos neste dispositivo?')){data={xp:0,sessions:[],mission:freshMission()};save();renderStats();}};
  window.addEventListener('resize',()=>{updateOrientation();scheduleArenaResize();});
  screen.orientation?.addEventListener?.('change',()=>{updateOrientation();scheduleArenaResize();});
  document.addEventListener('fullscreenchange',()=>{updateOrientation();scheduleArenaResize();});
  document.querySelectorAll('[data-feature-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.featureIcon);});
  renderChoices();renderStats();
})();
