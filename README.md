# Psotelgracja · prototyp mobilny Expo

**Stan:** działający lokalny prototyp do testów UX, NIE system produkcyjny hotelu. Obsługuje Android i iOS.

## Uruchomienie

Wymagane: Node.js 20+, npm, aplikacja Expo Go (dla wersji zgodnej z SDK) lub development build.

```bash
npm install
npx expo start
```

Uruchom aplikację na telefonie poprzez Expo Go. Jeśli SDK Expo Go nie jest zgodne, użyj development build (`npx expo run:android` / `npx expo run:ios` z odpowiednim środowiskiem).

## Działające funkcje prototypu
- 4 zakładki: Start, Boksy, Klienci, Pobyty.
- Dodawanie właścicieli i psów, waga opcjonalna, trzy rozmiary.
- Rezerwacje 1–2 psów tego samego właściciela, 9 boksów, kontrola nakładania dat.
- Edycja i anulowanie rezerwacji.
- Kalendarz dzienny boksów.
- Dane demonstracyjne i zapis lokalny przez AsyncStorage.
- Uprawnienia mikrofonu i rzeczywiste nagrywanie przez expo-audio.
- Tekstowy parser DEMO: imiona Luna, Borys, Reksio, Figa, daty DD.MM, godziny i numer boksu; wypełnia szkic do zatwierdzenia.

## Co jest celowo NIEZAIMPLEMENTOWANE
- Transkrypcja nagrania (speech-to-text), AI, integracja Supabase, konta użytkowników, synchronizacja między telefonami, push, płatności, realne ceny świąteczne, automatyczne rozliczenia.
- Nie ma gwarancji transakcyjnej między urządzeniami: zapis lokalny służy tylko do testowania UX.
- Ceny 70/80/100 zł to przykładowe liczby, NIE zweryfikowany cennik hotelu. Naliczanie pełnych dób jest uproszczeniem, NIE zatwierdzonym regulaminem. Nie używać do rzeczywistych rozliczeń.
- Rabat dla 3+ psów wymaga decyzji biznesowej i jest zablokowany.
- Wybór dat to na razie duże pola tekstowe w formacie RRRR-MM-DD. Docelowo należy wdrożyć natywny kalendarz i widoki tygodnia/miesiąca.
- Brak pojemności poszczególnych boksów i bufora sprzątania: do wdrożenia po ustaleniu reguł.

## Architektura kolejnego etapu
- Supabase Auth + RLS, PostgreSQL (owners, dogs, bookings, kennel_assignments, price_rules, payments, audit_log).
- Funkcja transakcyjna PostgreSQL `confirm_reservation` z blokadą boksu, ponowną kontrolą dostępności, idempotencją.
- Backend voice: audio -> STT PL -> schemat JSON -> identyfikacja psa/właściciela -> walidacja -> podgląd -> zatwierdzenie.
- Ceny wylicza backend, nie model AI.

## Prywatność
Nagrania pozostają na urządzeniu, prototyp nie przesyła ich na serwer. Dane demonstracyjne są zapisywane lokalnie bez produkcyjnego szyfrowania. Nie wprowadzaj prawdziwych danych klientów do tego prototypu.
