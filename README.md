# 🐾 Psotelgracja – aplikacja hotelu dla psów

Aplikacja do obsługi hotelu dla psów: rezerwacje 9 boksów, klienci i ich psy, przyjazdy i odbiory, wpłaty, cennik.
Na tym etapie działa **jako aplikacja webowa (PWA)** otwierana w przeglądarce telefonu i dodawana do ekranu głównego.
Kod jest napisany w Expo (React Native), więc później można z niego zbudować aplikację na Androida/iPhone'a bez przepisywania.

## Jak korzystać na telefonie

1. Otwórz adres aplikacji (GitHub Pages, np. `https://kamilpiech1991.github.io/doghotel.app/`).
2. Dodaj do ekranu głównego:
   - **Android (Chrome):** menu ⋮ → *Dodaj do ekranu głównego* / *Zainstaluj aplikację*.
   - **iPhone (Safari):** przycisk *Udostępnij* → *Do ekranu początkowego*.
3. Uruchamiaj aplikację z ikony 🐾 – działa wtedy na pełnym ekranie, jak zwykła aplikacja.

Dane są zapisywane w **bazie Supabase** – wspólne dla wszystkich telefonów personelu, zmiany z innych urządzeń
pojawiają się automatycznie. Każda osoba loguje się swoim e-mailem i hasłem.

> Jeśli baza nie jest skonfigurowana (brak zmiennych `SUPABASE_URL` / `SUPABASE_KEY`), aplikacja działa w **trybie
> lokalnym**: dane zostają tylko w przeglądarce tego telefonu. Po podłączeniu bazy w **Ustawieniach** pojawi się przycisk
> **„Prześlij dane z tego telefonu do bazy”**.

## Podłączenie bazy Supabase (jednorazowo, ok. 15 minut)

1. **Projekt:** wejdź na [supabase.com](https://supabase.com) → *New project*. Region: **Central EU (Frankfurt)**
   (dane klientów zostają w UE). Zapisz hasło do bazy w bezpiecznym miejscu.
2. **Tabele:** w projekcie otwórz *SQL Editor* → *New query*, wklej całą zawartość pliku
   [`supabase/migrations/20261116000000_init.sql`](supabase/migrations/20261116000000_init.sql) i kliknij *Run*.
3. **Personel:** w tym samym SQL Editorze dodaj adresy e-mail osób, które mogą korzystać z aplikacji:
   ```sql
   insert into public.staff (email) values ('twoj@email.pl'), ('pracownik@email.pl');
   ```
   (małymi literami). Tylko te osoby zobaczą dane – nawet jeśli ktoś inny założy konto.
4. **Konta:** *Authentication → Users → Add user → Create new user*: e-mail + hasło, zaznacz *Auto Confirm User*.
   Zalecane: *Authentication → Sign In / Providers* → wyłącz *Allow new users to sign up*
   (konta zakłada tylko właściciel).
5. **Klucze:** *Project Settings → API Keys* – skopiuj **Project URL** i klucz **publishable** (lub *anon*).
   Ten klucz może być jawny – dostęp do danych chronią reguły w bazie (RLS + lista personelu).
6. **GitHub:** repozytorium → *Settings → Secrets and variables → Actions → zakładka Variables → New repository variable*:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_KEY` = klucz publishable / anon

   Następnie *Actions → Testy i publikacja na GitHub Pages → Run workflow* (albo dowolny push na `main`).

Co pilnuje baza (niezależnie od telefonu, z którego ktoś zapisuje):
- boks nie może być zajęty dwa razy w tym samym czasie (z czasem na sprzątanie w obie strony) – gdy dwie osoby
  rezerwują ten sam boks jednocześnie, druga dostaje komunikat „Boks jest zajęty”;
- psy w rezerwacji muszą należeć do tego klienta;
- nie da się usunąć klienta ani psa, który ma historię pobytów;
- wpłaty są dopisywane bez ryzyka nadpisania przez drugą osobę.

Kopia zapasowa: Supabase w planie darmowym nie robi kopii do pobrania – co jakiś czas użyj
**Ustawienia → Pobierz kopię zapasową**. Uwaga: darmowy projekt jest usypiany po tygodniu bez żadnego użycia
(budzi się z panelu Supabase).

## Funkcje

- **Start:** zajętość boksów teraz, dzisiejsze przyjazdy i odbiory, najbliższe rezerwacje.
- **Kalendarz:** widok dnia (boksy 1–9) i tygodnia (siatka boks × dzień); dotknięcie wolnego pola tworzy rezerwację.
- **Klienci:** wyszukiwanie, karta klienta z psami (wielkość, waga, rasa, uwagi), historia pobytów, edycja i usuwanie.
- **Pobyt:** wybór klienta i psów (1–2), terminu, wolnego boksu, uwagi, wycena z zaliczką; potwierdzanie przyjazdu/odbioru,
  wpłaty, edycja, anulowanie i przywracanie.
- **Ustawienia:** cennik, zaliczka, czas na sprzątanie boksu, kopia zapasowa, dane przykładowe.

### Zasady do zatwierdzenia z hotelem

Cennik 70/80/100 zł, doba = rozpoczęte 24 h od przyjazdu, −50% na mniejszego z dwóch psów, brak reguły dla 3+ psów,
30% zaliczki, 60 min na sprzątanie – to wartości przykładowe z prototypu (`src/lib/pricing.ts`, `src/lib/data.ts`).

## Dla programisty

Wymagany Node.js 20+.

```bash
npm install
npm run web          # podgląd w przeglądarce (http://localhost:8081)
npm test             # testy logiki, wyceny i schematu bazy (PostgreSQL w pamięci – PGlite)
npm run typecheck
npm run build:web    # statyczna strona do katalogu dist/
```

Struktura:

```
app/                 ekrany (expo-router, każdy plik = adres URL)
  (tabs)/            zakładki: Start, Kalendarz, Klienci, Ustawienia
  pobyt/             nowy pobyt, szczegóły, edycja
  klient/            nowy klient, karta klienta
src/lib/             logika bez interfejsu (daty, dostępność boksów, wycena, dane) + testy
src/screens/         większe ekrany współdzielone przez kilka adresów
src/ui/              komponenty, kolory, okna dialogowe
src/store.tsx        stan aplikacji: tryb bazy (Supabase) albo lokalny, logowanie, odświeżanie na żywo
src/backend/         klient Supabase i tłumaczenie wierszy bazy na model aplikacji
supabase/migrations/ schemat bazy: tabele, reguły (triggery), RLS, funkcje
supabase/__tests__/  testy schematu na prawdziwym PostgreSQL (PGlite)
scripts/             uzupełnienie strony o dane PWA po buildzie
```

### Publikacja

Workflow `.github/workflows/deploy.yml` przy każdym pushu na `main` uruchamia testy, buduje stronę i publikuje ją
na GitHub Pages. Jednorazowo trzeba włączyć: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Kolejne etapy

1. Dodawanie pobytu głosem (rozpoznawanie mowy po polsku + szkic rezerwacji do zatwierdzenia).
2. Okresy specjalne w cenniku (święta) w ustawieniach, przypomnienia SMS, raporty.
3. Aplikacja na Androida/iPhone'a z tego samego kodu (EAS Build).
