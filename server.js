import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { projectScores, buildSlate } from './sports.js';
const PORT=Number(process.env.PORT||3000);
let cache=null, expires=0, inFlight=null;
async function getSlate(){
 if(cache && Date.now()<expires) return cache;
 if(inFlight) return inFlight;
 inFlight=buildSlate().then(data=>{cache=data; expires=Date.now()+120000;return data}).finally(()=>inFlight=null);
 return inFlight;
}
const server=http.createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true}));}
  if(path==='/api/games'){
   const data=await getSlate();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*'});return res.end(JSON.stringify(data));
  }
  if(path==='/'||path==='/index.html'){
   const html=await readFile(new URL('./public/index.html',import.meta.url));res.writeHead(200,{'content-type':'text/html;charset=utf-8'});return res.end(html);
  }
  res.writeHead(404);res.end('Not found');
 }catch(err){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:err?.message||'Data temporarily unavailable'}));}
});
if(process.env.NODE_ENV!=='test')server.listen(PORT,'0.0.0.0',()=>console.log('Sports Lab listening',PORT));
export {server};
