// Testy schematu bazy na prawdziwym PostgreSQL (PGlite) z zaślepkami środowiska Supabase.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

const migration = readFileSync(join(__dirname, '../migrations/20261116000000_init.sql'), 'utf8');

const supabaseStubs = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.jwt() to anon, authenticated;
`;

let db: PGlite;

/** Wykonuje zapytanie jako zalogowany użytkownik o danym e-mailu (jak PostgREST w Supabase). */
async function as<T = Record<string, unknown>>(email: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(email ? { email } : {})]);
    await tx.exec(`set local role ${email ? 'authenticated' : 'anon'}`);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const staff = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => as<T>('anna@hotel.pl', sql, params);

const booking = (id: string, kennel: number, arrival: string, departure: string, extra = '') =>
  staff(`insert into bookings (id, owner_id, dog_ids, kennel, arrival, departure, total, deposit${extra ? ', status' : ''})
         values ($1, 'o1', '{d1}', $2, $3, $4, 100, 30${extra ? `, '${extra}'` : ''})`, [id, kennel, arrival, departure]);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(supabaseStubs);
  await db.exec(migration);
  await db.exec(`
    grant usage on schema public to authenticated, anon;
    grant all on all tables in schema public to authenticated;
    insert into staff (email) values ('anna@hotel.pl');
    insert into owners (id, name) values ('o1', 'Anna'), ('o2', 'Jan');
    insert into dogs (id, owner_id, name, size) values ('d1', 'o1', 'Luna', 'small'), ('d2', 'o2', 'Reksio', 'medium');
  `);
});

describe('schemat Supabase', () => {
  it('personel widzi dane, obcy zalogowany użytkownik i anonim – nie', async () => {
    expect(await staff('select * from owners')).toHaveLength(2);
    expect(await as('obcy@gmail.com', 'select * from owners')).toHaveLength(0);
    await expect(as(null, 'select * from owners')).rejects.toThrow();
    await expect(as('obcy@gmail.com', `insert into owners (id, name) values ('x', 'X')`)).rejects.toThrow(/row-level security/);
  });

  it('e-mail personelu jest porównywany bez względu na wielkość liter', async () => {
    expect(await as('Anna@Hotel.PL', 'select * from owners')).toHaveLength(2);
  });

  it('blokuje nakładające się pobyty w tym samym boksie', async () => {
    await booking('b1', 1, '2026-12-10 10:00+01', '2026-12-12 14:00+01');
    await expect(booking('b2', 1, '2026-12-11 10:00+01', '2026-12-13 10:00+01')).rejects.toThrow(/Boks 1 jest zajęty/);
    await booking('b3', 2, '2026-12-11 10:00+01', '2026-12-13 10:00+01');
  });

  it('pilnuje czasu na sprzątanie w obie strony', async () => {
    await booking('b1', 1, '2026-12-10 10:00+01', '2026-12-12 14:00+01');
    await expect(booking('po', 1, '2026-12-12 14:30+01', '2026-12-13 10:00+01')).rejects.toThrow(/zajęty/);
    await expect(booking('przed', 1, '2026-12-08 10:00+01', '2026-12-10 09:30+01')).rejects.toThrow(/zajęty/);
    await booking('ok1', 1, '2026-12-12 15:00+01', '2026-12-13 10:00+01');
    await booking('ok2', 1, '2026-12-08 10:00+01', '2026-12-10 09:00+01');
  });

  it('anulowany pobyt zwalnia boks, a przywrócenie sprawdza go ponownie', async () => {
    await booking('b1', 1, '2026-12-10 10:00+01', '2026-12-12 14:00+01');
    await staff(`update bookings set status = 'cancelled' where id = 'b1'`);
    await booking('b2', 1, '2026-12-10 10:00+01', '2026-12-12 14:00+01');
    await expect(staff(`update bookings set status = 'reserved' where id = 'b1'`)).rejects.toThrow(/zajęty/);
  });

  it('edycja pobytu nie koliduje sama ze sobą', async () => {
    await booking('b1', 1, '2026-12-10 10:00+01', '2026-12-12 14:00+01');
    await staff(`update bookings set departure = '2026-12-13 14:00+01' where id = 'b1'`);
  });

  it('nie pozwala zarezerwować cudzego psa ani nieistniejącego boksu', async () => {
    await expect(staff(`insert into bookings (id, owner_id, dog_ids, kennel, arrival, departure) values ('x', 'o1', '{d2}', 1, now(), now() + interval '1 day')`)).rejects.toThrow(/należeć/);
    await expect(booking('x', 10, '2026-12-10 10:00+01', '2026-12-11 10:00+01')).rejects.toThrow(/nie istnieje/);
  });

  it('nie usuwa psa ani klienta z historią pobytów, usuwa bez historii', async () => {
    await booking('b1', 1, '2026-12-10 10:00+01', '2026-12-12 14:00+01');
    await expect(staff(`delete from dogs where id = 'd1'`)).rejects.toThrow(/ma zapisane pobyty/);
    await expect(staff(`delete from owners where id = 'o1'`)).rejects.toThrow();
    await staff(`delete from owners where id = 'o2'`);
    expect(await staff(`select * from dogs where id = 'd2'`)).toHaveLength(0);
  });

  it('dopisuje wpłaty atomowo i tylko dla personelu', async () => {
    await booking('b1', 1, '2026-12-10 10:00+01', '2026-12-12 14:00+01');
    await staff(`select add_payment('b1', 50.5)`);
    const [r] = await staff<{ add_payment: string }>(`select add_payment('b1', 20)`);
    expect(Number(r.add_payment)).toBe(70.5);
    await expect(as('obcy@gmail.com', `select add_payment('b1', 1)`)).rejects.toThrow(/Brak uprawnień/);
  });

  it('replace_all wczytuje kopię zapasową w formacie aplikacji', async () => {
    const data = {
      settings: { kennelCount: 9, rates: { small: 75, medium: 85, large: 105 }, depositPercent: 20, cleaningMinutes: 30, specialPeriods: [] },
      owners: [{ id: 'n1', name: 'Nowa', phone: '1' }],
      dogs: [{ id: 'nd1', ownerId: 'n1', name: 'Figa', size: 'small', color: 'pink' }],
      bookings: [
        { id: 'c', ownerId: 'n1', dogIds: ['nd1'], kennel: 1, arrival: '2026-12-10T09:00:00Z', departure: '2026-12-11T09:00:00Z', status: 'cancelled', total: 70, deposit: 21, paid: 0, createdAt: '2026-11-01T00:00:00Z' },
        { id: 'r', ownerId: 'n1', dogIds: ['nd1'], kennel: 1, arrival: '2026-12-10T09:00:00Z', departure: '2026-12-11T09:00:00Z', status: 'reserved', total: 70, deposit: 21, paid: 10, createdAt: '2026-11-01T00:00:00Z' },
      ],
    };
    await staff(`select replace_all($1::jsonb)`, [JSON.stringify(data)]);
    expect(await staff(`select id from owners`)).toEqual([{ id: 'n1' }]);
    expect((await staff<{ dog_ids: string[] }>(`select dog_ids from bookings where id = 'r'`))[0].dog_ids).toEqual(['nd1']);
    expect((await staff<{ cleaning_minutes: number }>(`select cleaning_minutes from settings`))[0].cleaning_minutes).toBe(30);
  });

  it('replace_all z błędem nie zmienia niczego', async () => {
    const bad = { owners: [{ id: 'n1', name: 'Nowa' }], dogs: [{ id: 'nd1', ownerId: 'BRAK', name: 'X', size: 'small' }], bookings: [] };
    await expect(staff(`select replace_all($1::jsonb)`, [JSON.stringify(bad)])).rejects.toThrow();
    expect(await staff(`select id from owners order by id`)).toEqual([{ id: 'o1' }, { id: 'o2' }]);
  });

  it('migracja da się uruchomić drugi raz (bez błędów)', async () => {
    await db.exec(migration);
  });
});
