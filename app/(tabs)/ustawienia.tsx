import { Platform } from 'react-native';
import { useStore } from '../../src/store';
import { emptyDb, migrate, serialize } from '../../src/lib/data';
import { today } from '../../src/lib/dates';
import { sizeLabel, sizes } from '../../src/lib/types';
import { downloadText, pickTextFile } from '../../src/lib/backupWeb';
import { confirm, notify } from '../../src/ui/dialog';
import { Button, H1, H2, Note, NumberField, Panel, Screen, Warning } from '../../src/ui/components';

export default function SettingsScreen() {
  const { db, updateSettings, replaceAll, loadDemo } = useStore();
  const s = db.settings;
  const web = Platform.OS === 'web';

  const exportBackup = () => downloadText(`psotelgracja-kopia-${today()}.json`, serialize(db));

  const importBackup = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const next = migrate(JSON.parse(text));
      const ok = await confirm('Przywrócić kopię?', `Plik zawiera ${next.owners.length} klientów, ${next.dogs.length} psów i ${next.bookings.length} pobytów. Obecne dane na tym urządzeniu zostaną zastąpione.`, 'Przywróć', true);
      if (ok) { replaceAll(next); notify('Przywrócono dane z kopii'); }
    } catch (e) {
      notify('Nie udało się wczytać pliku', e instanceof Error && e.message.includes('Psotelgracji') ? e.message : 'Plik jest uszkodzony lub ma zły format.');
    }
  };

  return (
    <Screen title="Ustawienia">
      <H1>Ustawienia</H1>

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
        <Note>Dane są zapisane tylko w tej przeglądarce na tym telefonie. Wyczyszczenie danych przeglądarki lub zmiana telefonu usunie je. Rób kopię regularnie, np. raz w tygodniu, i zapisuj plik na Dysku Google lub w mailu.</Note>
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
          if (await confirm('Wczytać dane przykładowe?', 'Obecne dane zostaną zastąpione przykładowymi.', 'Wczytaj', true)) loadDemo();
        }} />
        <Button title="Usuń wszystkie dane" kind="danger" onPress={async () => {
          if (await confirm('Usunąć WSZYSTKIE dane?', 'Klienci, psy i pobyty zostaną usunięte z tego urządzenia. Najpierw pobierz kopię zapasową!', 'Usuń wszystko', true)) replaceAll(emptyDb());
        }} />
      </Panel>
      <Note>Wersja 0.2 · aplikacja webowa</Note>
    </Screen>
  );
}
