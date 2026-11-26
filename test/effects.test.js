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
