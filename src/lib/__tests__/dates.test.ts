import { describe, expect, it } from 'vitest';
import { displayDay, isValidDateKey, localDateKey, localTime, parseLocal, plusDays, weekStart } from '../dates';

describe('daty', () => {
  it('odrzuca nieistniejące daty i godziny', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(parseLocal('2026-13-01', '10:00')).toBeNull();
    expect(parseLocal('2026-12-01', '25:00')).toBeNull();
    expect(parseLocal('2026-12-01', '9:05')).not.toBeNull();
  });

  it('zachowuje lokalny dzień i godzinę (bez przesunięcia UTC)', () => {
    const iso = parseLocal('2026-12-10', '00:30')!;
    expect(localDateKey(iso)).toBe('2026-12-10');
    expect(localTime(iso)).toBe('00:30');
  });

  it('przechodzi przez zmianę czasu i koniec miesiąca', () => {
    expect(plusDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(plusDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(plusDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('tydzień zaczyna się w poniedziałek', () => {
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // niedziela
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // poniedziałek
  });

  it('wyświetla dzień po polsku', () => {
    expect(displayDay('2026-11-16')).toBe('poniedziałek, 16 listopada 2026');
  });
});

import { plural, pln } from '../dates';
describe('formatowanie po polsku', () => {
  it('odmienia liczebniki', () => {
    expect([1, 2, 5, 12, 22, 25].map(n => plural(n, 'doba', 'doby', 'dób'))).toEqual(['doba', 'doby', 'dób', 'dób', 'doby', 'dób']);
  });
  it('formatuje kwoty', () => expect(pln(40.5)).toBe('40,50 zł'));
});
