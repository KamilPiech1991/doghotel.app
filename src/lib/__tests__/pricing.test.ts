import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../data';
import { parseLocal } from '../dates';
import { depositFor, quote } from '../pricing';
import { Dog } from '../types';

const small: Dog = { id: 's', ownerId: 'o', name: 'S', size: 'small' };
const large: Dog = { id: 'l', ownerId: 'o', name: 'L', size: 'large' };
const at = (d: string, t: string) => parseLocal(d, t)!;

describe('wycena', () => {
  it('liczy rozpoczęte doby 24-godzinne', () => {
    expect(quote(defaultSettings, [small], at('2026-12-01', '10:00'), at('2026-12-02', '10:00')).total).toBe(70);
    expect(quote(defaultSettings, [small], at('2026-12-01', '10:00'), at('2026-12-02', '15:00')).total).toBe(140);
  });

  it('daje 50% rabatu na mniejszego z dwóch psów', () => {
    expect(quote(defaultSettings, [small, large], at('2026-12-01', '10:00'), at('2026-12-02', '10:00')).total).toBe(135);
  });

  it('blokuje wycenę dla 3 psów', () => {
    const q = quote(defaultSettings, [small, large, small], at('2026-12-01', '10:00'), at('2026-12-02', '10:00'));
    expect(q.total).toBeNull();
    expect(q.missing[0]).toMatch(/3 lub więcej/);
  });

  it('stosuje okres specjalny', () => {
    const settings = { ...defaultSettings, specialPeriods: [{ id: 'x', name: 'Święta', from: '2026-12-24', to: '2026-12-26', rates: { small: 100, medium: 120, large: 150 } }] };
    expect(quote(settings, [small], at('2026-12-23', '10:00'), at('2026-12-25', '10:00')).total).toBe(170);
  });

  it('wylicza zaliczkę', () => {
    expect(depositFor(135, 30)).toBe(40.5);
  });
});
