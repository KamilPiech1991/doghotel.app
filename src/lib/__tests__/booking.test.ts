import { describe, expect, it } from 'vitest';
import { arrivalsOn, bookingsOnDay, conflicts, freeKennels, isKennelFree, occupiedKennelsAt, validateBooking } from '../booking';
import { emptyDb } from '../data';
import { parseLocal } from '../dates';
import { Booking, DB } from '../types';

const at = (date: string, time: string) => parseLocal(date, time)!;

const withBooking = (b: Partial<Booking>): DB => {
  const db = emptyDb();
  db.owners = [{ id: 'o1', name: 'Anna', phone: '' }];
  db.dogs = [{ id: 'd1', ownerId: 'o1', name: 'Luna', size: 'small' }, { id: 'd9', ownerId: 'oX', name: 'Obcy', size: 'small' }];
  db.bookings = [{
    id: 'b1', ownerId: 'o1', dogIds: ['d1'], kennel: 1, status: 'reserved', total: 100, deposit: 30, paid: 0, createdAt: '',
    arrival: at('2026-12-10', '10:00'), departure: at('2026-12-12', '14:00'), ...b,
  }];
  return db;
};

describe('czas na sprzątanie (bufor)', () => {
  it('blokuje przyjazd zaraz PO istniejącym pobycie', () => {
    const db = withBooking({});
    expect(isKennelFree(db, 1, at('2026-12-12', '14:30'), at('2026-12-13', '10:00'))).toBe(false);
    expect(isKennelFree(db, 1, at('2026-12-12', '15:00'), at('2026-12-13', '10:00'))).toBe(true);
  });

  it('blokuje odbiór tuż PRZED istniejącym pobytem (błąd z prototypu)', () => {
    const db = withBooking({});
    // nowy pobyt kończy się 09:30, istniejący zaczyna się 10:00 – za mało czasu na sprzątanie (60 min)
    expect(isKennelFree(db, 1, at('2026-12-08', '10:00'), at('2026-12-10', '09:30'))).toBe(false);
    expect(isKennelFree(db, 1, at('2026-12-08', '10:00'), at('2026-12-10', '09:00'))).toBe(true);
  });

  it('bez bufora dopuszcza pobyty „styk w styk”', () => {
    expect(conflicts(at('2026-12-01', '10:00'), at('2026-12-02', '10:00'), at('2026-12-02', '10:00'), at('2026-12-03', '10:00'), 0)).toBe(false);
  });

  it('anulowane pobyty nie blokują boksu', () => {
    const db = withBooking({ status: 'cancelled' });
    expect(freeKennels(db, at('2026-12-10', '12:00'), at('2026-12-11', '12:00'))).toHaveLength(9);
  });

  it('edytowany pobyt nie koliduje sam ze sobą', () => {
    const db = withBooking({});
    expect(isKennelFree(db, 1, at('2026-12-10', '10:00'), at('2026-12-13', '14:00'), 'b1')).toBe(true);
  });
});

describe('dni lokalne', () => {
  it('pobyt z przyjazdem tuż po północy pokazuje się we właściwym dniu', () => {
    const db = withBooking({ arrival: at('2026-12-10', '00:30'), departure: at('2026-12-10', '23:30') });
    expect(bookingsOnDay(db, '2026-12-10')).toHaveLength(1);
    expect(bookingsOnDay(db, '2026-12-09')).toHaveLength(0);
    expect(arrivalsOn(db, '2026-12-10')).toHaveLength(1);
  });

  it('liczy zajęte boksy w danej chwili', () => {
    const db = withBooking({});
    expect(occupiedKennelsAt(db, Date.parse(at('2026-12-11', '12:00')))).toBe(1);
    expect(occupiedKennelsAt(db, Date.parse(at('2026-12-13', '12:00')))).toBe(0);
  });
});

describe('walidacja rezerwacji', () => {
  it('przepuszcza poprawny szkic', () => {
    const db = withBooking({ status: 'cancelled' });
    expect(validateBooking(db, { ownerId: 'o1', dogIds: ['d1'], kennel: 1, arrival: at('2026-12-10', '10:00'), departure: at('2026-12-11', '10:00') })).toEqual([]);
  });

  it('odrzuca psa innego właściciela, zły termin i zajęty boks', () => {
    const db = withBooking({});
    expect(validateBooking(db, { ownerId: 'o1', dogIds: ['d9'], kennel: 1, arrival: null, departure: null }).length).toBe(2);
    expect(validateBooking(db, { ownerId: 'o1', dogIds: ['d1'], kennel: 1, arrival: at('2026-12-11', '10:00'), departure: at('2026-12-12', '10:00') })[0]).toMatch(/zajęty/);
  });
});
