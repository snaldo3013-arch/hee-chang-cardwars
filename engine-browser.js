'use strict';
function createEngine(catalog){
const cards = Object.fromEntries(catalog.cards.map(c => [c.id,c]));
const heroes = Object.fromEntries(catalog.heroes.map(c => [c.id,c]));
const id = n => 'card-'+String(n).padStart(2,'0');
const is = (c,...ns) => ns.some(n=>c===id(n));
const shuffle = (a, rng) => { for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
function deckFor(hero,rng=Math.random){
  const groups={ 'hero-01':['SD','공통'], 'hero-02':['분말','커피'], 'hero-03':['액상','커피']};
  const preferred=groups[hero]||['공통'];
  const picks=(type,count)=>{
    const list=shuffle(catalog.cards.filter(c=>c.type===type),rng);
    list.sort((a,b)=>Number(preferred.includes(b.element))-Number(preferred.includes(a.element)));
    return list.slice(0,count).map(c=>c.id);
  };
  return shuffle([...picks('소환',17),...picks('마법',7),...picks('함정',3),...picks('장비',3)],rng);
}
function player(name,hero,rng){return {name,hero,hp:30,mana:0,maxMana:0,hand:[],deck:deckFor(hero,rng),board:[],traps:[],fatigue:0,usedSkill:false,discount:0,revealed:[]};}
function createGame(choices,rng=Math.random){
  if(choices.length!==2||choices.some(c=>!heroes[c.hero]))throw Error('영웅을 선택하세요.');
  const g={players:choices.map(c=>player(c.name,c.hero,rng)),turn:0,round:1,winner:null,nextUnit:1,log:[],rev:0};
  draw(g,0,3);draw(g,1,4);begin(g,0);return g;
}
function log(g,msg){g.log.push(msg);if(g.log.length>30)g.log.shift();}
function draw(g,i,n=1){const p=g.players[i];while(n--){if(!p.deck.length){p.hp-=++p.fatigue;log(g,p.name+' 탈진 피해 '+p.fatigue);}else{const x=p.deck.pop();if(p.hand.length<10)p.hand.push(x);}}}
function begin(g,i){const p=g.players[i];p.maxMana=Math.min(10,p.maxMana+1);p.mana=p.maxMana;p.usedSkill=false;p.revealed=[];for(const u of p.board){u.moves=u.frozen?0:u.double?2:1;u.frozen=Math.max(0,u.frozen-1);u.fresh=false;}draw(g,i);log(g,p.name+'의 턴 · 마나 '+p.mana);cleanup(g);}
function cleanup(g){for(const p of g.players)p.board=p.board.filter(u=>u.hp>0);if(g.players.some(p=>p.hp<=0)){g.winner=g.players[0].hp<=0?(g.players[1].hp<=0?'draw':1):0;} }
function unit(g,p,c,token=false){if(p.board.length>=5)return null;const x={uid:'u'+g.nextUnit++,card:c.id,attack:token?1:c.attack,hp:token?1:c.health,maxHp:token?1:c.health,taunt:is(c.id,1,7,13,15,21,25),double:is(c.id,11),moves:!token&&is(c.id,24,26)?1:0,frozen:0,weak:0,token,fresh:true};p.board.push(x);return x;}
function sprites(g,p,n){while(n-->0)unit(g,p,cards[id(24)],true);}
function find(p,t){return p.board.find(u=>u.uid===t);}
function cost(p,c){return Math.max(0,c.mana-p.discount);}
function targetOptions(g,i,c){
  const p=g.players[i],e=g.players[1-i];
  if(is(c.id,3,30,32))return e.board.map(u=>u.uid);
  if(is(c.id,41))return p.board.filter(u=>u.fresh&&!u.moves&&!u.frozen).map(u=>u.uid);
  if(is(c.id,14,38,39,40))return p.board.map(u=>u.uid);
  if(is(c.id,4,16,22))return (is(c.id,22)?e:p).board.map(u=>u.uid).concat(null);
  return [null];
}
function actions(g,i){
  if(g.winner!==null||g.turn!==i)return [];
  const p=g.players[i],e=g.players[1-i],out=[];
  p.hand.forEach((k,h)=>{const c=cards[k];if(!c||cost(p,c)>p.mana||(c.type==='소환'&&p.board.length>=5)||(c.type==='함정'&&p.traps.length>=3))return;for(const t of targetOptions(g,i,c))out.push({type:'play',h,target:t});});
  if(p.mana>=2&&!p.usedSkill){if(p.hero==='hero-03'){for(const u of e.board)out.push({type:'skill',target:u.uid});}else out.push({type:'skill',target:null});}
  const taunts=e.board.filter(u=>u.taunt),targets=taunts.length?taunts.map(u=>u.uid):[...e.board.map(u=>u.uid),'hero'];
  for(const u of p.board)if(u.moves>0&&u.attack>0)for(const t of targets)out.push({type:'attack',source:u.uid,target:t});
  out.push({type:'end'});return out;
}
function same(a,b){return a.type===b.type&&(a.h??null)===(b.h??null)&&(a.source??null)===(b.source??null)&&(a.target??null)===(b.target??null);}
function weaken(u,n){if(!u)return;const lost=Math.min(u.attack,n);u.attack-=lost;u.weak+=lost;}
function heal(u,n){if(u)u.hp=Math.min(u.maxHp,u.hp+n);}
function buff(u,n){if(u){u.maxHp+=n;u.hp+=n;}}
function trap(g,defender,n){const p=g.players[defender],ix=p.traps.indexOf(id(n));if(ix<0)return false;p.traps.splice(ix,1);log(g,p.name+' 함정 발동: '+cards[id(n)].name);return true;}
function apply(g,i,a) {
  if(!actions(g,i).some(x=>same(x,a)))throw Error('지금 사용할 수 없는 행동입니다.');
  const p=g.players[i],e=g.players[1-i];
  if(a.type==='end'){g.turn=1-i;if(g.turn===0)g.round++;begin(g,g.turn);}
  if(a.type==='skill'){p.mana-=2;p.usedSkill=true;log(g,p.name+': '+heroes[p.hero].skill);if(p.hero==='hero-01')p.board.forEach(u=>u.attack++);if(p.hero==='hero-02')e.board.forEach(u=>u.hp-=2);if(p.hero==='hero-03')find(e,a.target).frozen=1;}
  if(a.type==='attack'){const u=find(p,a.source);u.moves--;if(trap(g,1-i,6)){log(g,'공격이 무효화되었습니다.');}else{
    if(trap(g,1-i,9))weaken(u,2);if(trap(g,1-i,12))weaken(u,1);if(trap(g,1-i,37)){u.frozen=1;u.moves=0;}
    let damage=u.attack;if(is(u.card,19))damage++;
    if(a.target==='hero'){e.hp-=damage;log(g,p.name+'의 공격 · 영웅 피해 '+damage);}else{const v=find(e,a.target);v.hp-=damage;u.hp-=v.attack;log(g,cards[u.card].name+' 공격 → '+cards[v.card].name);}
  }}
  if(a.type==='play'){
    const cid=p.hand[a.h],c=cards[cid];p.mana-=cost(p,c);p.discount=0;p.hand.splice(a.h,1);log(g,p.name+': '+c.name);
    const ally=find(p,a.target),enemy=find(e,a.target);
    if(c.type==='함정'){p.traps.push(cid);}
    else if(c.type==='마법'&&trap(g,1-i,36)){log(g,'마법이 무효화되었습니다.');}
    else{
      if(c.type==='소환')unit(g,p,c);
      switch(cid){
      case id(2):p.hp=Math.min(30,p.hp+3);break;
      case id(3):enemy.frozen=1;enemy.moves=0;break;
      case id(4):buff(ally,2);break;
      case id(5):case id(43):e.board.forEach(u=>u.hp-=2);break;
      case id(8):case id(35):draw(g,i,2);break;
      case id(10):sprites(g,p,2);break;
      case id(14):case id(39):ally.attack+=2;break;
      case id(16):heal(ally,3);break;
      case id(17):case id(27):draw(g,i);break;
      case id(18):case id(34):p.mana=Math.min(10,p.mana+2);break;
      case id(20):p.discount=1;break;
      case id(22):if(enemy){enemy.frozen=1;enemy.moves=0;}break;
      case id(23):sprites(g,p,1);break;
      case id(28):p.board.forEach(u=>buff(u,1));break;
      case id(29):p.mana=Math.min(10,p.mana+1);break;
      case id(30):enemy.hp-=3;break;
      case id(31):p.board.forEach(u=>{u.attack+=u.weak;u.weak=0;u.frozen=0;});break;
      case id(32):weaken(enemy,2);break;
      case id(33):e.board.forEach(u=>u.hp--);break;
      case id(38):buff(ally,2);break;
      case id(40):buff(ally,3);break;
      case id(41):ally.moves=Math.max(1,ally.moves);break;
      case id(42):p.revealed=e.hand.slice(0,2);break;
      }
    }
  }
  cleanup(g);g.rev++;return g;
}
function bot(g,i){
  for(let k=0;k<35&&g.turn===i&&g.winner===null;k++){
    const p=g.players[i],e=g.players[1-i],aa=actions(g,i);
    const score=a=>{if(a.type==='end')return -1;if(a.type==='attack')return a.target==='hero'?(e.hp<=find(p,a.source).attack?100:7):7+(find(e,a.target).hp<=find(p,a.source).attack?3:0);if(a.type==='skill')return 3;const c=cards[p.hand[a.h]];return c.type==='소환'?8+c.mana*.4:c.type==='함정'?2:3+c.mana*.2;};
    aa.sort((a,b)=>score(b)-score(a));apply(g,i,aa[0]);
  }if(g.turn===i&&g.winner===null)apply(g,i,{type:'end'});
}
function view(g,i){return {turn:g.turn,round:g.round,winner:g.winner,rev:g.rev,log:g.log.slice(-8),players:g.players.map((p,j)=>({name:p.name,hero:p.hero,hp:p.hp,mana:p.mana,maxMana:p.maxMana,deckCount:p.deck.length,handCount:p.hand.length,hand:i===j?p.hand:undefined,board:p.board,traps:i===j?p.traps:p.traps.length,revealed:i===j?p.revealed:undefined,usedSkill:p.usedSkill,discount:i===j?p.discount:undefined})),actions:actions(g,i)};}
return {catalog,cards,heroes,createGame,apply,actions,bot,view,deckFor};
}
if(typeof module!=='undefined'&&module.exports)module.exports=createEngine(require('./public/cards.json'));
else globalThis.createCardwarsEngine=createEngine;
