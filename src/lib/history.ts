import { Booking, DB } from './types';

export type Phase = 'upcoming' | 'current' | 'finished' | 'cancelled';
export type PhaseFilter = 'all' | Phase;

export const phaseLabel: Record<PhaseFilter, string> = {
  all: 'Wszystkie',
  upcoming: 'Nadchodzące',
  current: 'Trwające',
  finished: 'Zakończone',
  cancelled: 'Anulowane',
};

/** Etap pobytu względem „teraz”. Pies na miejscu (checked_in) to zawsze pobyt trwający, nawet po terminie odbioru. */
export function bookingPhase(b: Booking, now = Date.now()): Phase {
  if (b.status === 'cancelled') return 'cancelled';
  if (b.status === 'checked_out') return 'finished';
  if (b.status === 'checked_in') return 'current';
  if (Date.parse(b.departure) <= now) return 'finished';
  if (Date.parse(b.arrival) <= now) return 'current';
  return 'upcoming';
}

const months = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

/** „2026-11” → „listopad 2026” */
export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${months[m - 1]} ${y}`;
};

export const monthOf = (dateKey: string) => dateKey.slice(0, 7);

export const plusMonths = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Zakres lokalnego miesiąca w ms: [początek, początek następnego). */
export const monthRange = (month: string): [number, number] => {
  const [y, m] = month.split('-').map(Number);
  return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()];
};

export type HistoryFilter = { query: string; phase: PhaseFilter; month: string | null };

const norm = (s: string) => s.toLocaleLowerCase('pl').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/** Pobyty spełniające filtr, od najnowszego przyjazdu. Miesiąc = pobyt choć częściowo w tym miesiącu. */
export function filterHistory(db: DB, f: HistoryFilter, now = Date.now()): Booking[] {
  const words = norm(f.query.trim()).split(/\s+/).filter(Boolean);
  const range = f.month ? monthRange(f.month) : null;
  return db.bookings
    .filter(b => {
      if (f.phase !== 'all' && bookingPhase(b, now) !== f.phase) return false;
      if (range && !(Date.parse(b.arrival) < range[1] && Date.parse(b.departure) > range[0])) return false;
      if (!words.length) return true;
      const owner = db.owners.find(o => o.id === b.ownerId);
      const dogs = db.dogs.filter(d => b.dogIds.includes(d.id)).map(d => d.name).join(' ');
      const text = norm(`${dogs} ${owner?.name ?? ''} ${owner?.phone ?? ''} ${(owner?.phone ?? '').replace(/\s/g, '')} boks ${b.kennel} ${b.notes ?? ''}`);
      return words.every(w => text.includes(w));
    })
    .sort((a, b) => b.arrival.localeCompare(a.arrival));
}

export type Summary = { count: number; cancelled: number; dogs: number; revenue: number; paid: number; unpaid: number };

/** Podsumowanie listy pobytów; anulowane nie liczą się do przychodu. */
export function summarize(bookings: Booking[]): Summary {
  const active = bookings.filter(b => b.status !== 'cancelled');
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const revenue = r2(active.reduce((s, b) => s + (b.total ?? 0), 0));
  const paid = r2(active.reduce((s, b) => s + b.paid, 0));
  return {
    count: active.length,
    cancelled: bookings.length - active.length,
    dogs: new Set(active.flatMap(b => b.dogIds)).size,
    revenue,
    paid,
    unpaid: r2(Math.max(0, active.reduce((s, b) => s + Math.max(0, (b.total ?? 0) - b.paid), 0))),
  };
}

/** Ostatnie pobyty jednego psa (do karty klienta). */
export const dogStays = (db: DB, dogId: string) =>
  db.bookings.filter(b => b.dogIds.includes(dogId) && b.status !== 'cancelled').sort((a, b) => b.arrival.localeCompare(a.arrival));

