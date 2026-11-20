import { describe, expect, it } from 'vitest';
import { demoDb } from '../data';
import { parseLocal } from '../dates';
import { DB } from '../types';
import { nameMatches, parseVoiceBooking } from '../voice';

// piątek, 20 listopada 2026
const TODAY = '2026-11-20';
const db = (): DB => ({ ...demoDb(), bookings: [] });
const p = (text: string, d = db()) => parseVoiceBooking(text, d, TODAY);
const names = (r: ReturnType<typeof p>) => r.dogs.map(d => d.name);

describe('rezerwacja głosowa – psy', () => {
  it('dopasowuje odmienione imiona', () => {
    expect(nameMatches('Lunę', 'Luna')).toBe(true);
    expect(nameMatches('Reksia', 'Reksio')).toBe(true);
    expect(nameMatches('Borysa', 'Borys')).toBe(true);
    expect(nameMatches('Łatkę', 'Łatka')).toBe(true);
    expect(nameMatches('Figę', 'Figa')).toBe(true);
    expect(nameMatches('Luna', 'Lucky')).toBe(false);
    expect(nameMatches('do', 'Dora')).toBe(false);
  });

  it('kilka psów jednego właściciela', () => {
    const r = p('Lunę i Borysa od jutra na 3 dni');
    expect(names(r).sort()).toEqual(['Borys', 'Luna']);
    expect(r.ownerId).toBe('o1');
  });

  it('nieznany pies', () => {
    const r = p('Burek od jutra do niedzieli');
    expect(r.dogs).toEqual([]);
    expect(r.problems[0]).toMatch(/Nie rozpoznano psa/);
  });

  it('to samo imię u dwóch właścicieli – do wyboru, a nazwisko rozstrzyga', () => {
    const d = db();
    d.dogs.push({ id: 'd9', ownerId: 'o2', name: 'Luna', size: 'medium' });
    expect(p('Luna od jutra do niedzieli', d).candidates).toHaveLength(2);
    const r = p('Luna pani Kowalskiej od jutra do niedzieli', d);
    expect(r.candidates).toEqual([]);
    expect(r.dogs.map(x => x.id)).toEqual(['d1']);
  });
});

describe('rezerwacja głosowa – daty', () => {
  it('dni tygodnia', () => {
    const r = p('Luna od piątku do niedzieli');
    expect([r.arrivalDate, r.departureDate]).toEqual(['2026-11-20', '2026-11-22']);
    expect(r.problems).toEqual([]);
  });

  it('od piątku do piątku = tydzień', () => {
    expect(p('Luna od piątku do piątku').departureDate).toBe('2026-11-27');
  });

  it('dzisiaj, jutro, pojutrze', () => {
    const r = p('Reksio dzisiaj do soboty');
    expect([r.arrivalDate, r.departureDate]).toEqual(['2026-11-20', '2026-11-21']);
    expect(p('Reksio od pojutrze do wtorku').arrivalDate).toBe('2026-11-22');
  });

  it('dzień i miesiąc słownie oraz cyframi', () => {
    const r = p('Reksio od 22 grudnia do 28 grudnia');
    expect([r.arrivalDate, r.departureDate]).toEqual(['2026-12-22', '2026-12-28']);
    const r2 = p('Reksia od dwudziestego drugiego grudnia do dwudziestego ósmego grudnia');
    expect([r2.arrivalDate, r2.departureDate]).toEqual(['2026-12-22', '2026-12-28']);
    const r3 = p('Luna od 22-go do 28-go grudnia');
    expect([r3.arrivalDate, r3.departureDate]).toEqual(['2026-12-22', '2026-12-28']);
  });

  it('format 5.12 – 7.12 i rok następny', () => {
    const r = p('Figa 5.12 – 7.12');
    expect([r.arrivalDate, r.departureDate]).toEqual(['2026-12-05', '2026-12-07']);
    const r2 = p('Borys od 10 stycznia do 12 stycznia');
    expect([r2.arrivalDate, r2.departureDate]).toEqual(['2027-01-10', '2027-01-12']);
  });

  it('przełom roku: od 30 grudnia do 2 stycznia', () => {
    const r = p('Luna od 30 grudnia do 2 stycznia');
    expect([r.arrivalDate, r.departureDate]).toEqual(['2026-12-30', '2027-01-02']);
  });

  it('długość pobytu', () => {
    expect(p('Luna od jutra na 3 dni').departureDate).toBe('2026-11-24');
    expect(p('Luna od poniedziałku na tydzień').departureDate).toBe('2026-11-30');
    expect(p('Luna od soboty na weekend').departureDate).toBe('2026-11-23');
    expect(p('Luna od jutra na pięć dni').departureDate).toBe('2026-11-26');
  });

  it('brak dnia odbioru', () => {
    const r = p('Luna od jutra');
    expect(r.departureDate).toBeNull();
    expect(r.problems.join(' ')).toMatch(/Brak dnia odbioru/);
  });

  it('odbiór przed przyjazdem', () => {
    expect(p('Luna od 10 grudnia do 5 grudnia 2026').problems.join(' ')).toMatch(/później/);
  });
});

describe('rezerwacja głosowa – godziny i boks', () => {
  it('domyślne godziny', () => {
    const r = p('Luna od piątku do niedzieli');
    expect([r.arrivalTime, r.departureTime]).toEqual(['10:00', '15:00']);
  });

  it('godzina przyjazdu i odbioru', () => {
    const r = p('Reksio od 22 grudnia o 9 do 28 grudnia o 18:30');
    expect([r.arrivalTime, r.departureTime]).toEqual(['09:00', '18:30']);
  });

  it('godziny słownie i „wpół do”', () => {
    const r = p('Luna przyjazd w poniedziałek o wpół do dziewiątej odbiór w środę o piątej');
    expect([r.arrivalDate, r.arrivalTime, r.departureDate, r.departureTime]).toEqual(['2026-11-23', '08:30', '2026-11-25', '17:00']);
    expect(p('Luna jutro o dziesiątej trzydzieści do niedzieli').arrivalTime).toBe('10:30');
  });

  it('„odbiór o” przypisuje godzinę do odbioru', () => {
    const r = p('Figa 5.12 – 7.12 odbiór o 18:30');
    expect([r.arrivalTime, r.departureTime]).toEqual(['10:00', '18:30']);
  });

  it('boks podany i wolny', () => {
    expect(p('Lunę od jutra na 3 dni boks 4').kennel).toBe(4);
    expect(p('Luna od jutra do niedzieli do boksu numer 6').kennel).toBe(6);
  });

  it('boks zajęty – propozycja innego, bez boksu – pierwszy wolny', () => {
    const d = db();
    d.bookings.push({ id: 'x', ownerId: 'o2', dogIds: ['d3'], kennel: 4, status: 'reserved', total: 1, deposit: 0, paid: 0, createdAt: '',
      arrival: parseLocal('2026-11-21', '10:00')!, departure: parseLocal('2026-11-25', '10:00')! });
    const r = p('Luna od jutra na 3 dni boks 4', d);
    expect(r.kennel).toBe(1);
    expect(r.notes.join(' ')).toMatch(/Boks 4 jest zajęty/);
    d.bookings[0].kennel = 1;
    expect(p('Luna od jutra na 3 dni', d).kennel).toBe(2);
  });
});
