'use strict';
const crypto=require('node:crypto');
const E=require('./engine');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const newKey=()=>crypto.randomBytes(24).toString('hex');
const lifetime=6*60*60*1000;
const error=(status,message)=>Object.assign(Error(message),{status});
const cleanName=x=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=16?x.trim():null;
const codeOk=x=>typeof x==='string'&&/^\d{6}$/.test(x);
const validHero=x=>typeof x==='string'&&Object.hasOwn(E.heroes,x);
const snapshot=(r,i)=>({code:r.code,mode:r.mode,me:i,members:r.members.map(m=>({name:m.name,hero:m.hero})),game:r.game?E.view(r.game,i):null});
function start(r){if(r.members.length===2&&!r.game)r.game=E.createGame(r.members.map(m=>({name:m.name,hero:m.hero})))}
function validRoom(r){if(!r||r.expiresAtMs<=Date.now())throw error(404,'방을 찾을 수 없거나 만료되었습니다.');return r;}
function auth(r,t){if(!/^[0-9a-f]{48}$/.test(t))throw error(403,'참가 권한이 없습니다.');const i=r.members.findIndex(m=>m.keyHash===hash(t));if(i<0)throw error(403,'참가 권한이 없습니다.');return i;}
function extend(r){r.expiresAtMs=Date.now()+lifetime;r.expiresAt=new Date(r.expiresAtMs);}
function makeApi(store){
  async function handle({path,method,body={},token=''}) {
    if(method==='POST'&&path==='/api/create'){
      const name=cleanName(body.name);if(!name||!validHero(body.hero))throw error(400,'닉네임과 영웅을 선택하세요.');
      const mode=body.mode==='ai'?'ai':'multi',key=newKey();
      for(let k=0;k<20;k++){
        const code=String(crypto.randomInt(100000,1000000));
        const r={code,mode,members:[{name,hero:body.hero,keyHash:hash(key)}],game:null};
        if(mode==='ai')r.members.push({name:'연습 AI',hero:Object.keys(E.heroes).find(x=>x!==body.hero),keyHash:hash(newKey())});
        extend(r);start(r);
        if(await store.create(code,r))return {token:key,...snapshot(r,0)};
      }throw error(503,'방 생성이 지연되고 있습니다. 잠시 후 다시 시도하세요.');
    }
    const code=body.code;if(!codeOk(code))throw error(400,'6자리 방 코드를 입력하세요.');
    if(method==='POST'&&path==='/api/join'){
      const name=cleanName(body.name);if(!name||!validHero(body.hero))throw error(400,'닉네임과 영웅을 선택하세요.');
      const key=newKey();
      return store.change(code,r=>{validRoom(r);if(r.mode!=='multi')throw error(404,'존재하지 않는 방입니다.');if(r.members.length>=2)throw error(409,'이미 참가 인원이 가득 찼습니다.');r.members.push({name,hero:body.hero,keyHash:hash(key)});extend(r);start(r);return {token:key,...snapshot(r,1)};});
    }
    if(method==='GET'&&path==='/api/state'){
      const r=validRoom(await store.get(code));return snapshot(r,auth(r,token));
    }
    if(method==='POST'&&path==='/api/action'){
      return store.change(code,r=>{validRoom(r);const i=auth(r,token);if(!r.game||r.game.rev!==body.rev)throw error(409,'게임 상태가 변경되었습니다.');try{E.apply(r.game,i,body.action||{});}catch(e){throw error(400,e.message);}if(r.mode==='ai'&&r.game.turn===1&&r.game.winner===null)E.bot(r.game,1);extend(r);return snapshot(r,i);});
    }
    throw error(404,'잘못된 요청입니다.');
  }
  return handle;
}
module.exports={makeApi};
