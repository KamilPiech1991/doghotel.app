import { Dog } from './types';

// Kolory boksów: 9 wyraźnie różnych barw. `strong` ma kontrast ≥ 4.5:1 z białym tekstem.
export type KennelColor = { name: string; strong: string; light: string; border: string };

export const kennelPalette: KennelColor[] = [
  { name: 'czerwony', strong: '#B91C1C', light: '#FEE2E2', border: '#FCA5A5' },
  { name: 'pomarańczowy', strong: '#C2410C', light: '#FFEDD5', border: '#FDBA74' },
  { name: 'złoty', strong: '#A16207', light: '#FEF3C7', border: '#FCD34D' },
  { name: 'zielony', strong: '#15803D', light: '#DCFCE7', border: '#86EFAC' },
  { name: 'morski', strong: '#0F766E', light: '#CCFBF1', border: '#5EEAD4' },
  { name: 'niebieski', strong: '#1D4ED8', light: '#DBEAFE', border: '#93C5FD' },
  { name: 'granatowy', strong: '#4338CA', light: '#E0E7FF', border: '#A5B4FC' },
  { name: 'fioletowy', strong: '#7E22CE', light: '#F3E8FF', border: '#D8B4FE' },
  { name: 'różowy', strong: '#BE185D', light: '#FCE7F3', border: '#F9A8D4' },
];

export const kennelColor = (kennel: number) => kennelPalette[(((kennel - 1) % kennelPalette.length) + kennelPalette.length) % kennelPalette.length];

// Kolory psów: 12 barw z nazwami (nazwa czytana przez czytnik ekranu).
export type DogColor = { id: string; name: string; hex: string };

export const dogPalette: DogColor[] = [
  { id: 'red', name: 'czerwony', hex: '#DC2626' },
  { id: 'orange', name: 'pomarańczowy', hex: '#EA580C' },
  { id: 'gold', name: 'złoty', hex: '#CA8A04' },
  { id: 'olive', name: 'oliwkowy', hex: '#4D7C0F' },
  { id: 'green', name: 'zielony', hex: '#16A34A' },
  { id: 'teal', name: 'morski', hex: '#0D9488' },
  { id: 'sky', name: 'błękitny', hex: '#0284C7' },
  { id: 'blue', name: 'niebieski', hex: '#2563EB' },
  { id: 'violet', name: 'fioletowy', hex: '#7C3AED' },
  { id: 'pink', name: 'różowy', hex: '#DB2777' },
  { id: 'brown', name: 'brązowy', hex: '#92400E' },
  { id: 'slate', name: 'grafitowy', hex: '#475569' },
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Kolor psa; psy zapisane przed wprowadzeniem kolorów dostają stały kolor wyliczony z id. */
export const dogColor = (dog: Pick<Dog, 'id' | 'color'>): DogColor =>
  dogPalette.find(c => c.id === dog.color) ?? dogPalette[hash(dog.id) % dogPalette.length];

/**
 * Kolor dla nowego psa: inny niż psy tego samego właściciela,
 * a spośród nich najrzadziej używany w całym hotelu.
 */
export const nextDogColor = (dogs: Dog[], ownerId: string): string => {
  const ownerUsed = new Set(dogs.filter(d => d.ownerId === ownerId).map(d => dogColor(d).id));
  const usage = new Map(dogPalette.map(c => [c.id, 0]));
  dogs.forEach(d => usage.set(dogColor(d).id, (usage.get(dogColor(d).id) ?? 0) + 1));
  const candidates = dogPalette.filter(c => !ownerUsed.has(c.id));
  const pool = candidates.length ? candidates : dogPalette;
  return pool.reduce((best, c) => ((usage.get(c.id) ?? 0) < (usage.get(best.id) ?? 0) ? c : best), pool[0]).id;
};
