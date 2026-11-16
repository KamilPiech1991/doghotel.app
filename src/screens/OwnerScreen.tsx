import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { canDeleteDog, canDeleteOwner, dogNames } from '../lib/booking';
import { displayDate } from '../lib/dates';
import { Dog, Size, sizeLabel, sizes, statusLabel } from '../lib/types';
import { confirm, notify } from '../ui/dialog';
import { Button, DogAvatar, DogColorPicker, Field, H1, H2, H3, KennelBadge, Note, Panel, Row, Screen, st, Tile } from '../ui/components';
import { dogColor, nextDogColor } from '../lib/colors';
import { dogStays } from '../lib/history';
import { View } from 'react-native';

type DogDraft = { id?: string; name: string; size: Size; weight: string; breed: string; notes: string; color: string };
const emptyDog = (color: string): DogDraft => ({ name: '', size: 'small', weight: '', breed: '', notes: '', color });

export function DogForm({ initial, onSave, onCancel, saveLabel }: { initial: DogDraft; onSave: (d: DogDraft) => Promise<boolean>; onCancel?: () => void; saveLabel: string }) {
  const [d, setD] = useState(initial);
  const set = (patch: Partial<DogDraft>) => setD(p => ({ ...p, ...patch }));
  return (
    <>
      <Field label="Imię psa" value={d.name} onChange={name => set({ name })} />
      <Text style={st.label}>Wielkość (wymagana)</Text>
      <Row>{sizes.map(s => <Tile key={s} label={sizeLabel[s]} active={d.size === s} onPress={() => set({ size: s })} style={{ flex: 1 }} />)}</Row>
      <Field label="Waga w kg (opcjonalnie)" value={d.weight} onChange={weight => set({ weight })} keyboardType="decimal-pad" />
      <Field label="Rasa (opcjonalnie)" value={d.breed} onChange={breed => set({ breed })} />
      <Field label="Uwagi: karmienie, leki, zachowanie (opcjonalnie)" value={d.notes} onChange={notes => set({ notes })} multiline />
      <DogColorPicker value={d.color} onChange={color => set({ color })} />
      <Button title={saveLabel} kind="outline" onPress={async () => {
        if (!d.name.trim()) return notify('Wpisz imię psa');
        const ok = await onSave({ ...d, name: d.name.trim() });
        if (ok && !d.id) setD(emptyDog(d.color));
      }} />
      {onCancel ? <Button title="Anuluj" kind="outline" onPress={onCancel} /> : null}
    </>
  );
}

const toDraft = (d: Dog): DogDraft => ({ id: d.id, name: d.name, size: d.size, weight: d.weight ?? '', breed: d.breed ?? '', notes: d.notes ?? '', color: dogColor(d).id });
const fromDraft = (ownerId: string, d: DogDraft): Omit<Dog, 'id'> & { id?: string } => ({
  id: d.id, ownerId, name: d.name, size: d.size, color: d.color,
  weight: d.weight.trim() || undefined, breed: d.breed.trim() || undefined, notes: d.notes.trim() || undefined,
});

export function OwnerScreen({ ownerId }: { ownerId?: string }) {
  const { db, saveOwner, deleteOwner, saveDog, deleteDog } = useStore();
  const owner = db.owners.find(o => o.id === ownerId);
  const [name, setName] = useState(owner?.name ?? '');
  const [phone, setPhone] = useState(owner?.phone ?? '');
  const [notes, setNotes] = useState(owner?.notes ?? '');
  const [editingDog, setEditingDog] = useState<string | null>(null);

  if (ownerId && !owner)
    return <Screen back title="Klient"><Note>Nie znaleziono klienta.</Note></Screen>;

  const dogs = db.dogs.filter(d => d.ownerId === ownerId);
  const history = db.bookings.filter(b => b.ownerId === ownerId).sort((a, b) => b.arrival.localeCompare(a.arrival));

  const save = async () => {
    if (!name.trim()) return notify('Wpisz imię i nazwisko klienta');
    const id = await saveOwner({ id: ownerId, name: name.trim(), phone: phone.trim(), notes: notes.trim() || undefined });
    if (!id) return;
    if (!ownerId) router.replace(`/klient/${id}`);
    else notify('Zapisano dane klienta');
  };

  const remove = async () => {
    if (!canDeleteOwner(db, ownerId!)) return notify('Nie można usunąć', 'Ten klient ma zapisane pobyty. Usunięcie skasowałoby historię rezerwacji.');
    if (await confirm('Usunąć klienta?', `${owner!.name} i wszystkie jego psy zostaną usunięte.`, 'Usuń', true)) {
      if (await deleteOwner(ownerId!)) router.back();
    }
  };

  const removeDog = async (d: Dog) => {
    if (!canDeleteDog(db, d.id)) return notify('Nie można usunąć', `${d.name} ma zapisane pobyty.`);
    if (await confirm(`Usunąć psa ${d.name}?`, 'Tej czynności nie można cofnąć.', 'Usuń', true)) await deleteDog(d.id);
  };

  return (
    <Screen back title={owner ? owner.name : 'Nowy klient'}>
      <H1>{owner ? 'Klient' : 'Nowy klient'}</H1>
      <Panel>
        <Field label="Imię i nazwisko" value={name} onChange={setName} />
        <Field label="Telefon (opcjonalnie)" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <Field label="Uwagi (opcjonalnie)" value={notes} onChange={setNotes} multiline />
        <Button title={owner ? 'Zapisz zmiany' : 'Zapisz klienta'} onPress={save} />
      </Panel>

      {owner ? (
        <>
          <Button title="＋ Zarezerwuj pobyt" onPress={() => router.push(`/pobyt/nowy?ownerId=${owner.id}`)} />
          <H2>Psy ({dogs.length})</H2>
          {dogs.map(d => (
            <Panel key={d.id}>
              {editingDog === d.id ? (
                <DogForm initial={toDraft(d)} saveLabel="Zapisz psa" onCancel={() => setEditingDog(null)} onSave={async x => { const ok = !!(await saveDog(fromDraft(owner.id, x))); if (ok) setEditingDog(null); return ok; }} />
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <DogAvatar dog={d} size={48} />
                    <H3>{d.name}</H3>
                  </View>
                  <Note>{sizeLabel[d.size]}{d.weight ? ` · ${d.weight} kg` : ''}{d.breed ? ` · ${d.breed}` : ''}</Note>
                  {d.notes ? <Note>Uwagi: {d.notes}</Note> : null}
                  {(() => { const stays = dogStays(db, d.id); return <Note>{stays.length ? `Pobytów: ${stays.length} · ostatni: ${displayDate(stays[0].arrival).slice(0, 10)}` : 'Jeszcze nie było u nas.'}</Note>; })()}
                  <Row>
                    <Button title="Edytuj" kind="outline" onPress={() => setEditingDog(d.id)} style={{ flex: 1 }} />
                    <Button title="Usuń" kind="outline" onPress={() => removeDog(d)} style={{ flex: 1 }} />
                  </Row>
                </>
              )}
            </Panel>
          ))}
          <Panel>
            <H3>Dodaj psa</H3>
            <DogForm key={dogs.length} initial={emptyDog(nextDogColor(db.dogs, owner.id))} saveLabel="+ Dodaj psa" onSave={async x => !!(await saveDog(fromDraft(owner.id, x)))} />
          </Panel>

          <H2>Historia pobytów ({history.length})</H2>
          {history.map(b => (
            <Tile key={b.id} leading={<KennelBadge n={b.kennel} />} label={`${dogNames(db, b)} · boks ${b.kennel}`} sub={`${displayDate(b.arrival)} – ${displayDate(b.departure)} · ${statusLabel[b.status]}`} onPress={() => router.push(`/pobyt/${b.id}`)} />
          ))}
          {!history.length ? <Note>Brak pobytów.</Note> : null}
          <Button title="Usuń klienta" kind="danger" onPress={remove} />
        </>
      ) : null}
    </Screen>
  );
}
