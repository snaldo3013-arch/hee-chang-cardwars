const test=require('node:test'),assert=require('node:assert/strict');
const {changes}=require('../public/battle-effects.js');
const player=(hp,board=[])=>({hp,board}),unit=(uid,hp,moves=1)=>({uid,hp,moves,frozen:0});
const game=(rev,turn,players,log=[])=>({rev,turn,players,log});
test('effects distinguish damage, healing, defeated units, attacks and summons',()=>{
 const a=game(1,0,[player(25,[unit('a',4)]),player(30,[unit('b',3)])]);
 const b=game(2,0,[player(28,[unit('a',2,0),unit('c',4)]),player(27)]);
 const fx=changes(a,b,{type:'attack',source:'a'},0);
 assert.ok(fx.events.some(x=>x.kind==='strike'&&x.uid==='a'));
 assert.ok(fx.events.some(x=>x.kind==='summon'&&x.uid==='c'));
 assert.ok(fx.events.some(x=>x.kind==='heal'&&x.delta===3));
 assert.ok(fx.events.some(x=>x.kind==='hit'&&x.uid==='b'&&x.delta===-3));
 assert.ok(fx.events.some(x=>x.kind==='hit'&&!x.side&&x.delta===-3));
});
test('opponent spell, turn change, and duplicate snapshots',()=>{
 const a=game(1,1,[player(30),player(30)]),b=game(2,1,[player(27),player(30)],['상대: 감지']);
 const fx=changes(a,b,undefined,0);assert.equal(fx.cast,true);assert.equal(fx.banner,'감지');
 assert.equal(changes(b,game(3,0,b.players,b.log),undefined,0).banner,'⚡ 내 턴');
 assert.deepEqual(changes(b,b,undefined,0).events,[]);
});
test('critical hit is based on current HP, shared for both participants, and does not change combat damage',()=>{
 const E=require('../engine'),make=()=>E.createGame([{name:'A',hero:'hero-01'},{name:'B',hero:'hero-02'}]);
 function setup(hp,attack,trap){const g=make();g.players[0].board=[{uid:'u1',card:'card-01',attack,hp:5,moves:1}];g.players[1].hp=hp;if(trap)g.players[1].traps=[trap];return g;}
 for(const [hp,attack,trap,expected] of [[10,5,null,true],[10,4,null,false],[5,5,null,true],[10,8,'card-06',false],[10,6,'card-09',false]]){
  const g=setup(hp,attack,trap),before=JSON.parse(JSON.stringify(E.view(g,0)));E.apply(g,0,{type:'attack',source:'u1',target:'hero'});const a=E.view(g,0),b=E.view(g,1);assert.equal(Boolean(a.criticalHits.length),expected);assert.deepEqual(a.criticalHits,b.criticalHits);const damage=trap==='card-06'?0:trap==='card-09'?attack-2:attack;assert.equal(g.players[1].hp,hp-damage);if(expected){const fx=changes(before,a,undefined,1);assert.equal(fx.critical.length,1);assert.equal(fx.critical[0].actor,0);assert.equal(fx.critical[0].card,'card-01');assert.equal(fx.critical[0].damage,damage);assert.equal(fx.critical[0].hpBefore,hp);assert.equal(changes(a,a,undefined,0).critical,undefined);}
 }
});
test('critical hit retains attacker and defeated target art after both leave board',()=>{
 const E=require('../engine'),g=E.createGame([{name:'A',hero:'hero-01'},{name:'B',hero:'hero-02'}]);g.players[0].board=[{uid:'u1',card:'card-01',attack:3,hp:2,moves:1}];g.players[1].board=[{uid:'u2',card:'card-02',attack:2,hp:3,moves:1}];E.apply(g,0,{type:'attack',source:'u1',target:'u2'});assert.equal(g.players[0].board.length,0);assert.equal(g.players[1].board.length,0);assert.equal(g.criticalHits[0].targetCard,'card-02');assert.equal(g.criticalHits[0].card,'card-01');
});
