(function(root){
 'use strict';
 const fields=['office','factory','lab'];
 const notes={summon:[[392,.09],[523,.12],[784,.17]],hit:[[105,.14],[68,.12]],heal:[[523,.12],[659,.16]],strike:[[230,.1],[160,.08]],cast:[[330,.1],[660,.2]],critical:[[140,.12],[85,.18],[55,.25]],turn:[[440,.08],[587,.12]],queen:[[523,.1],[659,.1],[880,.2]],engineer:[[130,.09],[98,.12],[65,.2]],taunt:[[440,.12],[330,.12],[220,.2]]};
 let audio=null,soundEnabled=false;
 function sound(kind){if(!soundEnabled||!audio||audio.state!=='running'||!notes[kind])return;try{let time=audio.currentTime;for(const [hz,d] of notes[kind]){const osc=audio.createOscillator(),gain=audio.createGain();osc.type=['hit','strike','critical','engineer'].includes(kind)?'triangle':'sine';osc.frequency.setValueAtTime(hz,time);gain.gain.setValueAtTime(.001,time);gain.gain.exponentialRampToValueAtTime(.09,time+.015);gain.gain.exponentialRampToValueAtTime(.001,time+d);osc.connect(gain);gain.connect(audio.destination);osc.start(time);osc.stop(time+d+.01);time+=d*.75;}}catch{}}
 function setSound(enabled){soundEnabled=enabled;try{localStorage.setItem('cwSound',enabled?'1':'0');}catch{}const b=document.getElementById('sound');if(b){b.textContent=enabled?'🔊 효과음':'🔇 효과음';b.setAttribute('aria-pressed',String(enabled));}if(enabled)unlockSound();}
 function unlockSound(){if(!soundEnabled)return;try{if(!audio){const C=root.AudioContext||root.webkitAudioContext;if(C)audio=new C();}if(audio?.state==='suspended')audio.resume().catch(()=>{});}catch{}}
 const skillStyles={'hero-01':{theme:'queen',icon:'👑',color:'#ffcc65'},'hero-02':{theme:'engineer',icon:'⚙',color:'#ff9560'},'hero-03':{theme:'taunt',icon:'❄',color:'#73ddff'}};
 function previewModel(card,actions,index){return {stats:[card.type,`💎 ${card.mana}`,card.attack!=null?`⚔ ${card.attack}`:'',card.health!=null?`♥ ${card.health}`:''].filter(Boolean).join(' · '),canUse:actions.some(a=>a.type==='play'&&a.h===index)};}
 function changes(old,g,action,me){
  if(!old||!g||old.rev===g.rev)return {events:[]};
  const events=[];let banner='',cast=false;
  for(let i=0;i<2;i++){
   const before=old.players[i],after=g.players[i],own=i===me;
   const delta=after.hp-before.hp;if(delta)events.push({kind:delta<0?'hit':'heal',side:own,delta});
   for(const u of after.board){const prior=before.board.find(x=>x.uid===u.uid);if(!prior)events.push({kind:'summon',side:own,uid:u.uid});else if(u.hp!==prior.hp)events.push({kind:u.hp<prior.hp?'hit':'heal',uid:u.uid,side:own,delta:u.hp-prior.hp});}
   for(const u of before.board){if(!after.board.some(x=>x.uid===u.uid))events.push({kind:'hit',side:own,uid:u.uid,delta:-u.hp});}
   if(!action||action.type!=='attack')for(const u of after.board){const prior=before.board.find(x=>x.uid===u.uid);if(prior&&u.moves<prior.moves&&prior.frozen===u.frozen&&old.turn===i&&g.turn===i)events.push({kind:'strike',side:own,uid:u.uid});}
  }
  if(action?.type==='attack')events.push({kind:'strike',uid:action.source,side:true});
  const newLogs=g.log.filter((line,index)=>index>=g.log.length-Math.min(g.log.length,Math.max(1,g.rev-old.rev)*3)&&!old.log.includes(line));
  const spell=newLogs.slice().reverse().find(line=>line.includes(': ')),summon=events.some(e=>e.kind==='summon');
  if(action?.type==='skill'||(!summon&&(action?.type==='play'||spell))){cast=true;banner=spell?.split(': ').slice(1).join(': ')||'기술 발동!';}
  if(summon&&!banner)banner='카드 소환!';
  const turn=old.turn!==g.turn||old.round!==g.round;
  if(turn&&!banner)banner=g.turn===me?'⚡ 내 턴':'상대 턴';
  const critical=(g.criticalHits||[]).filter(hit=>hit.rev>old.rev&&hit.rev<=g.rev);
  const skills=(g.skillEvents||[]).filter(hit=>hit.rev>old.rev&&hit.rev<=g.rev);
  return {events,cast,banner,turn,critical,skills};
 }
 function cinematic(arena,hit,me,cards){
  const card=cards?.[hit.card],victim=cards?.[hit.targetCard];if(!card||!arena.isConnected)return Promise.resolve();
  const own=hit.actor===me, findUnit=uid=>Array.from(arena.querySelectorAll('[data-unit]')).find(n=>n.dataset.unit===String(uid));
  const source=findUnit(hit.source)||arena.querySelector(`[data-board="${own}"]`);
  const target=(hit.target==='hero'?arena.querySelector(`[data-profile="${!own}"]`):findUnit(hit.target))||arena.querySelector(`[data-board="${!own}"]`);
  if(!source||!target)return Promise.resolve();
  const ar=arena.getBoundingClientRect(),s=source.getBoundingClientRect(),t=target.getBoundingClientRect();
  const x=r=>r.left-ar.left+r.width/2,y=r=>r.top-ar.top+r.height/2;
  const fx=document.createElement('div');fx.className='critical-stage';fx.setAttribute('role','status');
  for(const [key,value] of Object.entries({sx:x(s),sy:y(s),tx:x(t),ty:y(t)}))fx.style.setProperty('--'+key,value+'px');
  const portrait=document.createElement('div');portrait.className='critical-character';const img=document.createElement('img');img.src=card.image;img.alt=card.name;portrait.append(img);
  const burst=document.createElement('div');burst.className='critical-impact';const label=document.createElement('div');label.className='critical-title';const headline=document.createElement('strong');headline.textContent='⚡ 치명타!';const detail=document.createElement('span');detail.textContent=card.name+' → '+(victim?.name||'상대');label.append(headline,detail);
  const num=document.createElement('div');num.className='critical-damage';num.textContent='−'+hit.damage;
  fx.append(portrait,burst,label,num);arena.append(fx);target.classList.add('critical-target');sound('critical');
  const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?550:1150;
  return new Promise(resolve=>setTimeout(()=>{fx.remove();target.classList.remove('critical-target');resolve();},duration));
 }
 function skillCinematic(arena,event,me,cards){const style=skillStyles[event.hero],hero=cards?.[event.hero];if(!style||!hero||!arena.isConnected)return Promise.resolve();const stage=document.createElement('div');stage.className='skill-stage skill-'+style.theme;stage.style.setProperty('--skill-color',style.color);stage.setAttribute('role','status');const portrait=document.createElement('img');portrait.src=hero.image;portrait.alt=hero.name;const text=document.createElement('div');text.className='skill-title';const icon=document.createElement('b');icon.textContent=style.icon;const title=document.createElement('strong');title.textContent=hero.skill;const subtitle=document.createElement('span');subtitle.textContent=hero.name;text.append(icon,title,subtitle);const particles=document.createElement('div');particles.className='skill-particles';for(let i=0;i<8;i++){const p=document.createElement('i');p.style.setProperty('--i',i);p.textContent=style.icon;particles.append(p);}stage.append(portrait,text,particles);arena.append(stage);sound(style.theme);const board=arena.querySelector(`[data-board="${event.hero==='hero-01'?event.actor===me:event.actor!==me}"]`);board?.classList.add('skill-highlight');return new Promise(resolve=>setTimeout(()=>{stage.remove();board?.classList.remove('skill-highlight');resolve();},root.matchMedia('(prefers-reduced-motion: reduce)').matches?550:1150));}
 async function play(arena,fx,me,cards){if(!arena||!fx)return;const cleanup=(el,cls)=>{el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),1050)};
  if(!fx.critical?.length&&!fx.skills?.length){const first=['hit','strike','summon','heal'].find(k=>fx.events.some(e=>e.kind===k));sound(first||(fx.cast?'cast':fx.turn?'turn':''));}
  for(const e of fx.events){const side=e.side?'true':'false';const unit=e.uid&&Array.from(arena.querySelectorAll('[data-unit]')).find(n=>n.dataset.unit===String(e.uid));const target=unit||arena.querySelector(e.uid?`[data-board="${side}"]`:`[data-profile="${side}"]`);if(!target)continue;cleanup(target,'fx-'+e.kind);if(e.delta){const rect=target.getBoundingClientRect(),ar=arena.getBoundingClientRect(),n=document.createElement('span');n.className='fx-number'+(e.delta>0?' heal':'');n.textContent=(e.delta>0?'+':'')+e.delta;n.style.left=rect.left-ar.left+rect.width/2+'px';n.style.top=rect.top-ar.top+rect.height/2+'px';arena.append(n);setTimeout(()=>n.remove(),1000);}}
  if(fx.cast)cleanup(arena,'fx-cast');if(fx.banner){const b=document.createElement('div');b.className='fx-banner'+(fx.turn&&!fx.cast?' turn':'');b.textContent=fx.banner;arena.append(b);setTimeout(()=>b.remove(),1200);}
  if(fx.critical?.length||fx.skills?.length){arena.classList.add('critical-playing');try{const sequence=[...(fx.critical||[]).map(hit=>({hit,rev:hit.rev})),...(fx.skills||[]).map(skill=>({skill,rev:skill.rev}))].sort((a,b)=>a.rev-b.rev);for(const event of sequence){if(!arena.isConnected)break;if(event.hit)await cinematic(arena,event.hit,me,cards);else await skillCinematic(arena,event.skill,me,cards);}}finally{arena.classList.remove('critical-playing');}}
 }
 function init(){let field='factory';try{const saved=localStorage.getItem('cwField');if(fields.includes(saved))field=saved;}catch{}const select=f=>{document.documentElement.dataset.field=f;document.querySelectorAll('[data-field]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.field===f));});try{localStorage.setItem('cwField',f)}catch{}};document.querySelectorAll('button[data-field]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.field)));select(field);}
 const api={changes,play,init,notes,skillStyles,previewModel};if(typeof module!=='undefined')module.exports=api;else{root.CardwarsFX=api;init();let enabled=false;try{enabled=localStorage.getItem('cwSound')==='1'}catch{}setSound(enabled);document.getElementById('sound')?.addEventListener('click',()=>{setSound(!soundEnabled);if(soundEnabled&&audio)audio.resume().then(()=>sound('summon')).catch(()=>{});});document.addEventListener('pointerdown',unlockSound,{passive:true});document.addEventListener('keydown',unlockSound);}
})(globalThis);
