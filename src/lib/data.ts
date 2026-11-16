import { DB, Settings } from './types';
import { parseLocal, plusDays, today } from './dates';
import { depositFor, quote } from './pricing';

export const STORAGE_KEY = 'psotelgracja-v2';
export const LEGACY_KEYS = ['psotelgracja-v1'];

export const defaultSettings: Settings = {
  kennelCount: 9,
  rates: { small: 70, medium: 80, large: 100 },
  depositPercent: 30,
  cleaningMinutes: 60,
  specialPeriods: [],
};

export const emptyDb = (): DB => ({ version: 2, owners: [], dogs: [], bookings: [], settings: { ...defaultSettings } });

/** Dane przykładowe do przetestowania aplikacji. */
export const demoDb = (): DB => {
  const t = today();
  const db = emptyDb();
  db.owners = [
    { id: 'o1', name: 'Anna Kowalska', phone: '501 234 567' },
    { id: 'o2', name: 'Jan Nowak', phone: '600 111 222' },
    { id: 'o3', name: 'Maria Wiśniewska', phone: '503 400 500' },
  ];
  db.dogs = [
    { id: 'd1', ownerId: 'o1', name: 'Luna', size: 'small', weight: '6', color: 'pink' },
    { id: 'd2', ownerId: 'o1', name: 'Borys', size: 'large', weight: '32', color: 'brown' },
    { id: 'd3', ownerId: 'o2', name: 'Reksio', size: 'medium', color: 'orange' },
    { id: 'd4', ownerId: 'o3', name: 'Figa', size: 'small', notes: 'Karma własna, 2× dziennie', color: 'violet' },
  ];
  const mk = (id: string, ownerId: string, dogIds: string[], kennel: number, a: number, at: string, d: number, dt: string, status: DB['bookings'][0]['status']) => {
    const arrival = parseLocal(plusDays(t, a), at)!;
    const departure = parseLocal(plusDays(t, d), dt)!;
    const total = quote(db.settings, db.dogs.filter(x => dogIds.includes(x.id)), arrival, departure).total ?? 0;
    return { id, ownerId, dogIds, kennel, status, arrival, departure, total, deposit: depositFor(total, db.settings.depositPercent), paid: 0, createdAt: new Date().toISOString() };
  };
  db.bookings = [
    mk('b1', 'o1', ['d1', 'd2'], 1, -1, '10:00', 2, '15:00', 'checked_in'),
    mk('b2', 'o2', ['d3'], 2, 0, '12:00', 3, '12:00', 'reserved'),
    mk('b3', 'o3', ['d4'], 3, 2, '10:00', 5, '18:00', 'reserved'),
  ];
  return db;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Wczytuje dane z dowolnej wcześniejszej wersji (prototyp v1, kopia zapasowa) i
 * uzupełnia brakujące pola. Rzuca błąd z polskim komunikatem, jeśli dane są nieczytelne.
 */
export function migrate(raw: unknown): DB {
  if (!isObj(raw) || !Array.isArray(raw.owners) || !Array.isArray(raw.dogs) || !Array.isArray(raw.bookings))
    throw new Error('To nie jest plik z danymi Psotelgracji.');
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    ...defaultSettings,
    ...(s as Partial<Settings>),
    rates: { ...defaultSettings.rates, ...(isObj(s.rates) ? (s.rates as Settings['rates']) : {}) },
    specialPeriods: Array.isArray(s.specialPeriods) ? (s.specialPeriods as Settings['specialPeriods']) : [],
  };
  const bookings = (raw.bookings as Record<string, unknown>[]).map(b => ({
    ...b,
    // prototyp v1 (App.tsx) używał pól start/end
    arrival: (b.arrival ?? b.start) as string,
    departure: (b.departure ?? b.end) as string,
    total: typeof b.total === 'number' ? b.total : null,
    deposit: typeof b.deposit === 'number' ? b.deposit : 0,
    paid: typeof b.paid === 'number' ? b.paid : 0,
    dogIds: Array.isArray(b.dogIds) ? b.dogIds : [],
  })) as DB['bookings'];
  for (const b of bookings) {
    if (typeof b.id !== 'string' || !Number.isFinite(Date.parse(b.arrival)) || !Number.isFinite(Date.parse(b.departure)))
      throw new Error('Plik zawiera uszkodzoną rezerwację.');
  }
  return { version: 2, owners: raw.owners as DB['owners'], dogs: raw.dogs as DB['dogs'], bookings, settings };
}

export const serialize = (db: DB) => JSON.stringify({ ...db, exportedAt: new Date().toISOString() }, null, 2);
