import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DB } from '../../src/lib/types';
import { useStore } from '../../src/store';
import { emptyDb, migrate, serialize } from '../../src/lib/data';
import { plural, today } from '../../src/lib/dates';
import { sizeLabel, sizes } from '../../src/lib/types';
import { downloadText, pickTextFile } from '../../src/lib/backupWeb';
import { confirm, notify } from '../../src/ui/dialog';
import { Button, H1, H2, Note, NumberField, Panel, Screen, Warning } from '../../src/ui/components';

const count = (d: DB) =>
  `${d.owners.length} ${plural(d.owners.length, 'klient', 'klientów', 'klientów')}, ${d.dogs.length} ${plural(d.dogs.length, 'pies', 'psy', 'psów')}, ${d.bookings.length} ${plural(d.bookings.length, 'pobyt', 'pobyty', 'pobytów')}`;

export default function SettingsScreen() {
  const { db, mode, userEmail, updateSettings, replaceAll, loadDemo, signOut, readLocalData, markLocalDataMoved } = useStore();
  const s = db.settings;
  const web = Platform.OS === 'web';
  const remoteMode = mode === 'remote';
  const [localData, setLocalData] = useState<DB | null>(null);

  useEffect(() => {
    if (!remoteMode) return;
    readLocalData().then(d => setLocalData(d && (d.owners.length || d.bookings.length) ? d : null)).catch(() => {});
  }, [remoteMode, readLocalData]);

  const moveLocalToDb = async () => {
    if (!localData) return;
    const ok = await confirm(
      'Przenieść dane do bazy?',
      `Z tego telefonu zostaną przesłane dane: ${count(localData)}. UWAGA: obecne dane w bazie zostaną zastąpione.`,
      'Przenieś', true,
    );
    if (ok && (await replaceAll(localData))) {
      await markLocalDataMoved();
      setLocalData(null);
      notify('Gotowe', 'Dane z telefonu są teraz w bazie i widać je na wszystkich urządzeniach.');
    }
  };

  const exportBackup = () => downloadText(`psotelgracja-kopia-${today()}.json`, serialize(db));

  const importBackup = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const next = migrate(JSON.parse(text));
      const ok = await confirm('Przywrócić kopię?', `Plik zawiera: ${count(next)}. Obecne dane na tym urządzeniu zostaną zastąpione.`, 'Przywróć', true);
      if (ok && (await replaceAll(next))) notify('Przywrócono dane z kopii');
    } catch (e) {
      notify('Nie udało się wczytać pliku', e instanceof Error && e.message.includes('Psotelgracji') ? e.message : 'Plik jest uszkodzony lub ma zły format.');
    }
  };

  return (
    <Screen title="Ustawienia">
      <H1>Ustawienia</H1>

      <Panel>
        <H2>{remoteMode ? 'Konto i baza danych' : 'Zapis danych'}</H2>
        {remoteMode ? (
          <>
            <Note>Zalogowano jako: {userEmail}</Note>
            <Note>Dane są zapisywane w bazie Supabase i widoczne na wszystkich telefonach personelu. Zmiany z innych urządzeń pojawiają się automatycznie.</Note>
            {localData ? (
              <>
                <Warning>Na tym telefonie są dane zapisane wcześniej lokalnie ({count(localData)}).</Warning>
                <Button title="⬆ Prześlij dane z tego telefonu do bazy" onPress={moveLocalToDb} />
              </>
            ) : null}
            <Button title="Wyloguj się" kind="outline" onPress={signOut} />
          </>
        ) : (
          <Warning>Baza danych nie jest podłączona – dane są zapisywane tylko na tym urządzeniu.</Warning>
        )}
      </Panel>

      <Panel>
        <H2>Cennik (zł za dobę)</H2>
        <Warning>Stawki przykładowe – do zatwierdzenia z hotelem. Doba = rozpoczęte 24 godziny od przyjazdu. Drugi, mniejszy pies: −50%.</Warning>
        {sizes.map(size => (
          <NumberField key={size} label={`Pies ${sizeLabel[size].toLowerCase()}`} value={s.rates[size]} onChange={v => updateSettings({ rates: { ...s.rates, [size]: v } })} />
        ))}
        <NumberField label="Zaliczka (%)" value={s.depositPercent} max={100} onChange={v => updateSettings({ depositPercent: v })} />
      </Panel>

      <Panel>
        <H2>Boksy</H2>
        <NumberField label="Czas na sprzątanie boksu między pobytami (minuty)" value={s.cleaningMinutes} max={24 * 60} onChange={v => updateSettings({ cleaningMinutes: Math.round(v) })} />
        <Note>Liczba boksów: {s.kennelCount}</Note>
      </Panel>

      <Panel>
        <H2>Kopia zapasowa</H2>
        <Note>{remoteMode ? 'Plik z kopią wszystkich danych z bazy – na wszelki wypadek, np. raz w miesiącu.' : 'Dane są zapisane tylko w tej przeglądarce na tym telefonie. Wyczyszczenie danych przeglądarki lub zmiana telefonu usunie je. Rób kopię regularnie, np. raz w tygodniu, i zapisuj plik na Dysku Google lub w mailu.'}</Note>
        {web ? (
          <>
            <Button title="⬇ Pobierz kopię zapasową" onPress={exportBackup} />
            <Button title="⬆ Przywróć z pliku" kind="outline" onPress={importBackup} />
          </>
        ) : <Note>Kopia zapasowa jest dostępna w wersji przeglądarkowej.</Note>}
      </Panel>

      <Panel>
        <H2>Dane testowe</H2>
        <Button title="Wczytaj dane przykładowe" kind="outline" onPress={async () => {
          if (await confirm('Wczytać dane przykładowe?', remoteMode ? 'UWAGA: wszystkie dane w bazie (na wszystkich telefonach) zostaną zastąpione przykładowymi.' : 'Obecne dane zostaną zastąpione przykładowymi.', 'Wczytaj', true)) loadDemo();
        }} />
        <Button title="Usuń wszystkie dane" kind="danger" onPress={async () => {
          if (await confirm('Usunąć WSZYSTKIE dane?', remoteMode ? 'Klienci, psy i pobyty zostaną usunięte z BAZY – na wszystkich telefonach. Najpierw pobierz kopię zapasową!' : 'Klienci, psy i pobyty zostaną usunięte z tego urządzenia. Najpierw pobierz kopię zapasową!', 'Usuń wszystko', true)) replaceAll(emptyDb());
        }} />
      </Panel>
      <Note>Wersja 0.3 · {remoteMode ? 'baza Supabase' : 'zapis lokalny'}</Note>
    </Screen>
  );
}
