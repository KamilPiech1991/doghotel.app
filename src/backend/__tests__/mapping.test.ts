import { describe, expect, it } from 'vitest';
import { demoDb } from '../../lib/data';
import { bookingFromRow, bookingToRow, dogFromRow, dogToRow, friendlyError, ownerFromRow, ownerToRow, settingsFromRow } from '../mapping';

describe('mapowanie wierszy bazy', () => {
  const db = demoDb();

  it('klient, pies i pobyt przechodzą w obie strony bez zmian', () => {
    db.owners.forEach(o => expect(ownerFromRow(ownerToRow(o))).toEqual(o));
    db.dogs.forEach(d => expect(dogFromRow(dogToRow(d))).toEqual(d));
    db.bookings.forEach(b => expect(bookingFromRow(bookingToRow(b))).toEqual(b));
  });

  it('kwoty numeric (tekst z PostgreSQL) i daty z przesunięciem strefy', () => {
    const b = bookingFromRow({ ...bookingToRow(db.bookings[0]), total: '405.00', paid: '10.50', deposit: '121.5', arrival: '2026-12-10 10:00:00+01' });
    expect(b.total).toBe(405);
    expect(b.paid).toBe(10.5);
    expect(b.arrival).toBe('2026-12-10T09:00:00.000Z');
  });

  it('ustawienia', () => {
    expect(settingsFromRow({ kennel_count: 9, rates: { small: 1, medium: 2, large: 3 }, deposit_percent: '30.00', cleaning_minutes: 60, special_periods: [] }).depositPercent).toBe(30);
  });

  it('komunikaty błędów po polsku', () => {
    expect(friendlyError({ code: 'P0001', message: 'Boks 1 jest zajęty' })).toBe('Boks 1 jest zajęty');
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/internetem/);
    expect(friendlyError({ message: 'Invalid login credentials' })).toMatch(/hasło/);
    expect(friendlyError({ code: '42501', message: 'x' })).toMatch(/uprawnień/);
  });
});
