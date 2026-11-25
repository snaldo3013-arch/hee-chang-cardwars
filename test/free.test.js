const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('free browser build matches engine and runs AI without Firebase',async()=>{
 const root=path.join(__dirname,'..'),data=require('../public/cards.json'),source=fs.readFileSync(path.join(root,'engine.js'),'utf8'),browser=fs.readFileSync(path.join(root,'public/engine-browser.js'),'utf8');
 assert.equal(source,browser);const storage=new Map(),context=vm.createContext({sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,x)=>storage.set(k,x),removeItem:k=>storage.delete(k)},console});
 context.window=context;vm.runInContext(browser,context);vm.runInContext(fs.readFileSync(path.join(root,'public/free-transport.js'),'utf8'),context);const api=context.makeFreeTransport(data);
 let s=await api('create',{mode:'ai',name:'테스트',hero:'hero-01'});assert.equal(s.game.players.length,2);assert.equal(s.code,'AI');
 s=await api('action',{rev:s.game.rev,action:{type:'end'}},{code:'AI'});assert.equal(s.game.turn,0);
 const resumed=await api('state?code=AI',undefined,{code:'AI'});assert.equal(resumed.game.rev,s.game.rev);
 await assert.rejects(()=>api('create',{mode:'multi',name:'테스트',hero:'hero-01'}),/Firebase 연결/);
});
test('Spark configuration does not deploy any paid server',()=>{
 const config=require('../firebase.json'),rules=require('../database.rules.json');
 assert.equal(config.functions,undefined);assert.equal(config.firestore,undefined);assert.equal(config.database.rules,'database.rules.json');assert.equal(rules.rules['.read'],false);assert.equal(rules.rules['.write'],false);
});
