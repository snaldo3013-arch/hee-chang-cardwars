'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const E=require('./engine');
const rooms=new Map();
const token=()=>crypto.randomBytes(24).toString('hex');
const roomCode=()=>{let c;do{c=crypto.randomInt(100000,1000000).toString();}while(rooms.has(c));return c;};
const cleanName=x=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=16?x.trim():null;
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function read(req){return new Promise((resolve,reject)=>{let buf='';req.on('data',x=>{buf+=x;if(buf.length>8192){reject(Error('요청이 너무 큽니다.'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(buf||'{}'));}catch{reject(Error('잘못된 요청'));}});req.on('error',reject);});}
function auth(room,t){return room.members.findIndex(m=>m.token===t);}
function state(r,i){return {code:r.code,mode:r.mode,me:i,members:r.members.map(m=>({name:m.name,hero:m.hero})),game:r.game?E.view(r.game,i):null};}
function start(r){if(r.members.length===2&&r.members.every(m=>m.hero)&&!r.game){r.game=E.createGame(r.members.map(m=>({name:m.name,hero:m.hero})));}}
async function handle(req,res){
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/api/')){
  try{
   const b=req.method==='POST'?await read(req):{};
   if(req.method==='POST'&&u.pathname==='/api/create'){
    const name=cleanName(b.name);if(!name||!E.heroes[b.hero])return send(res,400,{error:'닉네임과 영웅을 선택하세요.'});
    const mode=b.mode==='ai'?'ai':'multi',code=roomCode(),t=token(),r={code,mode,members:[{name,hero:b.hero,token:t}],game:null,touched:Date.now()};
    if(mode==='ai')r.members.push({name:'연습 AI',hero:Object.keys(E.heroes).find(x=>x!==b.hero),token:token()});rooms.set(code,r);start(r);return send(res,200,{token:t,...state(r,0)});
   }
   if(req.method==='POST'&&u.pathname==='/api/join'){
    const r=rooms.get(String(b.code)),name=cleanName(b.name);
    if(!r||r.mode!=='multi')return send(res,404,{error:'존재하지 않는 방입니다.'});
    if(r.members.length>=2)return send(res,409,{error:'이미 참가 인원이 가득 찼습니다.'});
    if(!name||!E.heroes[b.hero])return send(res,400,{error:'닉네임과 영웅을 선택하세요.'});
    const t=token();r.members.push({name,hero:b.hero,token:t});r.touched=Date.now();start(r);return send(res,200,{token:t,...state(r,1)});
   }
   const r=rooms.get(String(b.code||u.searchParams.get('code')));if(!r)return send(res,404,{error:'방을 찾을 수 없습니다.'});
   const i=auth(r,req.headers.authorization?.replace(/^Bearer /,'')||'');if(i<0)return send(res,403,{error:'참가 권한이 없습니다.'});r.touched=Date.now();
   if(req.method==='GET'&&u.pathname==='/api/state')return send(res,200,state(r,i));
   if(req.method==='POST'&&u.pathname==='/api/action'){
    if(!r.game||b.rev!==r.game.rev)return send(res,409,{error:'게임 상태가 변경되었습니다.'});
    E.apply(r.game,i,b.action||{});if(r.mode==='ai'&&r.game.turn===1&&r.game.winner===null)E.bot(r.game,1);
    return send(res,200,state(r,i));
   }
   return send(res,404,{error:'잘못된 요청'});
  }catch(e){return send(res,400,{error:e.message||'요청 오류'});}
 }
 if(req.method!=='GET')return send(res,405,{error:'허용되지 않은 요청'});
 const rel=u.pathname==='/'?'index.html':u.pathname.slice(1);
 if(!/^(index\.html|app\.js|style\.css|cards\.json|firebase-config\.js|engine-browser\.js|free-transport\.js|images\/(?:\d\d|hero-0[123])\.webp)$/.test(rel)){res.writeHead(404);return res.end();}
 const f=path.join(__dirname,'public',rel);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp'}[path.extname(f)];
 fs.readFile(f,(e,data)=>{if(e){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime,'Cache-Control':rel.startsWith('images/')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});
}
const server=http.createServer(handle);
const expiry=setInterval(()=>{for(const [code,r] of rooms)if(Date.now()-r.touched>6*3600000)rooms.delete(code);},60000);expiry.unref();
if(require.main===module)server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>{const port=server.address().port;console.log('희창 카드워즈 서버 실행: http://localhost:'+port);for(const group of Object.values(require('node:os').networkInterfaces()))for(const it of group||[])if(it.family==='IPv4'&&!it.internal)console.log('같은 Wi-Fi 접속: http://'+it.address+':'+port);});
module.exports=server;
