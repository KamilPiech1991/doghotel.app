export type Size='small'|'medium'|'large';
export type Dog={id:string;ownerId:string;name:string;size:Size;weight?:string;breed?:string};
export type Owner={id:string;name:string;phone:string};
export type Booking={id:string;ownerId:string;dogIds:string[];kennel:number;arrival:string;departure:string;status:'reserved'|'checked_in'|'checked_out'|'cancelled';total:number|null;deposit:number;paid:number;createdAt:string};
export type Settings={rates:Record<Size,number>;depositPercent:number;cleaningMinutes:number;specialPeriods:{id:string;name:string;from:string;to:string;rates:Record<Size,number>}[]};
export type DB={owners:Owner[];dogs:Dog[];bookings:Booking[];settings:Settings};
export const initial:DB={owners:[{id:'o1',name:'Anna Kowalska',phone:'501 234 567'},{id:'o2',name:'Jan Nowak',phone:'600 111 222'}],dogs:[{id:'d1',ownerId:'o1',name:'Luna',size:'small',weight:'6'},{id:'d2',ownerId:'o1',name:'Borys',size:'large',weight:'32'},{id:'d3',ownerId:'o2',name:'Reksio',size:'medium'}],bookings:[],settings:{rates:{small:70,medium:80,large:100},depositPercent:30,cleaningMinutes:60,specialPeriods:[]}};
export const sizeLabel:Record<Size,string>={small:'Mały',medium:'Średni',large:'Duży'};
export const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
export const parseLocal=(date:string,time:string)=>{const [y,m,d]=date.split('-').map(Number);const [h,min]=time.split(':').map(Number);return new Date(y,m-1,d,h,min).toISOString()};
export const displayDate=(s:string)=>new Date(s).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const validInterval=(start:string,end:string)=>Number.isFinite(Date.parse(start))&&Number.isFinite(Date.parse(end))&&Date.parse(end)>Date.parse(start);
export const available=(db:DB,kennel:number,arrival:string,departure:string,exclude?:string)=>{
 if(!validInterval(arrival,departure))return false;
 return !db.bookings.some(b=>b.id!==exclude&&b.kennel===kennel&&b.status!=='cancelled'&&Date.parse(arrival)<Date.parse(b.departure)+db.settings.cleaningMinutes*60000&&Date.parse(b.arrival)<Date.parse(departure));
};
export const freeKennels=(db:DB,a:string,d:string,exclude?:string)=>Array.from({length:9},(_,i)=>i+1).filter(k=>available(db,k,a,d,exclude));
const dayKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function quote(db:DB,dogIds:string[],arrival:string,departure:string):{total:number|null;days:number;details:string[];missing:string[]}{
 if(!validInterval(arrival,departure))return {total:null,days:0,details:[],missing:['Nieprawidłowy termin']};
 const dogs=dogIds.map(id=>db.dogs.find(d=>d.id===id)).filter((d):d is Dog=>!!d);
 if(!dogs.length)return {total:null,days:0,details:[],missing:['Wybierz psa']};
 const ms=Date.parse(departure)-Date.parse(arrival);const days=Math.max(1,Math.ceil(ms/86400000));
 let total=0;const details:string[]=[];const missing:string[]=[];
 // MVP: pełne 24-godzinne okresy liczone od przyjazdu; konfiguracja regulaminu wymaga zatwierdzenia.
 for(let i=0;i<days;i++){
  const start=new Date(Date.parse(arrival)+i*86400000);const key=dayKey(start);
  const special=db.settings.specialPeriods.find(p=>p.from<=key&&p.to>=key);
  const sorted=[...dogs].sort((a,b)=>({small:0,medium:1,large:2}[b.size]-{small:0,medium:1,large:2}[a.size]));
  const prices=sorted.map(d=>(special?.rates??db.settings.rates)[d.size]);
  if(prices.some(v=>!Number.isFinite(v)||v<0)){missing.push(`Brak stawki ${key}`);continue;}
  let day=prices.reduce((s,p)=>s+p,0);
  if(sorted.length===2){day-=prices[1]*.5;details.push(`${key}: ${day.toFixed(2)} zł (rabat 50% na mniejszego psa)`)}
  else {if(sorted.length>2){missing.push('Brak zatwierdzonej reguły dla 3+ psów');continue;}details.push(`${key}: ${day.toFixed(2)} zł`)}
  total+=day;
 }
 return {total:missing.length?null:Math.round(total*100)/100,days,details,missing};
}
