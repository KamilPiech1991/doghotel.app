-- Psotelgracja – schemat bazy danych (Supabase / PostgreSQL)
-- Uruchom raz w Supabase: SQL Editor → New query → wklej całość → Run.

-- ============================================================
-- Personel: tylko osoby z tej listy (po adresie e-mail konta) mają dostęp do danych.
-- Po uruchomieniu skryptu dodaj siebie:  insert into public.staff (email) values ('twoj@email.pl');
-- ============================================================
create table if not exists public.staff (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ============================================================
-- Tabele
-- ============================================================
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  kennel_count int not null default 9 check (kennel_count between 1 and 50),
  rates jsonb not null default '{"small":70,"medium":80,"large":100}',
  deposit_percent numeric(5,2) not null default 30 check (deposit_percent between 0 and 100),
  cleaning_minutes int not null default 60 check (cleaning_minutes between 0 and 1440),
  special_periods jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.owners (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dogs (
  id text primary key,
  owner_id text not null references public.owners (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  size text not null check (size in ('small', 'medium', 'large')),
  weight text,
  breed text,
  notes text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dogs_owner_idx on public.dogs (owner_id);

create table if not exists public.bookings (
  id text primary key,
  -- restrict: klienta z historią pobytów nie da się usunąć
  owner_id text not null references public.owners (id) on delete restrict,
  dog_ids text[] not null check (cardinality(dog_ids) between 1 and 10),
  kennel int not null check (kennel between 1 and 50),
  arrival timestamptz not null,
  departure timestamptz not null,
  status text not null default 'reserved' check (status in ('reserved', 'checked_in', 'checked_out', 'cancelled')),
  total numeric(10,2),
  deposit numeric(10,2) not null default 0,
  paid numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departure > arrival)
);
create index if not exists bookings_kennel_time_idx on public.bookings (kennel, arrival, departure);
create index if not exists bookings_owner_idx on public.bookings (owner_id);
create index if not exists bookings_dogs_idx on public.bookings using gin (dog_ids);

-- ============================================================
-- Reguły pilnowane przez serwer (działają także przy kilku telefonach naraz)
-- ============================================================

-- 1) Boks wolny przez cały pobyt, z czasem na sprzątanie w obie strony;
-- 2) wszystkie psy należą do klienta z rezerwacji.
create or replace function public.check_booking()
returns trigger
language plpgsql
as $$
declare
  buffer interval;
  clash record;
begin
  if exists (
    select 1 from unnest(new.dog_ids) as d(id)
    where not exists (select 1 from public.dogs g where g.id = d.id and g.owner_id = new.owner_id)
  ) then
    raise exception 'Wszystkie psy muszą należeć do wybranego klienta.' using errcode = 'P0001', hint = 'DOG_OWNER';
  end if;

  if new.status = 'cancelled' then
    return new;
  end if;

  if new.kennel > (select kennel_count from public.settings where id = 1) then
    raise exception 'Boks % nie istnieje.', new.kennel using errcode = 'P0001', hint = 'KENNEL_RANGE';
  end if;

  -- blokada na numer boksu: dwie równoległe rezerwacje tego samego boksu czekają na siebie
  perform pg_advisory_xact_lock(hashtext('psotelgracja-kennel'), new.kennel);

  select make_interval(mins => cleaning_minutes) into buffer from public.settings where id = 1;

  select b.id, b.arrival, b.departure into clash
  from public.bookings b
  where b.kennel = new.kennel
    and b.id <> new.id
    and b.status <> 'cancelled'
    and new.arrival < b.departure + buffer
    and b.arrival < new.departure + buffer
  limit 1;

  if found then
    raise exception 'Boks % jest zajęty w tym terminie (z uwzględnieniem czasu na sprzątanie).', new.kennel
      using errcode = 'P0001', hint = 'KENNEL_TAKEN';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_check on public.bookings;
create trigger bookings_check
  before insert or update of kennel, arrival, departure, status, dog_ids, owner_id on public.bookings
  for each row execute function public.check_booking();

-- 3) Psa, który ma zapisane pobyty, nie da się usunąć (historia rezerwacji).
create or replace function public.check_dog_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.bookings b where old.id = any (b.dog_ids)) then
    raise exception 'Pies % ma zapisane pobyty i nie może zostać usunięty.', old.name using errcode = 'P0001', hint = 'DOG_IN_USE';
  end if;
  return old;
end;
$$;

drop trigger if exists dogs_delete_check on public.dogs;
create trigger dogs_delete_check before delete on public.dogs
  for each row execute function public.check_dog_delete();

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['owners', 'dogs', 'bookings', 'settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;

-- ============================================================
-- Funkcje wywoływane z aplikacji
-- ============================================================

-- Wpłata dopisywana atomowo (dwie osoby mogą wpisać wpłatę w tym samym czasie).
create or replace function public.add_payment(p_booking_id text, p_amount numeric)
returns numeric
language plpgsql
as $$
declare result numeric;
begin
  if not public.is_staff() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  update public.bookings set paid = round(paid + p_amount, 2)
  where id = p_booking_id
  returning paid into result;
  if not found then
    raise exception 'Nie znaleziono pobytu.' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Zastąpienie wszystkich danych (przywracanie kopii zapasowej / przeniesienie danych z telefonu).
-- Wszystko albo nic: przy jakimkolwiek błędzie nic się nie zmienia.
create or replace function public.replace_all(p_data jsonb)
returns void
language plpgsql
as $$
begin
  if not public.is_staff() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;

  delete from public.bookings where true;
  delete from public.dogs where true;
  delete from public.owners where true;

  if p_data ? 'settings' then
    update public.settings set
      kennel_count = coalesce((p_data #>> '{settings,kennelCount}')::int, kennel_count),
      rates = coalesce(p_data #> '{settings,rates}', rates),
      deposit_percent = coalesce((p_data #>> '{settings,depositPercent}')::numeric, deposit_percent),
      cleaning_minutes = coalesce((p_data #>> '{settings,cleaningMinutes}')::int, cleaning_minutes),
      special_periods = coalesce(p_data #> '{settings,specialPeriods}', special_periods)
    where id = 1;
  end if;

  insert into public.owners (id, name, phone, notes)
  select o.id, o.name, coalesce(o.phone, ''), o.notes
  from jsonb_to_recordset(coalesce(p_data -> 'owners', '[]')) as o(id text, name text, phone text, notes text);

  insert into public.dogs (id, owner_id, name, size, weight, breed, notes, color)
  select d.id, d."ownerId", d.name, d.size, d.weight, d.breed, d.notes, d.color
  from jsonb_to_recordset(coalesce(p_data -> 'dogs', '[]'))
    as d(id text, "ownerId" text, name text, size text, weight text, breed text, notes text, color text);

  -- najpierw anulowane (nie blokują boksów), potem reszta w kolejności przyjazdu
  insert into public.bookings (id, owner_id, dog_ids, kennel, arrival, departure, status, total, deposit, paid, notes, created_at)
  select b.id, b."ownerId", array(select jsonb_array_elements_text(b."dogIds")), b.kennel, b.arrival, b.departure,
         b.status, b.total, coalesce(b.deposit, 0), coalesce(b.paid, 0), b.notes, coalesce(b."createdAt", now())
  from jsonb_to_recordset(coalesce(p_data -> 'bookings', '[]'))
    as b(id text, "ownerId" text, "dogIds" jsonb, kennel int, arrival timestamptz, departure timestamptz,
         status text, total numeric, deposit numeric, paid numeric, notes text, "createdAt" timestamptz)
  order by (b.status = 'cancelled') desc, b.arrival;
end;
$$;

-- ============================================================
-- Bezpieczeństwo (Row Level Security): dostęp tylko dla personelu
-- ============================================================
alter table public.staff enable row level security;
alter table public.settings enable row level security;
alter table public.owners enable row level security;
alter table public.dogs enable row level security;
alter table public.bookings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['owners', 'dogs', 'bookings'] loop
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end;
$$;

drop policy if exists staff_read on public.settings;
create policy staff_read on public.settings for select to authenticated using (public.is_staff());
drop policy if exists staff_update on public.settings;
create policy staff_update on public.settings for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- personel widzi tylko własny wpis (aplikacja sprawdza, czy konto ma dostęp)
drop policy if exists staff_self on public.staff;
create policy staff_self on public.staff for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

revoke all on function public.replace_all(jsonb) from public, anon;
revoke all on function public.add_payment(text, numeric) from public, anon;
grant execute on function public.replace_all(jsonb) to authenticated;
grant execute on function public.add_payment(text, numeric) to authenticated;
grant execute on function public.is_staff() to authenticated;

-- ============================================================
-- Na żywo: zmiany z innych telefonów od razu widoczne w aplikacji
-- ============================================================
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['owners', 'dogs', 'bookings', 'settings'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
