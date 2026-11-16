# Instrukcja: baza danych Supabase dla Psotelgracji

Po wykonaniu tych kroków wszystkie dane (klienci, psy, pobyty, wpłaty, cennik) będą zapisywane w bazie
w internecie, wspólnej dla wszystkich telefonów personelu. Nic nie jest usuwane automatycznie – stare pobyty
zostają w bazie na zawsze i można je przeglądać w zakładce **Historia**.

Czas: ok. 15–20 minut. Potrzebne: komputer (wygodniej niż telefon) i dostęp do konta GitHub.

---

## Krok 1. Załóż konto w Supabase

1. Wejdź na **https://supabase.com** i kliknij **Start your project** (albo **Sign up**).
2. Zaloguj się przez **GitHub** (najprościej – to samo konto, na którym jest kod aplikacji) albo załóż konto
   na e-mail i potwierdź adres linkiem z poczty.
3. Jeśli pojawi się pytanie o **organizację** (Organization): wpisz np. `Psotelgracja`, typ **Personal**,
   plan **Free** (darmowy) → **Create organization**.

## Krok 2. Utwórz projekt (bazę danych)

1. Kliknij **New project**.
2. Wypełnij:
   - **Project name:** `psotelgracja`
   - **Database password:** kliknij **Generate a password**, a potem **skopiuj hasło i zapisz w bezpiecznym miejscu**
     (np. w menedżerze haseł). W codziennej pracy nie będzie potrzebne, ale warto je mieć.
   - **Region:** **Central EU (Frankfurt)** – dane klientów zostają w Unii Europejskiej (RODO).
   - Plan: **Free**.
3. Kliknij **Create new project** i poczekaj 1–2 minuty, aż projekt się uruchomi.

## Krok 3. Utwórz tabele (wklej gotowy skrypt)

1. W menu po lewej wybierz **SQL Editor** (ikona `>_`).
2. Kliknij **New query** (albo **+**).
3. Otwórz plik ze skryptem:
   [supabase/migrations/20261116000000_init.sql](../supabase/migrations/20261116000000_init.sql)
   – na GitHubie kliknij przycisk **Copy raw file** (ikona kopiowania nad treścią pliku).
4. Wklej całość do okna SQL Editora i kliknij **Run** (lub Ctrl+Enter).
5. Na dole powinno pojawić się **Success. No rows returned**.
   Jeśli Supabase zapyta o potwierdzenie operacji („destructive operation”), kliknij **Run this query** –
   skrypt niczego nie kasuje w nowej bazie.

> Skrypt można bezpiecznie uruchomić ponownie – nie usuwa danych.

## Krok 4. Wpisz, kto ma dostęp (lista personelu)

Dane zobaczą **tylko** osoby, których e-mail jest na tej liście – nawet jeśli ktoś obcy założy konto.

1. W SQL Editorze kliknij **New query**, wklej i popraw adresy (małymi literami):
   ```sql
   insert into public.staff (email) values
     ('twoj@email.pl'),
     ('pracownik@email.pl');
   ```
2. Kliknij **Run**.

## Krok 5. Załóż konta do logowania

Dla każdej osoby z listy personelu:

1. Menu po lewej: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Wpisz **e-mail** (ten sam co na liście personelu) i **hasło** (min. 6 znaków; lepiej dłuższe).
3. Zaznacz **Auto Confirm User** → **Create user**.
4. Przekaż tej osobie e-mail i hasło – loguje się nimi w aplikacji.

Zalecane – żeby nikt obcy nie mógł sam założyć konta:

5. **Authentication** → **Sign In / Providers** (w niektórych wersjach panelu: *Configuration → Sign In / Providers*)
   → wyłącz **Allow new users to sign up** → **Save**.

Zmiana zapomnianego hasła: **Authentication → Users** → przy osobie **…** → **Delete user**, a potem załóż konto
ponownie z nowym hasłem (krok 5). Dane hotelu nie są przypisane do kont, więc nic nie zginie.

## Krok 6. Skopiuj adres i klucz bazy

1. Kliknij **Connect** (u góry projektu) albo przejdź do **Project Settings → API Keys**.
2. Skopiuj dwie wartości:
   - **Project URL** – wygląda jak `https://abcdefgh.supabase.co`
   - klucz **Publishable key** – zaczyna się od `sb_publishable_…`
     (jeśli go nie ma, kliknij **Create new API Keys**; starszy klucz *anon* też zadziała).

> Klucz *publishable* może być publiczny – trafia do aplikacji w przeglądarce. Dane chronią reguły w bazie
> (logowanie + lista personelu). **Nigdy** nie kopiuj nigdzie klucza **secret** ani *service_role*.

## Krok 7. Podłącz bazę do aplikacji (GitHub)

1. Otwórz repozytorium **github.com/KamilPiech1991/doghotel.app** → **Settings**.
2. Po lewej: **Secrets and variables** → **Actions** → zakładka **Variables** → **New repository variable**:
   - Name: `SUPABASE_URL`, Value: *Project URL z kroku 6* → **Add variable**
   - Name: `SUPABASE_KEY`, Value: *Publishable key z kroku 6* → **Add variable**
3. Jeśli jeszcze nie: **Settings → Pages** → **Source: GitHub Actions**.
4. Scal pull request z bazą danych (**Pull requests** → *Baza danych Supabase…* → **Ready for review** →
   **Merge pull request**). Po ok. 2 minutach aplikacja z bazą będzie pod adresem:
   **https://kamilpiech1991.github.io/doghotel.app/**

   Jeśli zmienne dodasz już po scaleniu: **Actions** → *Testy i publikacja na GitHub Pages* → **Run workflow**.

## Krok 8. Pierwsze uruchomienie

1. Otwórz aplikację na telefonie → pojawi się ekran **Zaloguj się** → wpisz e-mail i hasło z kroku 5.
2. Jeśli na tym telefonie były już dane z wersji bez bazy: **Ustawienia** → **Prześlij dane z tego telefonu do bazy**.
   Zrób to tylko na **jednym** telefonie (zastępuje dane w bazie).
3. Dodaj aplikację do ekranu głównego (Android: menu ⋮ → *Dodaj do ekranu głównego*; iPhone: *Udostępnij →
   Do ekranu początkowego*).
4. Sprawdź na drugim telefonie: po zalogowaniu widać te same dane, a zmiany pojawiają się same.

---

## Przeglądanie starych danych i pobytów

- **W aplikacji – zakładka Historia:** wszystkie pobyty od początku, także zakończone i anulowane.
  Można szukać po imieniu psa, nazwisku, telefonie lub numerze boksu, filtrować (nadchodzące / trwające /
  zakończone / anulowane), przełączać miesiące albo wybrać **Cały okres**. U góry jest podsumowanie:
  liczba pobytów, przychód, wpłaty i kwota do zapłaty.
- **Karta klienta:** historia pobytów klienta oraz przy każdym psie liczba pobytów i data ostatniego.
- **Kalendarz:** strzałkami można cofać się do dowolnego dnia lub tygodnia w przeszłości.
- **W panelu Supabase:** **Table Editor** → tabele `owners` (klienci), `dogs` (psy), `bookings` (pobyty) –
  podgląd jak w arkuszu, z możliwością eksportu do CSV (**Export**). Uwaga: zmiany wprowadzone tutaj omijają
  sprawdzanie w aplikacji – edytuj dane raczej w aplikacji.

## Kopie zapasowe i koszty

- Darmowy plan Supabase **nie robi kopii zapasowych do pobrania**. Raz w miesiącu użyj w aplikacji:
  **Ustawienia → Pobierz kopię zapasową** i zapisz plik np. na Dysku Google.
  (Plan **Pro**, ok. 25 USD/mies., ma codzienne kopie z 7 dni.)
- Darmowy projekt jest **usypiany po tygodniu bez żadnego użycia**. Przy codziennej pracy to się nie zdarzy;
  jeśli się zdarzy, w panelu Supabase kliknij **Restore project** – dane zostają.

## Dodanie nowego pracownika później

1. SQL Editor: `insert into public.staff (email) values ('nowy@email.pl');` → **Run**
2. Authentication → Users → **Add user** (krok 5).

Odebranie dostępu: `delete from public.staff where email = 'byly@email.pl';` oraz usunięcie konta w
Authentication → Users.

## Co pilnuje baza

- Ten sam boks nie może być zajęty dwa razy w tym samym czasie (z czasem na sprzątanie) – także gdy dwie osoby
  rezerwują jednocześnie z dwóch telefonów; druga dostanie komunikat „Boks jest zajęty”.
- Psy w rezerwacji muszą należeć do tego klienta.
- Nie da się usunąć klienta ani psa, który ma historię pobytów.
- Wpłaty wpisane jednocześnie przez dwie osoby sumują się poprawnie.
