export type Size = 'small'|'medium'|'large';
export type Owner = {id:string;name:string;phone:string};
export type Dog = {id:string;ownerId:string;name:string;size:Size;weight?:string};
export type Booking = {id:string;ownerId:string;dogIds:string[];kennel:number;start:string;end:string;status:'reserved'|'checked_in'|'checked_out'|'cancelled';total?:number;createdAt:string};
export type State = {owners:Owner[];dogs:Dog[];bookings:Booking[]};
export const sizeLabel:Record<Size,string>={small:'Mały',medium:'Średni',large:'Duży'};
export const demo:State={owners:[{id:'o1',name:'Anna Kowalska',phone:'501 200 300'},{id:'o2',name:'Jan Nowak',phone:'502 300 400'},{id:'o3',name:'Maria Wiśniewska',phone:'503 400 500'}],dogs:[{id:'d1',ownerId:'o1',name:'Luna',size:'small'},{id:'d2',ownerId:'o1',name:'Borys',size:'large'},{id:'d3',ownerId:'o2',name:'Reksio',size:'medium'},{id:'d4',ownerId:'o3',name:'Figa',size:'small'}],bookings:[]};
export const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const plusDays=(d:Date,n:number)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r};
export const toISO=(day:string,time:string)=>new Date(`${day}T${time}:00`).toISOString();
export const displayDate=(iso:string)=>new Date(iso).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const overlaps=(aStart:string,aEnd:string,bStart:string,bEnd:string)=>Date.parse(aStart)<Date.parse(bEnd)&&Date.parse(bStart)<Date.parse(aEnd);
export function available(s:State,kennel:number,start:string,end:string,ignoreId?:string){return !s.bookings.some(b=>b.id!==ignoreId&&b.kennel===kennel&&b.status!=='cancelled'&&overlaps(start,end,b.start,b.end))}
export const dailyRates:Record<Size,number>={small:70,medium:80,large:100}; // WYŁĄCZNIE DEMO, nie zatwierdzony cennik
export function previewPrice(dogs:Dog[],start:string,end:string){const days=Math.max(1,Math.ceil((Date.parse(end)-Date.parse(start))/86400000));const sorted=[...dogs].sort((a,b)=>dailyRates[b.size]-dailyRates[a.size]);const daily=sorted.reduce((v,d,i)=>v+dailyRates[d.size]*(i===1&&sorted.length===2?.5:1),0);return {days,daily,total:daily*days,illustrative:true};}
export function parseVoiceDemo(text:string,now=new Date()) {const t=text.toLocaleLowerCase('pl-PL');const names=['luna','borys','reksio','figa'].filter(n=>t.includes(n));const dates=[...t.matchAll(/\b(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{4}))?\b/g)].map(m=>`${m[3]||now.getFullYear()}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);const hours=[...t.matchAll(/(?:o godzinie|godzina|o)\s*(\d{1,2})(?:[:.]([0-5]\d))?/g)].map(m=>`${m[1].padStart(2,'0')}:${m[2]||'00'}`);const kennel=t.match(/(?:boks(?:u|ie)?|do boksu)\s*(?:numer\s*)?(\d)/);return {names,dates,hours,kennel:kennel?Number(kennel[1]):undefined};}
