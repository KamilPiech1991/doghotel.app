import { describe, expect, it } from 'vitest';
import { demoDb } from '../data';
import { parseLocal } from '../dates';
import { bookingPhase, filterHistory, monthLabel, plusMonths, summarize } from '../history';
import { Booking, DB } from '../types';

const at = (d: string, t = '10:00') => parseLocal(d, t)!;
const mk = (id: string, arrival: string, departure: string, status: Booking['status'], total = 100, paid = 0, dogIds = ['d1'], ownerId = 'o1'): Booking =>
  ({ id, ownerId, dogIds, kennel: 1, arrival: at(arrival), departure: at(departure), status, total, deposit: 30, paid, createdAt: '' });

const db = (): DB => {
  const d = demoDb();
  d.bookings = [
    mk('stary', '2025-03-01', '2025-03-04', 'checked_out', 210, 210),
    mk('anul', '2026-10-30', '2026-11-02', 'cancelled', 140),
    mk('pazdz', '2026-10-30', '2026-11-02', 'checked_out', 300, 100, ['d4'], 'o3'),
    mk('teraz', '2026-11-15', '2026-11-18', 'checked_in', 405, 0, ['d1', 'd2']),
    mk('przyszly', '2026-12-20', '2026-12-27', 'reserved', 700, 210, ['d3'], 'o2'),
  ];
  return d;
};
const now = Date.parse(at('2026-11-16', '12:00'));

describe('historia pobytów', () => {
  it('rozpoznaje etap pobytu', () => {
    const b = db().bookings;
    expect(b.map(x => bookingPhase(x, now))).toEqual(['finished', 'cancelled', 'finished', 'current', 'upcoming']);
    // rezerwacja, której termin minął bez potwierdzenia przyjazdu, jest zakończona
    expect(bookingPhase(mk('x', '2026-01-01', '2026-01-02', 'reserved'), now)).toBe('finished');
  });

  it('pokazuje wszystko od najnowszego, także stare i anulowane', () => {
    expect(filterHistory(db(), { query: '', phase: 'all', month: null }, now).map(b => b.id)).toEqual(['przyszly', 'teraz', 'anul', 'pazdz', 'stary']);
  });

  it('filtruje po miesiącu (pobyt na przełomie miesięcy jest w obu)', () => {
    const ids = (m: string) => filterHistory(db(), { query: '', phase: 'all', month: m }, now).map(b => b.id).sort();
    expect(ids('2026-11')).toEqual(['anul', 'pazdz', 'teraz']);
    expect(ids('2026-10')).toEqual(['anul', 'pazdz']);
    expect(ids('2025-03')).toEqual(['stary']);
  });

  it('szuka po psie, kliencie, telefonie i boksie – bez polskich znaków', () => {
    const q = (query: string) => filterHistory(db(), { query, phase: 'all', month: null }, now).map(b => b.id);
    expect(q('figa')).toEqual(['pazdz']);
    expect(q('wisniewska')).toEqual(['pazdz']);
    expect(q('600111222')).toEqual(['przyszly']);
    expect(q('borys luna')).toEqual(['teraz']);
  });

  it('filtruje po etapie', () => {
    expect(filterHistory(db(), { query: '', phase: 'finished', month: null }, now).map(b => b.id)).toEqual(['pazdz', 'stary']);
  });

  it('podsumowuje bez anulowanych', () => {
    const s = summarize(filterHistory(db(), { query: '', phase: 'all', month: '2026-11' }, now));
    expect(s).toEqual({ count: 2, cancelled: 1, dogs: 3, revenue: 705, paid: 100, unpaid: 605 });
  });

  it('nazwy i przesuwanie miesięcy', () => {
    expect(monthLabel('2026-11')).toBe('listopad 2026');
    expect(plusMonths('2026-12', 1)).toBe('2027-01');
    expect(plusMonths('2026-01', -1)).toBe('2025-12');
  });
});
