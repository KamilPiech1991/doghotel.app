import { describe, expect, it } from 'vitest';
import { demoDb, migrate, serialize } from '../data';

describe('dane i kopia zapasowa', () => {
  it('kopia zapasowa wczytuje się bez zmian', () => {
    const db = demoDb();
    expect(migrate(JSON.parse(serialize(db)))).toEqual(db);
  });

  it('wczytuje dane z prototypu (pola start/end, brak ustawień)', () => {
    const db = migrate({ owners: [], dogs: [], bookings: [{ id: 'x', ownerId: 'o', dogIds: [], kennel: 1, start: '2026-12-01T09:00:00.000Z', end: '2026-12-02T09:00:00.000Z', status: 'reserved' }] });
    expect(db.bookings[0].arrival).toBe('2026-12-01T09:00:00.000Z');
    expect(db.settings.kennelCount).toBe(9);
    expect(db.bookings[0].paid).toBe(0);
  });

  it('odrzuca obcy plik', () => {
    expect(() => migrate({ foo: 1 })).toThrow(/Psotelgracji/);
  });
});
