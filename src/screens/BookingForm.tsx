import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { freeKennels, kennelNumbers, validateBooking } from '../lib/booking';
import { displayDate, isValidDateKey, isValidTime, localDateKey, localTime, parseLocal, plural, pln, plusDays, today } from '../lib/dates';
import { depositFor, quote } from '../lib/pricing';
import { Booking, Size, sizeLabel, sizes, uid } from '../lib/types';
import { confirm, notify } from '../ui/dialog';
import { Button, DateField, DogAvatar, Field, H1, H2, H3, Note, Panel, Row, Screen, st, Tile, TimeGrid, Warning } from '../ui/components';
import { dogColor, kennelColor, nextDogColor } from '../lib/colors';
import { colors } from '../ui/theme';


type Preset = { ownerId?: string; kennel?: number; date?: string; dogIds?: string[]; arrivalTime?: string; departureDate?: string; departureTime?: string };

export function BookingForm({ bookingId, preset }: { bookingId?: string; preset?: Preset }) {
  const { db, saveBooking, saveOwner, saveDog } = useStore();
  const editing = db.bookings.find(b => b.id === bookingId);
  const startDay = preset?.date && isValidDateKey(preset.date) ? preset.date : today();

  const [ownerId, setOwnerId] = useState(editing?.ownerId ?? preset?.ownerId ?? '');
  const presetDogs = (preset?.dogIds ?? []).filter(id => db.dogs.find(d => d.id === id)?.ownerId === preset?.ownerId);
  const [dogIds, setDogIds] = useState<string[]>(editing?.dogIds ?? presetDogs);
  const [arrivalDate, setArrivalDate] = useState(editing ? localDateKey(editing.arrival) : startDay);
  const [arrivalTime, setArrivalTime] = useState(editing ? localTime(editing.arrival) : preset?.arrivalTime && isValidTime(preset.arrivalTime) ? preset.arrivalTime : '10:00');
  const [departureDate, setDepartureDate] = useState(editing ? localDateKey(editing.departure) : preset?.departureDate && isValidDateKey(preset.departureDate) ? preset.departureDate : plusDays(startDay, 2));
  const [departureTime, setDepartureTime] = useState(editing ? localTime(editing.departure) : preset?.departureTime && isValidTime(preset.departureTime) ? preset.departureTime : '15:00');
  const [kennel, setKennel] = useState<number | null>(editing?.kennel ?? preset?.kennel ?? null);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [changingOwner, setChangingOwner] = useState(!ownerId);
  const [newOwner, setNewOwner] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [newDog, setNewDog] = useState<{ name: string; size: Size; weight: string }>({ name: '', size: 'small', weight: '' });

  const arrival = parseLocal(arrivalDate, arrivalTime);
  const departure = parseLocal(departureDate, departureTime);
  const free = useMemo(() => freeKennels(db, arrival, departure, bookingId), [db, arrival, departure, bookingId]);
  const owner = db.owners.find(o => o.id === ownerId);
  const ownerDogs = db.dogs.filter(d => d.ownerId === ownerId);
  const selectedDogs = db.dogs.filter(d => dogIds.includes(d.id));
  const pricing = quote(db.settings, selectedDogs, arrival, departure);
  const intervalOk = !!arrival && !!departure && Date.parse(departure) > Date.parse(arrival);
  const kennelTaken = kennel !== null && intervalOk && !free.includes(kennel);

  const q = ownerSearch.trim().toLowerCase();
  const owners = db.owners
    .filter(o => `${o.name} ${o.phone} ${db.dogs.filter(d => d.ownerId === o.id).map(d => d.name).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  const chooseOwner = (id: string) => { setOwnerId(id); setDogIds([]); setChangingOwner(false); setOwnerSearch(''); };

  const addOwner = async () => {
    if (!newOwner.name.trim()) return notify('Wpisz imię i nazwisko klienta');
    const id = await saveOwner({ name: newOwner.name.trim(), phone: newOwner.phone.trim() });
    if (!id) return;
    chooseOwner(id);
    setNewOwner({ name: '', phone: '' });
  };

  const addDog = async () => {
    if (!ownerId) return notify('Najpierw wybierz klienta');
    if (!newDog.name.trim()) return notify('Wpisz imię psa');
    const id = await saveDog({ ownerId, name: newDog.name.trim(), size: newDog.size, weight: newDog.weight.trim() || undefined, color: nextDogColor(db.dogs, ownerId) });
    if (!id) return;
    setDogIds(p => [...p, id]);
    setNewDog({ name: '', size: 'small', weight: '' });
  };

  const save = async () => {
    const errors = validateBooking(db, { id: bookingId, ownerId, dogIds, kennel, arrival, departure });
    if (errors.length) return notify('Uzupełnij rezerwację', errors.join('\n'));
    if (pricing.total === null) return notify('Brak wyceny', pricing.missing.join('\n'));
    const ok = await confirm(
      editing ? 'Zapisać zmiany?' : 'Potwierdź rezerwację',
      `${owner!.name}\n${selectedDogs.map(d => d.name).join(', ')}\nBoks ${kennel}\n${displayDate(arrival!)} – ${displayDate(departure!)}\nCena: ${pln(pricing.total)}`,
      'Zapisz pobyt',
    );
    if (!ok) return;
    const b: Booking = {
      id: bookingId ?? uid(),
      ownerId, dogIds, kennel: kennel!, arrival: arrival!, departure: departure!,
      status: editing?.status ?? 'reserved',
      total: pricing.total,
      deposit: depositFor(pricing.total, db.settings.depositPercent),
      paid: editing?.paid ?? 0,
      notes: notes.trim() || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    setSaving(true);
    const saved = await saveBooking(b);
    setSaving(false);
    if (saved) router.replace(`/pobyt/${b.id}`);
  };

  if (bookingId && !editing) return <Screen back title="Pobyt"><Note>Nie znaleziono pobytu.</Note></Screen>;

  return (
    <Screen back title={editing ? 'Edycja pobytu' : 'Nowy pobyt'}>
      <H1>{editing ? 'Edytuj pobyt' : 'Nowy pobyt'}</H1>

      <H2>1. Klient</H2>
      {owner && !changingOwner ? (
        <Panel>
          <H3>{owner.name}</H3>
          <Note>{owner.phone || 'brak telefonu'}</Note>
          <Button title="Zmień klienta" kind="outline" onPress={() => setChangingOwner(true)} />
        </Panel>
      ) : (
        <>
          <Field label="Wyszukaj klienta" value={ownerSearch} onChange={setOwnerSearch} placeholder="Nazwisko, telefon lub imię psa" />
          {owners.slice(0, q ? 20 : 8).map(o => (
            <Tile key={o.id} label={o.name} sub={o.phone || undefined} active={ownerId === o.id} onPress={() => chooseOwner(o.id)} />
          ))}
          {!q && owners.length > 8 ? <Note>…i {owners.length - 8} więcej – wpisz nazwisko, aby zawęzić.</Note> : null}
          <Panel>
            <H3>Nowy klient</H3>
            <Field label="Imię i nazwisko" value={newOwner.name} onChange={name => setNewOwner(p => ({ ...p, name }))} />
            <Field label="Telefon (opcjonalnie)" value={newOwner.phone} onChange={phone => setNewOwner(p => ({ ...p, phone }))} keyboardType="phone-pad" />
            <Button title="+ Dodaj klienta" kind="outline" onPress={addOwner} />
          </Panel>
        </>
      )}

      <H2>2. Psy</H2>
      {!ownerId ? <Note>Najpierw wybierz klienta.</Note> : (
        <>
          {ownerDogs.map(d => {
            const on = dogIds.includes(d.id);
            return <Tile key={d.id} leading={<DogAvatar dog={d} size={40} />} activeColor={dogColor(d).hex} label={`${on ? '✓ ' : ''}${d.name}`} sub={`${sizeLabel[d.size]}${d.weight ? ` · ${d.weight} kg` : ''}`} active={on} onPress={() => setDogIds(p => (on ? p.filter(x => x !== d.id) : [...p, d.id]))} />;
          })}
          {!ownerDogs.length ? <Note>Ten klient nie ma jeszcze psów – dodaj poniżej.</Note> : null}
          <Panel>
            <H3>Dodaj psa</H3>
            <Field label="Imię psa" value={newDog.name} onChange={name => setNewDog(p => ({ ...p, name }))} />
            <Text style={st.label}>Wielkość (wymagana)</Text>
            <Row>{sizes.map(s => <Tile key={s} label={sizeLabel[s]} active={newDog.size === s} onPress={() => setNewDog(p => ({ ...p, size: s }))} style={{ flex: 1 }} />)}</Row>
            <Field label="Waga w kg (opcjonalnie)" value={newDog.weight} onChange={weight => setNewDog(p => ({ ...p, weight }))} keyboardType="decimal-pad" />
            <Button title="+ Dodaj i zaznacz psa" kind="outline" onPress={addDog} />
          </Panel>
        </>
      )}

      <H2>3. Termin</H2>
      <Panel>
        <DateField label="Dzień przyjazdu" value={arrivalDate} onChange={setArrivalDate} />
        <TimeGrid label="Godzina przyjazdu" value={arrivalTime} onChange={setArrivalTime} />
      </Panel>
      <Panel>
        <DateField label="Dzień odbioru" value={departureDate} onChange={setDepartureDate} />
        <TimeGrid label="Godzina odbioru" value={departureTime} onChange={setDepartureTime} />
      </Panel>
      {!intervalOk ? <Warning>Podaj poprawny termin – odbiór musi być później niż przyjazd.</Warning> : null}

      <H2>4. Boks</H2>
      <Row style={{ justifyContent: 'space-between' }}>
        {kennelNumbers(db).map(k => {
          const isFree = free.includes(k);
          const c = kennelColor(k);
          return <Tile key={k} label={`Boks ${k}`} sub={intervalOk ? (isFree ? 'wolny' : 'zajęty') : '—'} tint={c.light} borderColor={c.strong} activeColor={c.strong} active={kennel === k} disabled={!isFree} onPress={() => setKennel(k)} style={{ width: '31%', borderWidth: kennel === k ? 3 : 2 }} />;
        })}
      </Row>
      {kennelTaken ? <Warning>Wybrany boks {kennel} jest zajęty w tym terminie – wybierz inny.</Warning> : null}
      <Note>Każdy boks ma swój kolor. Szare boksy są zajęte (z uwzględnieniem {db.settings.cleaningMinutes} min na sprzątanie).</Note>

      <H2>5. Uwagi do pobytu</H2>
      <Field label="Karmienie, leki, kontakt awaryjny (opcjonalnie)" value={notes} onChange={setNotes} multiline />

      <Panel>
        <H2>Podsumowanie</H2>
        <Note>{pricing.days} {plural(pricing.days, 'doba', 'doby', 'dób')} · {dogIds.length} {plural(dogIds.length, 'pies', 'psy', 'psów')} · boks {kennel ?? 'nie wybrano'}</Note>
        {pricing.details.map((line, i) => <Text key={i} style={{ fontSize: 15, color: colors.ink, lineHeight: 22 }}>{line}</Text>)}
        {pricing.missing.map((line, i) => <Warning key={i}>{line}</Warning>)}
        <Text style={{ fontSize: 30, fontWeight: '900', color: colors.green }}>{pricing.total === null ? 'Wycena niekompletna' : pln(pricing.total)}</Text>
        {pricing.total !== null ? <Note>Zaliczka ({db.settings.depositPercent}%): {pln(depositFor(pricing.total, db.settings.depositPercent))}</Note> : null}
      </Panel>
      <Button title={saving ? 'Zapisywanie…' : editing ? '✓ Zapisz zmiany' : '✓ Zapisz pobyt'} onPress={save} disabled={saving} />
      <Button title="Anuluj" kind="outline" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
