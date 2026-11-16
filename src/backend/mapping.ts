// Tłumaczenie między wierszami bazy (snake_case) a modelem aplikacji (camelCase).
import { Booking, DB, Dog, Owner, Settings } from '../lib/types';

export type OwnerRow = { id: string; name: string; phone: string; notes: string | null };
export type DogRow = { id: string; owner_id: string; name: string; size: Dog['size']; weight: string | null; breed: string | null; notes: string | null; color: string | null };
export type BookingRow = {
  id: string; owner_id: string; dog_ids: string[]; kennel: number; arrival: string; departure: string;
  status: Booking['status']; total: number | string | null; deposit: number | string; paid: number | string; notes: string | null; created_at: string;
};
export type SettingsRow = { kennel_count: number; rates: Settings['rates']; deposit_percent: number | string; cleaning_minutes: number; special_periods: Settings['specialPeriods'] };

const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined ? undefined : v);
const num = (v: number | string) => Number(v);
const iso = (v: string) => new Date(v).toISOString();

export const ownerFromRow = (r: OwnerRow): Owner => ({ id: r.id, name: r.name, phone: r.phone ?? '', notes: opt(r.notes) });
export const ownerToRow = (o: Owner): OwnerRow => ({ id: o.id, name: o.name, phone: o.phone ?? '', notes: o.notes ?? null });

export const dogFromRow = (r: DogRow): Dog => ({
  id: r.id, ownerId: r.owner_id, name: r.name, size: r.size,
  weight: opt(r.weight), breed: opt(r.breed), notes: opt(r.notes), color: opt(r.color),
});
export const dogToRow = (d: Dog): DogRow => ({
  id: d.id, owner_id: d.ownerId, name: d.name, size: d.size,
  weight: d.weight ?? null, breed: d.breed ?? null, notes: d.notes ?? null, color: d.color ?? null,
});

export const bookingFromRow = (r: BookingRow): Booking => ({
  id: r.id, ownerId: r.owner_id, dogIds: r.dog_ids ?? [], kennel: r.kennel,
  arrival: iso(r.arrival), departure: iso(r.departure), status: r.status,
  total: r.total === null ? null : num(r.total), deposit: num(r.deposit), paid: num(r.paid),
  notes: opt(r.notes), createdAt: iso(r.created_at),
});
export const bookingToRow = (b: Booking): BookingRow => ({
  id: b.id, owner_id: b.ownerId, dog_ids: b.dogIds, kennel: b.kennel, arrival: b.arrival, departure: b.departure,
  status: b.status, total: b.total, deposit: b.deposit, paid: b.paid, notes: b.notes ?? null, created_at: b.createdAt,
});

export const settingsFromRow = (r: SettingsRow): Settings => ({
  kennelCount: r.kennel_count, rates: r.rates, depositPercent: num(r.deposit_percent),
  cleaningMinutes: r.cleaning_minutes, specialPeriods: r.special_periods ?? [],
});
export const settingsToRow = (s: Partial<Settings>): Partial<SettingsRow> => {
  const row: Partial<SettingsRow> = {};
  if (s.kennelCount !== undefined) row.kennel_count = s.kennelCount;
  if (s.rates !== undefined) row.rates = s.rates;
  if (s.depositPercent !== undefined) row.deposit_percent = s.depositPercent;
  if (s.cleaningMinutes !== undefined) row.cleaning_minutes = s.cleaningMinutes;
  if (s.specialPeriods !== undefined) row.special_periods = s.specialPeriods;
  return row;
};

export const dbFromRows = (owners: OwnerRow[], dogs: DogRow[], bookings: BookingRow[], settings: SettingsRow): DB => ({
  version: 2,
  owners: owners.map(ownerFromRow),
  dogs: dogs.map(dogFromRow),
  bookings: bookings.map(bookingFromRow),
  settings: settingsFromRow(settings),
});

/** Zamienia błąd z Supabase/sieci na zrozumiały komunikat po polsku. */
export function friendlyError(e: unknown): string {
  const err = (e ?? {}) as { message?: string; code?: string; hint?: string; name?: string };
  const msg = err.message ?? String(e);
  if (err.code === 'P0001' || err.code === 'P0002') return msg; // komunikaty z bazy są już po polsku
  if (err.code === '23503') return 'Nie można usunąć – ten klient ma zapisane pobyty.';
  if (err.code === '42501' || /row-level security/i.test(msg)) return 'Brak uprawnień. To konto nie jest na liście personelu hotelu.';
  if (/Failed to fetch|NetworkError|Network request failed|fetch failed|Load failed/i.test(msg)) return 'Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie.';
  if (/Invalid login credentials/i.test(msg)) return 'Nieprawidłowy e-mail lub hasło.';
  if (/Email not confirmed/i.test(msg)) return 'Adres e-mail nie został jeszcze potwierdzony.';
  return msg;
}
