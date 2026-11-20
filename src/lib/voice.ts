// Rozumienie polecenia głosowego (tekstu z rozpoznawania mowy) – rezerwacja psa.
// Przykłady: „Luna od piątku do niedzieli”, „Reksio od 22 grudnia do 28 grudnia o 10”,
// „Lunę i Borysa od jutra na 3 dni, boks 4”, „Figa 5.12 – 7.12 odbiór o 18:30”.
// Wszystko liczone lokalnie, bez wysyłania danych gdziekolwiek.

import { DB, Dog } from './types';
import { isValidDateKey, plusDays, fromKey } from './dates';
import { freeKennels, kennelNumbers } from './booking';
import { parseLocal } from './dates';

export type VoiceDraft = {
  text: string;
  /** Rozpoznane psy (jednego właściciela). */
  dogs: Dog[];
  /** Gdy imię pasuje do kilku psów różnych właścicieli – do wyboru. */
  candidates: Dog[];
  ownerId: string | null;
  arrivalDate: string | null;
  arrivalTime: string;
  departureDate: string | null;
  departureTime: string;
  /** Boks podany głosem (może być zajęty). */
  requestedKennel: number | null;
  /** Boks proponowany do zapisu: podany i wolny albo pierwszy wolny. */
  kennel: number | null;
  problems: string[];
  notes: string[];
};

export const DEFAULT_ARRIVAL_TIME = '10:00';
export const DEFAULT_DEPARTURE_TIME = '15:00';

// ---------- normalizacja ----------

export const normalize = (s: string) =>
  s
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

// ---------- liczebniki ----------

const ordinalUnits: Record<string, number> = {
  pierwszego: 1, pierwszy: 1, drugiego: 2, drugi: 2, trzeciego: 3, trzeci: 3, czwartego: 4, czwarty: 4,
  piatego: 5, piaty: 5, szostego: 6, szosty: 6, siodmego: 7, siodmy: 7, osmego: 8, osmy: 8,
  dziewiatego: 9, dziewiaty: 9,
};
const ordinalTeens: Record<string, number> = {
  dziesiatego: 10, dziesiaty: 10, jedenastego: 11, jedenasty: 11, dwunastego: 12, dwunasty: 12,
  trzynastego: 13, trzynasty: 13, czternastego: 14, czternasty: 14, pietnastego: 15, pietnasty: 15,
  szesnastego: 16, szesnasty: 16, siedemnastego: 17, siedemnasty: 17, osiemnastego: 18, osiemnasty: 18,
  dziewietnastego: 19, dziewietnasty: 19,
};
const ordinalTens: Record<string, number> = { dwudziestego: 20, dwudziesty: 20, trzydziestego: 30, trzydziesty: 30 };

/** Godziny słownie: „o dziesiątej”, „o wpół do dziewiątej”. */
const hourWords: Record<string, number> = {
  pierwszej: 1, drugiej: 2, trzeciej: 3, czwartej: 4, piatej: 5, szostej: 6, siodmej: 7, osmej: 8,
  dziewiatej: 9, dziesiatej: 10, jedenastej: 11, dwunastej: 12, trzynastej: 13, czternastej: 14,
  pietnastej: 15, szesnastej: 16, siedemnastej: 17, osiemnastej: 18, dziewietnastej: 19, dwudziestej: 20,
};

const cardinals: Record<string, number> = {
  jeden: 1, jedna: 1, jedno: 1, dwa: 2, dwie: 2, dwoch: 2, trzy: 3, trzech: 3, cztery: 4, czterech: 4,
  piec: 5, pieciu: 5, szesc: 6, szesciu: 6, siedem: 7, siedmiu: 7, osiem: 8, osmiu: 8, dziewiec: 9,
  dziewieciu: 9, dziesiec: 10, dziesieciu: 10, jedenascie: 11, dwanascie: 12, trzynascie: 13, czternascie: 14,
};

/** Zamienia słowne liczebniki porządkowe na cyfry: „dwudziestego drugiego” → „22”. */
function ordinalsToDigits(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (ordinalTens[w] !== undefined) {
      const next = words[i + 1];
      if (next !== undefined && ordinalUnits[next] !== undefined) {
        out.push(String(ordinalTens[w] + ordinalUnits[next]));
        i++;
      } else out.push(String(ordinalTens[w]));
    } else if (ordinalTeens[w] !== undefined) out.push(String(ordinalTeens[w]));
    else if (ordinalUnits[w] !== undefined && /^(pierwsz|drug|trzec|czwart|piat|szost|siodm|osm|dziewiat)/.test(w)) {
      // „pierwszego grudnia”, ale nie „drugi pies” – tylko gdy dalej jest miesiąc albo „od/do”
      const next = words[i + 1] ?? '';
      const prev = out[out.length - 1] ?? '';
      if (monthOf(next) || /^(od|do)$/.test(prev)) out.push(String(ordinalUnits[w]));
      else out.push(w);
    } else out.push(w);
  }
  return out;
}

// ---------- miesiące i dni tygodnia ----------

const monthPrefixes: [RegExp, number][] = [
  [/^stycz/, 1], [/^lut/, 2], [/^mar(c|z)/, 3], [/^kwie(t|c)/, 4], [/^maj/, 5], [/^czerw/, 6],
  [/^lip/, 7], [/^sierp/, 8], [/^wrze(s|ś)/, 9], [/^pazdziern/, 10], [/^listopad/, 11], [/^grud/, 12],
];
function monthOf(word: string): number | null {
  for (const [re, m] of monthPrefixes) if (re.test(word)) return m;
  return null;
}

const weekdayPrefixes: [RegExp, number][] = [
  [/^poniedzial/, 1], [/^wtor/, 2], [/^srod/, 3], [/^czwart(ek|ku)$/, 4], [/^piat(ek|ku)$/, 5], [/^sobot/, 6], [/^niedziel/, 0],
];
function weekdayOf(word: string): number | null {
  for (const [re, d] of weekdayPrefixes) if (re.test(word)) return d;
  return null;
}

// ---------- dopasowanie imion ----------

const levenshtein = (a: string, b: string) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};

/** Czy słowo z wypowiedzi to (odmienione) imię: „Lunę” ≈ „Luna”, „Reksia” ≈ „Reksio”, „Borysa” ≈ „Borys”. */
export function nameMatches(word: string, name: string): boolean {
  const w = normalize(word);
  const n = normalize(name);
  if (!w || !n) return false;
  if (w === n) return true;
  if (n.length < 3 || w.length < 3) return false;
  let p = 0;
  while (p < w.length && p < n.length && w[p] === n[p]) p++;
  if (p >= Math.max(3, n.length - 2) && Math.abs(w.length - n.length) <= 3) return true;
  return n.length >= 4 && Math.abs(w.length - n.length) <= 1 && levenshtein(w, n) <= 1;
}

const stopWords = new Set([
  'od', 'do', 'i', 'oraz', 'z', 'na', 'o', 'w', 'we', 'boks', 'boksie', 'boksu', 'kojec', 'kojca', 'kojcu',
  'przyjazd', 'przyjazdu', 'odbior', 'odbioru', 'wyjazd', 'dzis', 'dzisiaj', 'jutro', 'jutra', 'pojutrze',
  'rezerwacja', 'rezerwuje', 'zarezerwuj', 'pies', 'psa', 'psy', 'piesek', 'pieska', 'godzinie', 'godz',
  'dni', 'dzien', 'doby', 'dob', 'noce', 'nocy', 'tydzien', 'tygodnie', 'przyszly', 'przyszla', 'przyszlego',
  'nastepny', 'nastepna', 'nastepnego', 'wpol', 'rano', 'wieczorem', 'poludnie', 'poludniu',
]);

function findDogs(words: string[], db: DB): { dogs: Dog[]; candidates: Dog[]; problems: string[] } {
  const usable = words.filter(w => !stopWords.has(w) && !/^\d/.test(w) && !monthOf(w) && weekdayOf(w) === null);
  const hits = db.dogs.filter(d => {
    const parts = normalize(d.name).split(/\s+/);
    return parts.every(part => usable.some(w => nameMatches(w, part)));
  });
  if (!hits.length) return { dogs: [], candidates: [], problems: ['Nie rozpoznano psa. Powiedz imię psa z kartoteki (np. „Luna od piątku do niedzieli”).'] };

  // jeśli wymieniono też nazwisko/imię właściciela – zawęź
  const ownerHit = (ownerId: string) => {
    const o = db.owners.find(x => x.id === ownerId);
    return !!o && normalize(o.name).split(/\s+/).some(part => part.length >= 3 && usable.some(w => nameMatches(w, part)));
  };
  let pool = hits;
  const byOwnerName = hits.filter(d => ownerHit(d.ownerId));
  if (byOwnerName.length) pool = byOwnerName;

  const owners = [...new Set(pool.map(d => d.ownerId))];
  if (owners.length === 1) return { dogs: pool, candidates: [], problems: [] };
  return { dogs: [], candidates: pool, problems: ['To imię ma kilka psów różnych właścicieli – wybierz właściwego.'] };
}

// ---------- daty i godziny ----------

type DateHit = { pos: number; date?: string; day?: number; month?: number; year?: number; weekday?: number; next?: boolean; role?: 'from' | 'to' };
type TimeHit = { pos: number; time: string };

const pad = (n: number) => String(n).padStart(2, '0');

function normalizeHour(h: number, m: number): string | null {
  if (h > 23 || m > 59) return null;
  // „o 5” w hotelu oznacza 17:00 (godziny pracy 8:30–20:30)
  if (h >= 1 && h <= 7) h += 12;
  return `${pad(h)}:${pad(m)}`;
}

/** Najbliższy podany dzień tygodnia: >= start (gdy inclusive) albo > start. */
function nextWeekday(start: string, weekday: number, inclusive: boolean): string {
  let d = inclusive ? start : plusDays(start, 1);
  for (let i = 0; i < 7; i++) {
    if (fromKey(d).getDay() === weekday) return d;
    d = plusDays(d, 1);
  }
  return d;
}

/** Data z dnia i miesiąca: rok bieżący, a jeśli już minęła – następny. */
function resolveDayMonth(day: number, month: number, year: number | undefined, notBefore: string): string | null {
  const today = fromKey(notBefore);
  let y = year ?? today.getFullYear();
  if (y < 100) y += 2000;
  let key = `${y}-${pad(month)}-${pad(day)}`;
  if (!isValidDateKey(key)) return null;
  if (year === undefined && key < notBefore) key = `${y + 1}-${pad(month)}-${pad(day)}`;
  return isValidDateKey(key) ? key : null;
}

export function parseVoiceBooking(text: string, db: DB, today: string): VoiceDraft {
  const problems: string[] = [];
  const notes: string[] = [];
  const raw = normalize(text)
    .replace(/(\d)\s*[-–—]\s*(go|ego|ty|ma|ga)\b/g, '$1') // „22-go” → „22”
    .replace(/(\d{1,2})\s*[-–—]\s*(\d{1,2}[.\/]\d{1,2})/g, '$1 do $2'); // „5.12–7.12”
  const tokens = ordinalsToDigits(raw.replace(/[,;!?„”"()]/g, ' ').split(/\s+/).filter(Boolean));
  const t = tokens.join(' ');

  // --- boks
  let requestedKennel: number | null = null;
  const kennelMatch = /\b(?:boks\w*|kojc\w*|kojec)\s*(?:nr|numer)?\s*(\d{1,2}|[a-z]+)\b/.exec(t);
  if (kennelMatch) {
    const v = /^\d+$/.test(kennelMatch[1]) ? Number(kennelMatch[1]) : cardinals[kennelMatch[1]] ?? null;
    if (v) requestedKennel = v;
  }
  const s = kennelMatch ? t.replace(kennelMatch[0], ' ') : t;

  // --- godziny
  const times: TimeHit[] = [];
  const timeRe = /\b(?:o|na|godz(?:ina|inie)?)\s+(?:godzinie\s+)?(\d{1,2})(?:[:.](\d{2}))?(?!\s*[.\/]\d)(?!\s*(?:dni|dzien|doby|dob|noc|nocy|noce|tydz|tyg|stycz|lut|mar|kwie|maj|czerw|lip|sierp|wrze|pazdz|listop|grud))\b/g;
  for (const m of s.matchAll(timeRe)) {
    const hhmm = normalizeHour(Number(m[1]), m[2] ? Number(m[2]) : 0);
    if (hhmm) times.push({ pos: m.index!, time: hhmm });
  }
  for (const m of s.matchAll(/\b(\d{1,2}):(\d{2})\b/g)) {
    if (times.some(x => Math.abs(x.pos - m.index!) < 12)) continue;
    const hhmm = normalizeHour(Number(m[1]), Number(m[2]));
    if (hhmm) times.push({ pos: m.index!, time: hhmm });
  }
  for (const m of s.matchAll(/\bwpol\s+do\s+([a-z]+)\b/g)) {
    const h = hourWords[m[1]];
    if (h) times.push({ pos: m.index!, time: normalizeHour(h - 1, 30)! });
  }
  for (const m of s.matchAll(/\bo\s+([a-z]+)(?:\s+(trzydziesci|pietnascie|czterdziesci piec))?\b/g)) {
    const h = hourWords[m[1]];
    if (!h || times.some(x => x.pos === m.index)) continue;
    const min = m[2] === 'trzydziesci' ? 30 : m[2] === 'pietnascie' ? 15 : m[2] ? 45 : 0;
    times.push({ pos: m.index!, time: normalizeHour(h, min)! });
  }

  // --- daty
  const dates: DateHit[] = [];
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && x < b);
  const add = (m: RegExpMatchArray, hit: Omit<DateHit, 'pos'>) => {
    const a = m.index!, b = a + m[0].length;
    if (!free(a, b)) return;
    taken.push([a, b]);
    dates.push({ pos: a, ...hit });
  };

  for (const m of s.matchAll(/\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/g))
    add(m, { day: Number(m[1]), month: Number(m[2]), year: m[3] ? Number(m[3]) : undefined });
  for (const m of s.matchAll(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/g)) {
    const month = monthOf(m[2]);
    if (month) add(m, { day: Number(m[1]), month, year: m[3] ? Number(m[3]) : undefined });
  }
  for (const m of s.matchAll(/\b(dzis|dzisiaj|teraz|jutro|jutra|jutrze|pojutrze)\b/g))
    add(m, { date: plusDays(today, m[1] === 'pojutrze' ? 2 : m[1].startsWith('jutr') ? 1 : 0) });
  for (const m of s.matchAll(/\b(?:(przysz\w*|nastepn\w*)\s+)?([a-z]+)\b/g)) {
    const wd = weekdayOf(m[2]);
    if (wd !== null) add(m, { weekday: wd, next: !!m[1] });
  }
  // sam numer dnia po „od”/„do”: „od 22 do 28 grudnia”
  for (const m of s.matchAll(/\b(od|do)\s+(\d{1,2})\b(?!\s*[:.\/]\d)/g)) {
    const a = m.index! + m[1].length + 1;
    if (!free(a, a + m[2].length)) continue;
    if (times.some(x => x.pos <= a && a <= x.pos + 12)) continue;
    taken.push([a, a + m[2].length]);
    dates.push({ pos: a, day: Number(m[2]) });
  }
  dates.sort((a, b) => a.pos - b.pos);

  // rola z kontekstu: słowo przed datą
  for (const d of dates) {
    const before = s.slice(Math.max(0, d.pos - 18), d.pos);
    if (/\b(do|odbior\w*|wyjazd\w*|odbierz\w*|wyjedzie|koniec)\s+(?:w\s+|we\s+)?$/.test(before)) d.role = 'to';
    else if (/\b(od|przyjazd\w*|przyjedzie|przywiez\w*|start)\s+(?:w\s+|we\s+)?$/.test(before)) d.role = 'from';
  }

  // --- długość pobytu: „na 3 dni”, „na tydzień”
  let durationDays: number | null = null;
  const dur = /\bna\s+(\d{1,2}|[a-z]+)\s+(dni|dzien|doby|dob|noc|nocy|noce)\b/.exec(s);
  if (dur) durationDays = /^\d+$/.test(dur[1]) ? Number(dur[1]) : cardinals[dur[1]] ?? null;
  else if (/\bna\s+(caly\s+)?tydzien\b/.test(s)) durationDays = 7;
  else if (/\bna\s+(dwa|2)\s+tygodnie\b/.test(s)) durationDays = 14;
  else if (/\bna\s+weekend\b/.test(s)) durationDays = 2;

  // przypisanie: przyjazd i odbiór
  let fromHit = dates.find(d => d.role === 'from') ?? dates.find(d => d.role !== 'to');
  let toHit = dates.find(d => d !== fromHit && d.role === 'to') ?? dates.find(d => d !== fromHit && d.pos > (fromHit?.pos ?? -1));
  if (fromHit && fromHit.role === 'to' && !toHit) { toHit = fromHit; fromHit = undefined; }

  const resolve = (h: DateHit | undefined, ref: string, after: boolean, monthHint?: number): string | null => {
    if (!h) return null;
    if (h.date) return h.date;
    if (h.weekday !== undefined) {
      let d = nextWeekday(ref, h.weekday, !after);
      if (h.next) d = plusDays(d, 7);
      return d;
    }
    if (h.day && h.month) return resolveDayMonth(h.day, h.month, h.year, ref);
    if (h.day) {
      // tylko dzień – miesiąc z drugiej daty albo najbliższy pasujący
      const base = fromKey(ref);
      const months = monthHint ? [monthHint] : [base.getMonth() + 1, ((base.getMonth() + 1) % 12) + 1];
      for (const m of months) {
        const k = resolveDayMonth(h.day, m, undefined, ref);
        if (k && (!after || k > ref)) return k;
      }
      return null;
    }
    return null;
  };

  const arrivalMonthHint = fromHit && fromHit.day && !fromHit.month ? toHit?.month : undefined;
  const arrivalDate = resolve(fromHit, today, false, arrivalMonthHint);
  let departureDate: string | null = null;
  if (toHit) departureDate = resolve(toHit, arrivalDate ?? today, true, toHit.day && !toHit.month ? fromHit?.month : undefined);
  if (!departureDate && arrivalDate && durationDays) departureDate = plusDays(arrivalDate, durationDays);

  // --- godziny: do najbliższej wcześniejszej daty
  let arrivalTime = DEFAULT_ARRIVAL_TIME;
  let departureTime = DEFAULT_DEPARTURE_TIME;
  let arrivalTimeSet = false;
  let departureTimeSet = false;
  for (const tm of times.sort((a, b) => a.pos - b.pos)) {
    const ctx = s.slice(Math.max(0, tm.pos - 30), tm.pos);
    const isTo = /\b(odbior\w*|wyjazd\w*|odbierz\w*|wyjedzie)\b[^,]*$/.test(ctx);
    const isFrom = /\b(przyjazd\w*|przyjedzie|przywiez\w*)\b[^,]*$/.test(ctx);
    const afterTo = toHit && tm.pos > toHit.pos;
    const afterFrom = fromHit && tm.pos > fromHit.pos;
    if (isTo || (!isFrom && afterTo) || (!isFrom && arrivalTimeSet && !departureTimeSet)) {
      if (!departureTimeSet) { departureTime = tm.time; departureTimeSet = true; }
    } else if (isFrom || afterFrom || !arrivalTimeSet) {
      if (!arrivalTimeSet) { arrivalTime = tm.time; arrivalTimeSet = true; }
    }
  }

  // --- psy
  const { dogs, candidates, problems: dogProblems } = findDogs(tokens, db);
  problems.push(...dogProblems);

  if (!arrivalDate) problems.push('Brak dnia przyjazdu – powiedz np. „od piątku” albo „od 22 grudnia”.');
  if (!departureDate) problems.push('Brak dnia odbioru – powiedz np. „do niedzieli”, „do 28 grudnia” albo „na 3 dni”.');
  if (arrivalDate && arrivalDate < today) problems.push('Dzień przyjazdu jest w przeszłości.');

  const arrival = arrivalDate ? parseLocal(arrivalDate, arrivalTime) : null;
  const departure = departureDate ? parseLocal(departureDate, departureTime) : null;
  if (arrival && departure && Date.parse(departure) <= Date.parse(arrival)) problems.push('Odbiór musi być później niż przyjazd.');

  // --- boks: podany (jeśli wolny) albo pierwszy wolny
  let kennel: number | null = null;
  if (arrival && departure && Date.parse(departure) > Date.parse(arrival)) {
    const freeList = freeKennels(db, arrival, departure);
    if (requestedKennel !== null && !kennelNumbers(db).includes(requestedKennel)) {
      problems.push(`Boks ${requestedKennel} nie istnieje.`);
    } else if (requestedKennel !== null && freeList.includes(requestedKennel)) kennel = requestedKennel;
    else if (requestedKennel !== null) {
      kennel = freeList[0] ?? null;
      notes.push(kennel ? `Boks ${requestedKennel} jest zajęty w tym terminie – proponuję boks ${kennel}.` : `Boks ${requestedKennel} jest zajęty.`);
    } else kennel = freeList[0] ?? null;
    if (kennel === null) problems.push('Brak wolnego boksu w tym terminie.');
  }
  if (!arrivalTimeSet) notes.push(`Godzina przyjazdu nie została podana – przyjęto ${DEFAULT_ARRIVAL_TIME}.`);
  if (!departureTimeSet) notes.push(`Godzina odbioru nie została podana – przyjęto ${DEFAULT_DEPARTURE_TIME}.`);

  return {
    text, dogs, candidates, ownerId: dogs[0]?.ownerId ?? null,
    arrivalDate, arrivalTime, departureDate, departureTime,
    requestedKennel, kennel, problems, notes,
  };
}

/** Ponowne przeliczenie boksu po wybraniu psa z kandydatów (bez zmiany dat). */
export function chooseDog(draft: VoiceDraft, dog: Dog): VoiceDraft {
  return { ...draft, dogs: [dog], candidates: [], ownerId: dog.ownerId, problems: draft.problems.filter(p => !p.startsWith('To imię ma kilka psów')) };
}

