// Wszystkie operacje na dniach liczone są w czasie LOKALNYM urządzenia (Polska),
// a nie w UTC. Momenty (przyjazd/odbiór) przechowujemy jako ISO, ale dzień kalendarzowy
// zawsze wyliczamy z czasu lokalnego, żeby pobyt nie „przeskakiwał” na sąsiedni dzień.

const pad = (n: number) => String(n).padStart(2, '0');

export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = (now = new Date()) => dateKey(now);

/** Data lokalna (południe – bezpieczne przy zmianie czasu) z klucza RRRR-MM-DD. */
export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

export const plusDays = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

export const isValidDateKey = (key: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

export const isValidTime = (time: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
};

/** Łączy lokalną datę i godzinę w moment ISO. Zwraca null, gdy dane są niepoprawne. */
export const parseLocal = (date: string, time: string): string | null => {
  if (!isValidDateKey(date) || !isValidTime(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
};

export const localDateKey = (iso: string) => dateKey(new Date(iso));

export const localTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Początek i koniec lokalnego dnia w milisekundach: [start, end). */
export const dayRange = (key: string): [number, number] => {
  const [y, m, d] = key.split('-').map(Number);
  return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()];
};

/** Poniedziałek tygodnia, w którym leży dany dzień. */
export const weekStart = (key: string) => {
  const day = fromKey(key).getDay(); // 0 = niedziela
  return plusDays(key, day === 0 ? -6 : 1 - day);
};

const weekdaysShort = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const weekdays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

export const weekdayShort = (key: string) => weekdaysShort[fromKey(key).getDay()];

/** np. „poniedziałek, 16 listopada 2026” – bez zależności od Intl. */
export const displayDay = (key: string) => {
  const d = fromKey(key);
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

/** np. „16.11.2026, 10:00” */
export const displayDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** np. „16.11” */
export const displayShort = (key: string) => {
  const d = fromKey(key);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

/** Polska odmiana: plural(3, 'doba', 'doby', 'dób') → „doby”. */
export const plural = (n: number, one: string, few: string, many: string) => {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

/** 1234.5 → „1234,50 zł” */
export const pln = (n: number) => `${n.toFixed(2).replace('.', ',')} zł`;
