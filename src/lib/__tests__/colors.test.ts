import { describe, expect, it } from 'vitest';
import { dogColor, dogPalette, kennelColor, kennelPalette, nextDogColor } from '../colors';
import { Dog } from '../types';

const dog = (id: string, ownerId: string, color?: string): Dog => ({ id, ownerId, name: id, size: 'small', color });

describe('kolory', () => {
  it('każdy z 9 boksów ma inny kolor', () => {
    const set = new Set(Array.from({ length: 9 }, (_, i) => kennelColor(i + 1).strong));
    expect(set.size).toBe(9);
    expect(kennelColor(10)).toBe(kennelPalette[0]);
  });

  it('nowy pies dostaje kolor inny niż psy tego samego właściciela', () => {
    const dogs = [dog('a', 'o1', 'red'), dog('b', 'o1', 'orange')];
    const c = nextDogColor(dogs, 'o1');
    expect(['red', 'orange']).not.toContain(c);
  });

  it('wybiera najrzadziej używany kolor w hotelu', () => {
    const dogs = dogPalette.slice(0, 11).map((c, i) => dog(`d${i}`, `o${i}`, c.id));
    expect(nextDogColor(dogs, 'nowy')).toBe(dogPalette[11].id);
  });

  it('pies bez zapisanego koloru ma stały kolor', () => {
    expect(dogColor(dog('xyz', 'o')).id).toBe(dogColor(dog('xyz', 'o')).id);
  });
});
