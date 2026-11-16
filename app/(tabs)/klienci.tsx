import { useState } from 'react';
import { router } from 'expo-router';
import { useStore } from '../../src/store';
import { sizeLabel } from '../../src/lib/types';
import { Button, Field, H1, Note, Screen, Tile } from '../../src/ui/components';

export default function Clients() {
  const { db } = useStore();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const list = db.owners
    .filter(o => `${o.name} ${o.phone} ${db.dogs.filter(d => d.ownerId === o.id).map(d => d.name).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  return (
    <Screen title="Klienci i pieski">
      <H1>Klienci</H1>
      <Button title="＋ Nowy klient" onPress={() => router.push('/klient/nowy')} />
      <Field label="Szukaj po nazwisku, telefonie lub imieniu psa" value={search} onChange={setSearch} placeholder="np. Kowalska albo Luna" />
      {list.map(o => {
        const dogs = db.dogs.filter(d => d.ownerId === o.id);
        return (
          <Tile
            key={o.id}
            label={o.name}
            sub={`${o.phone || 'brak telefonu'} · ${dogs.length ? dogs.map(d => `${d.name} (${sizeLabel[d.size].toLowerCase()})`).join(', ') : 'brak psów'}`}
            onPress={() => router.push(`/klient/${o.id}`)}
          />
        );
      })}
      {!list.length ? <Note>{db.owners.length ? 'Nikogo nie znaleziono.' : 'Nie ma jeszcze klientów.'}</Note> : null}
    </Screen>
  );
}
