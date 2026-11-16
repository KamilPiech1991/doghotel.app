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

> ⚠️ **Dane są zapisywane tylko na tym telefonie, w tej przeglądarce.** Nie ma jeszcze serwera ani synchronizacji
> między telefonami. Regularnie rób kopię: **Ustawienia → Pobierz kopię zapasową** i zapisuj plik np. na Dysku Google.
> Kopię można wczytać na innym telefonie (**Przywróć z pliku**).

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
npm test             # testy logiki rezerwacji i wyceny
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
src/store.tsx        stan aplikacji i zapis w pamięci urządzenia
scripts/             uzupełnienie strony o dane PWA po buildzie
```

### Publikacja

Workflow `.github/workflows/deploy.yml` przy każdym pushu na `main` uruchamia testy, buduje stronę i publikuje ją
na GitHub Pages. Jednorazowo trzeba włączyć: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Kolejne etapy

1. Backend (Supabase): logowanie, wspólne dane dla kilku telefonów, zatwierdzanie rezerwacji po stronie serwera.
2. Dodawanie pobytu głosem (rozpoznawanie mowy po polsku + szkic rezerwacji do zatwierdzenia).
3. Okresy specjalne w cenniku (święta) w ustawieniach, przypomnienia SMS, raporty.
4. Aplikacja na Androida/iPhone'a z tego samego kodu (EAS Build).
