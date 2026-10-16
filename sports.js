const feeds={NFL:['football/nfl',1.5,13.5,24],NCAAF:['football/college-football',2.5,17,24],NBA:['basketball/nba',2,13,105],NCAAB:['basketball/mens-college-basketball',2.5,12,72],WNBA:['basketball/wnba',1.5,12,105],MLB:['baseball/mlb',.15,4,4.4],NHL:['hockey/nhl',.15,2.2,3],EPL:['soccer/eng.1',.15,1.8,1.4]};
const restCoeffs={NFL:.35,NCAAF:.35,NBA:.65,WNBA:.55,NCAAB:.45,MLB:.08,NHL:.25,EPL:.12};
function weightedRate(games,field,fallback){let sum=0,w=0;for(const [i,g] of games.slice(-12).reverse().entries()){const weight=.88**i;sum+=g[field]*weight;w+=weight;}return (sum+3*fallback)/(w+3);}
function restDays(games,date){const last=games.at(-1)?.date;return last==null?7:Math.max(0,Math.min(14,(date-last)/86400000));}
export function projectScores({sport,awayGames,homeGames,eventDate,fallback,homeAdv}){
 const awayOff=weightedRate(awayGames,'for',fallback),awayDef=weightedRate(awayGames,'against',fallback),homeOff=weightedRate(homeGames,'for',fallback),homeDef=weightedRate(homeGames,'against',fallback);
 const adj=(restCoeffs[sport]??0)*Math.max(-4,Math.min(4,restDays(homeGames,eventDate)-restDays(awayGames,eventDate)));
 return {awayExpected:Math.max(.1,(awayOff+homeDef)/2-homeAdv/2-adj/2),homeExpected:Math.max(.1,(homeOff+awayDef)/2+homeAdv/2+adj/2)};
}
function erf(x){const sign=x<0?-1:1,z=Math.abs(x),t=1/(1+.3275911*z);return sign*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-z*z));}
const normalCdf=x=>.5*(1+erf(x/Math.sqrt(2)));
const implied=x=>{const n=Number(x);return x==null||!Number.isFinite(n)||!n?null:n>0?100/(n+100):-n/(-n+100)};
const monthKey=d=>''+d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0');
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'user-agent':'IndependentSportsLab/1.0'}});if(!r.ok)throw Error('Sports feed unavailable ('+r.status+')');return r.json()}
export async function buildSlate(){
 const warnings=[];const all=await Promise.all(Object.entries(feeds).map(async([sport,[path,homeAdv,sd,fallback]])=>{
  try{
   const now=new Date(),prev=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)),tail=sport==='NCAAF'?'&groups=80&limit=200':'&limit=1000';
   const base='https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard';
   const [live,prevData,currData]=await Promise.all([json(base),json(base+'?dates='+monthKey(prev)+tail),json(base+'?dates='+monthKey(now)+tail)]);
   const form=new Map();const seen=new Set();
   const completed=[...(prevData.events||[]),...(currData.events||[])].filter(e=>e.status?.type?.state==='post').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
   for(const e of completed){if(seen.has(e.id))continue;seen.add(e.id);const comp=e.competitions?.[0];const a=comp?.competitors?.find(c=>c.homeAway==='away'),h=comp?.competitors?.find(c=>c.homeAway==='home');if(!a?.team?.id||!h?.team?.id||a.score==null||h.score==null)continue;const as=Number(a.score),hs=Number(h.score);if(!Number.isFinite(as)||!Number.isFinite(hs))continue;const date=Date.parse(e.date);for(const [team,f,against] of [[a,as,hs],[h,hs,as]]){const id=String(team.team.id);form.set(id,[...(form.get(id)||[]),{date,for:f,against}]);}}
   const games=[];
   for(const e of live.events||[]){const comp=e.competitions?.[0],a=comp?.competitors?.find(c=>c.homeAway==='away'),h=comp?.competitors?.find(c=>c.homeAway==='home');if(!a?.team?.id||!h?.team?.id)continue;
    const ag=(form.get(String(a.team.id))||[]).filter(g=>g.date<Date.parse(e.date)),hg=(form.get(String(h.team.id))||[]).filter(g=>g.date<Date.parse(e.date));
    const p=projectScores({sport,awayGames:ag,homeGames:hg,eventDate:Date.parse(e.date),fallback,homeAdv});const margin=p.homeExpected-p.awayExpected;
    const odds=comp?.odds?.[0],state=e.status?.type?.state||'pre';const seasonType=Number(e.season?.type??comp?.type?.id);
    const eligible=state==='pre'&&seasonType!==1&&ag.length>=5&&hg.length>=5&&!/preseason|exhibition|friendly/i.test(String(e.season?.slug||''));
    const candidates=[];const ah=implied(odds?.moneyline?.away?.close?.odds),hh=implied(odds?.moneyline?.home?.close?.odds);
    const homeProb=normalCdf(margin/sd);
    if(sport!=='EPL'){if(hh!=null)candidates.push({market:'Moneyline',selection:h.team.displayName,edge:homeProb-hh,score:Math.abs(homeProb-hh),odds:odds.moneyline.home.close.odds});if(ah!=null)candidates.push({market:'Moneyline',selection:a.team.displayName,edge:1-homeProb-ah,score:Math.abs(1-homeProb-ah),odds:odds.moneyline.away.close.odds});}
    const hs=odds?.pointSpread?.home?.close,as=odds?.pointSpread?.away?.close;if(hs?.line!=null&&as?.line!=null&&implied(hs.odds)!=null&&implied(as.odds)!=null){const edge=margin+Number(hs.line),pick=edge>=0?hs:as;const team=edge>=0?h:a;candidates.push({market:'Spread',selection:team.team.displayName+' '+pick.line,edge,score:Math.abs(edge)/sd,odds:pick.odds});}
    const total=odds?.overUnder;const over=odds?.total?.over?.close,under=odds?.total?.under?.close;if(typeof total==='number'&&implied(over?.odds)!=null&&implied(under?.odds)!=null){const edge=p.awayExpected+p.homeExpected-total; candidates.push({market:'Total',selection:(edge>=0?'Over ':'Under ')+total,edge,score:Math.abs(edge)/sd,odds:(edge>=0?over:under).odds});}
    candidates.sort((a,b)=>b.score-a.score);
    games.push({id:e.id,sport,date:e.date,state,away:a.team.displayName,home:h.team.displayName,awayExpected:+p.awayExpected.toFixed(1),homeExpected:+p.homeExpected.toFixed(1),homeWinProb:+homeProb.toFixed(4),selection:eligible?candidates[0]?.selection??null:null,market:eligible?candidates[0]?.market??null:null,odds:eligible?candidates[0]?.odds??null:null,edge:eligible?candidates[0]?.edge??null:null,verdict:eligible&&candidates[0]?'WATCH':'PASS',reason:!eligible?'Insufficient sample, non-pregame or exhibition':candidates.length?'Unvalidated model disagreement; not a betting recommendation':'No fully priced market available',historicalValidation:'NOT MIGRATED',injuries:'NOT VERIFIED',lineups:'NOT VERIFIED'});
   }
   return games;
  }catch(err){warnings.push(sport+': '+err.message);return [];}
 }));return {generatedAt:new Date().toISOString(),games:all.flat().sort((a,b)=>a.date.localeCompare(b.date)),warnings,validatedBets:0,modelVersion:'v3 projection port; historical validation not migrated'};
}
