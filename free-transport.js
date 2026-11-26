'use strict';
window.makeFreeTransport=function(catalog){
  const E=window.createCardwarsEngine(catalog);
  let ai=null,fb=null,connecting=null,watchStop=null,activeCode=null,hostQueue=Promise.resolve();
  const js=x=>JSON.stringify(x),parse=x=>typeof x==='string'?JSON.parse(x):null;
  const err=m=>{throw Error(m)};
  const roomPath=code=>'cardwarsRooms/'+code;
  async function connect(){
    if(fb)return fb;
    if(!window.CARDWARS_FIREBASE_CONFIG)err('온라인 대전은 Firebase 연결 후 이용할 수 있어요. 지금은 AI 연습을 이용하세요.');
    if(!connecting)connecting=(async()=>{
      const [a,b,c]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js')]);
      const app=a.initializeApp(window.CARDWARS_FIREBASE_CONFIG);const auth=b.getAuth(app);await b.setPersistence(auth,b.browserLocalPersistence);await b.signInAnonymously(auth);const db=c.getDatabase(app);
      return {uid:auth.currentUser.uid,ref:p=>c.ref(db,p),get:c.get,set:c.set,tx:c.runTransaction,update:c.update,onValue:c.onValue};
    })().catch(e=>{connecting=null;throw e});
    fb=await connecting;return fb;
  }
  function loadAI(){if(ai)return ai;try{ai=parse(sessionStorage.getItem('cwAI'))}catch{}return ai;}
  function saveAI(){sessionStorage.setItem('cwAI',js(ai));}
  function aiState(){return {code:'AI',token:'AI',mode:'ai',me:0,members:ai.players.map(p=>({name:p.name,hero:p.hero})),game:E.view(ai,0)}}
  function members(m){return [m.host,m.guest].filter(Boolean).map(x=>({name:x.name,hero:x.hero}));}
  function state(code,m,uid,p){return {code,token:uid,mode:'multi',me:m.host.uid===uid?0:1,members:members(m),game:p?.game||null,ack:p?.ack||null,error:p?.error||null};}
  async function meta(f,code){if(!/^\d{6}$/.test(code))err('6자리 방 코드를 입력하세요.');const m=(await f.get(f.ref(roomPath(code)+'/meta'))).val();if(!m)err('방을 찾을 수 없습니다.');if(m.expiresAt<Date.now())err('방이 만료되었습니다.');return m;}
  async function publish(f,code,m,g,ack=null,error=null){
    const root=roomPath(code),updates={};
    updates['game']=js(g);
    updates['views/'+m.host.uid]=js({game:E.view(g,0)});
    updates['views/'+m.guest.uid]=js({game:E.view(g,1),ack,error});
    if(ack)updates.request=null;
    await f.update(f.ref(root),updates);
  }
  async function hostStep(f,code,action=null,rev=null){
    const m=await meta(f,code);if(m.host.uid!==f.uid)err('방장만 게임을 진행할 수 있습니다.');
    if(!m.guest)return state(code,m,f.uid,null);
    const root=roomPath(code),snap=await f.get(f.ref(root+'/game'));let g=parse(snap.val());
    if(!g){g=E.createGame(members(m));await publish(f,code,m,g);}
    const request=parse((await f.get(f.ref(root+'/request'))).val());
    if(request){let failure=null;try{if(request.rev!==g.rev)err('게임 상태가 변경되었습니다.');E.apply(g,1,request.action);}catch(e){failure=e.message;}await publish(f,code,m,g,request.id,failure);}
    if(action){if(rev!==g.rev)err('게임 상태가 변경되었습니다.');E.apply(g,0,action);await publish(f,code,m,g);}
    return state(code,m,f.uid,{game:E.view(g,0)});
  }
  function queued(f,code,a=null,rev=null){const next=hostQueue.then(()=>hostStep(f,code,a,rev));hostQueue=next.catch(()=>{});return next;}
  function watch(f,code){if(activeCode===code)return;if(watchStop)watchStop();activeCode=code;watchStop=f.onValue(f.ref(roomPath(code)+'/request'),s=>{if(s.exists())queued(f,code).catch(()=>{});});}
  async function getState(code){const f=await connect(),m=await meta(f,code);if(m.host.uid===f.uid){watch(f,code);return queued(f,code);}if(m.guest?.uid!==f.uid)err('참가 권한이 없습니다.');return state(code,m,f.uid,parse((await f.get(f.ref(roomPath(code)+'/views/'+f.uid))).val()));}
  async function guestAction(f,code,m,body){
    const root=roomPath(code),id=crypto.randomUUID();const request={id,rev:body.rev,action:body.action};
    const result=await f.tx(f.ref(root+'/request'),old=>old==null?js(request):undefined,{applyLocally:false});if(!result.committed)err('이전 행동이 처리되는 중입니다.');
    return new Promise((resolve,reject)=>{let stop=()=>{};const timer=setTimeout(()=>{stop();reject(Error('방장 연결을 기다리는 중입니다. 잠시 후 다시 시도하세요.'));},15000);stop=f.onValue(f.ref(root+'/views/'+f.uid),snap=>{const p=parse(snap.val());if(p?.ack!==id)return;clearTimeout(timer);stop();if(p.error)reject(Error(p.error));else resolve(state(code,m,f.uid,p));},e=>{clearTimeout(timer);stop();reject(e)});});
  }
  async function api(path,body,session){
    if(path==='create'&&body.mode==='ai'){ai=E.createGame([{name:body.name,hero:body.hero},{name:'연습 AI',hero:Object.keys(E.heroes).find(x=>x!==body.hero)}]);saveAI();return aiState();}
    if((path.startsWith('state?')||path==='action')&&session?.code==='AI'){if(!loadAI())err('이전 연습 대전이 없습니다.');if(path==='action'){if(body.rev!==ai.rev)err('게임 상태가 변경되었습니다.');E.apply(ai,0,body.action);if(ai.turn===1&&ai.winner===null)E.bot(ai,1);saveAI();}return aiState();}
    const f=await connect();
    if(path==='create'){
      for(let k=0;k<12;k++){const code=String(100000+Math.floor(Math.random()*900000)),m={host:{uid:f.uid,name:body.name,hero:body.hero},expiresAt:Date.now()+6*60*60*1000};const t=await f.tx(f.ref(roomPath(code)+'/meta'),old=>old==null?m:undefined,{applyLocally:false});if(t.committed){watch(f,code);return state(code,m,f.uid,null);}}err('방 생성에 실패했어요. 다시 시도하세요.');
    }
    if(path==='join'){
      const code=String(body.code||''),m=await meta(f,code);if(m.host.uid===f.uid)return getState(code);
      const r=await f.tx(f.ref(roomPath(code)+'/meta'),old=>old&&!old.guest?{...old,guest:{uid:f.uid,name:body.name,hero:body.hero}}:undefined,{applyLocally:false});
      if(!r.committed){if(m.guest?.uid===f.uid)return getState(code);err('이미 참가 인원이 가득 찼습니다.');}return state(code,r.snapshot.val(),f.uid,null);
    }
    const code=session?.code;if(!code)err('방을 먼저 생성하세요.');
    if(path.startsWith('state?'))return getState(code);
    if(path==='action'){const m=await meta(f,code);if(m.host.uid===f.uid)return queued(f,code,body.action,body.rev);if(m.guest?.uid!==f.uid)err('참가 권한이 없습니다.');return guestAction(f,code,m,body);}
    err('요청 오류');
  }
  api.leave=()=>{if(watchStop)watchStop();watchStop=null;activeCode=null;ai=null;sessionStorage.removeItem('cwAI');};
  return api;
};
