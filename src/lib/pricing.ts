import { Dog, Settings, Size } from './types';
import { dateKey, displayShort, pln } from './dates';

const sizeOrder: Record<Size, number> = { small: 0, medium: 1, large: 2 };
const DAY = 86_400_000;

export type Quote = { total: number | null; days: number; details: string[]; missing: string[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Wycena pobytu.
 * ZASADY DO ZATWIERDZENIA Z HOTELEM (na razie tak jak w prototypie):
 * - liczymy pełne, rozpoczęte 24-godzinne okresy od momentu przyjazdu,
 * - stawka zależy od wielkości psa i ewentualnego okresu specjalnego (np. święta),
 * - przy 2 psach mniejszy pies ma 50% rabatu,
 * - dla 3+ psów brak reguły – wycena zablokowana.
 */
export function quote(settings: Settings, dogs: Dog[], arrival: string | null, departure: string | null): Quote {
  if (!arrival || !departure || !(Date.parse(departure) > Date.parse(arrival)))
    return { total: null, days: 0, details: [], missing: ['Nieprawidłowy termin'] };
  if (!dogs.length) return { total: null, days: 0, details: [], missing: ['Wybierz psa'] };
  if (dogs.length > 2)
    return { total: null, days: 0, details: [], missing: ['Brak zatwierdzonej reguły cenowej dla 3 lub więcej psów'] };

  const start = Date.parse(arrival);
  const days = Math.max(1, Math.ceil((Date.parse(departure) - start) / DAY));
  const sorted = [...dogs].sort((a, b) => sizeOrder[b.size] - sizeOrder[a.size]);
  const details: string[] = [];
  const missing: string[] = [];
  let total = 0;

  for (let i = 0; i < days; i++) {
    const key = dateKey(new Date(start + i * DAY));
    const special = settings.specialPeriods.find(p => p.from <= key && p.to >= key);
    const rates = special?.rates ?? settings.rates;
    const prices = sorted.map(d => rates[d.size]);
    if (prices.some(v => !Number.isFinite(v) || v <= 0)) {
      missing.push(`Brak stawki na dzień ${key}`);
      continue;
    }
    let day = prices.reduce((s, p) => s + p, 0);
    if (sorted.length === 2) day -= prices[1] * 0.5;
    day = round2(day);
    details.push(`${displayShort(key)}: ${pln(day)}${special ? ` (${special.name})` : ''}${sorted.length === 2 ? ' · rabat 50% na mniejszego psa' : ''}`);
    total += day;
  }
  return { total: missing.length ? null : round2(total), days, details, missing };
}

export const depositFor = (total: number, percent: number) => round2((total * percent) / 100);
