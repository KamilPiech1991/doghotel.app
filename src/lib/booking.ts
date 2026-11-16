import { Booking, DB } from './types';
import { dayRange } from './dates';

const active = (b: Booking) => b.status !== 'cancelled';

/**
 * Czy dwa pobyty kolidują, wliczając czas na sprzątanie boksu.
 * Bufor działa w OBIE strony: po każdym pobycie boks musi mieć czas na sprzątanie,
 * niezależnie od tego, który pobyt jest wcześniejszy.
 */
export const conflicts = (
  aArrival: string,
  aDeparture: string,
  bArrival: string,
  bDeparture: string,
  bufferMinutes: number,
) => {
  const buf = Math.max(0, bufferMinutes) * 60_000;
  return Date.parse(aArrival) < Date.parse(bDeparture) + buf && Date.parse(bArrival) < Date.parse(aDeparture) + buf;
};

export const validInterval = (arrival: string | null, departure: string | null): boolean =>
  !!arrival && !!departure && Number.isFinite(Date.parse(arrival)) && Number.isFinite(Date.parse(departure)) &&
  Date.parse(departure) > Date.parse(arrival);

export const kennelNumbers = (db: DB) => Array.from({ length: db.settings.kennelCount }, (_, i) => i + 1);

export const conflictingBookings = (db: DB, kennel: number, arrival: string, departure: string, excludeId?: string) =>
  db.bookings.filter(
    b => b.id !== excludeId && b.kennel === kennel && active(b) &&
      conflicts(arrival, departure, b.arrival, b.departure, db.settings.cleaningMinutes),
  );

export const isKennelFree = (db: DB, kennel: number, arrival: string | null, departure: string | null, excludeId?: string) =>
  validInterval(arrival, departure) && conflictingBookings(db, kennel, arrival!, departure!, excludeId).length === 0;

export const freeKennels = (db: DB, arrival: string | null, departure: string | null, excludeId?: string) =>
  kennelNumbers(db).filter(k => isKennelFree(db, k, arrival, departure, excludeId));

/** Pobyty, które choć częściowo przypadają na dany LOKALNY dzień. */
export const bookingsOnDay = (db: DB, key: string) => {
  const [start, end] = dayRange(key);
  return db.bookings.filter(b => active(b) && Date.parse(b.arrival) < end && Date.parse(b.departure) > start);
};

const startsOn = (iso: string, key: string) => {
  const [start, end] = dayRange(key);
  const t = Date.parse(iso);
  return t >= start && t < end;
};

export const arrivalsOn = (db: DB, key: string) =>
  db.bookings.filter(b => b.status === 'reserved' && startsOn(b.arrival, key)).sort((a, b) => a.arrival.localeCompare(b.arrival));

export const departuresOn = (db: DB, key: string) =>
  db.bookings.filter(b => b.status === 'checked_in' && startsOn(b.departure, key)).sort((a, b) => a.departure.localeCompare(b.departure));

/** Liczba różnych boksów zajętych w danym momencie. */
export const occupiedKennelsAt = (db: DB, at = Date.now()) =>
  new Set(db.bookings.filter(b => active(b) && b.status !== 'checked_out' && Date.parse(b.arrival) <= at && Date.parse(b.departure) > at).map(b => b.kennel)).size;

export const upcoming = (db: DB, from = Date.now(), limit = 5) =>
  db.bookings
    .filter(b => b.status === 'reserved' && Date.parse(b.departure) > from)
    .sort((a, b) => a.arrival.localeCompare(b.arrival))
    .slice(0, limit);

export const dogNames = (db: DB, b: Booking) =>
  b.dogIds.map(id => db.dogs.find(d => d.id === id)?.name ?? '(usunięty pies)').join(', ');

export const ownerName = (db: DB, ownerId: string) => db.owners.find(o => o.id === ownerId)?.name ?? '(nieznany klient)';

export type BookingDraft = {
  id?: string;
  ownerId: string;
  dogIds: string[];
  kennel: number | null;
  arrival: string | null;
  departure: string | null;
};

/** Pełna walidacja przed zapisem. Zwraca listę błędów po polsku (pusta = OK). */
export const validateBooking = (db: DB, d: BookingDraft): string[] => {
  const errors: string[] = [];
  if (!db.owners.some(o => o.id === d.ownerId)) errors.push('Wybierz klienta.');
  if (!d.dogIds.length) errors.push('Wybierz co najmniej jednego psa.');
  if (d.dogIds.some(id => db.dogs.find(x => x.id === id)?.ownerId !== d.ownerId))
    errors.push('Wszystkie psy muszą należeć do wybranego klienta.');
  if (!validInterval(d.arrival, d.departure)) errors.push('Podaj poprawny termin – odbiór musi być później niż przyjazd.');
  else if (!d.kennel) errors.push('Wybierz boks.');
  else if (!isKennelFree(db, d.kennel, d.arrival, d.departure, d.id))
    errors.push(`Boks ${d.kennel} jest zajęty w tym terminie (z uwzględnieniem ${db.settings.cleaningMinutes} min na sprzątanie).`);
  return errors;
};

export const canDeleteOwner = (db: DB, ownerId: string) => !db.bookings.some(b => b.ownerId === ownerId);
export const canDeleteDog = (db: DB, dogId: string) => !db.bookings.some(b => b.dogIds.includes(dogId));
