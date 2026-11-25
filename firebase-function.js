'use strict';
const {onRequest}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {makeApi}=require('./cloud-api');
initializeApp();
const db=getFirestore(),rooms=db.collection('cardwarsRooms');
const store={
  async create(code,room){return db.runTransaction(async tx=>{const ref=rooms.doc(code),snap=await tx.get(ref);if(snap.exists&&snap.data().expiresAtMs>Date.now())return false;tx.set(ref,room);return true;});},
  async get(code){const snap=await rooms.doc(code).get();return snap.exists?snap.data():null;},
  async change(code,fn){return db.runTransaction(async tx=>{const ref=rooms.doc(code),snap=await tx.get(ref),r=snap.exists?snap.data():null;const out=fn(r);tx.set(ref,r);return out;});}
};
const api=makeApi(store);
exports.cardwarsApi=onRequest({region:'asia-northeast3',maxInstances:2,minInstances:0,timeoutSeconds:15,memory:'256MiB'},async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'허용되지 않는 요청입니다.'});
  if(req.rawBody?.length>8192)return res.status(413).json({error:'요청이 너무 큽니다.'});
  const path=new URL(req.originalUrl||req.url,'http://localhost').pathname;
  try{
    const body=req.method==='GET'?{code:req.query.code}:req.body;
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'잘못된 요청입니다.'});
    const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
    const result=await api({path,method:req.method,body,token});
    return res.status(200).json(result);
  }catch(e){
    if(!e.status)console.error('cardwars API internal error',e.code||e.name);
    return res.status(e.status||500).json({error:e.status?e.message:'일시적인 서버 오류입니다. 다시 시도해 주세요.'});
  }
});
