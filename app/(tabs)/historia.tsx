import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../../src/store';
import { dogNames, ownerName } from '../../src/lib/booking';
import { displayDate, pln, plural, today } from '../../src/lib/dates';
import { bookingPhase, filterHistory, monthLabel, monthOf, phaseLabel, PhaseFilter, plusMonths, summarize } from '../../src/lib/history';
import { Button, DogAvatars, Field, H1, H2, KennelBadge, Note, Panel, Row, Screen, Tile } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';

const PAGE = 30;
const phases: PhaseFilter[] = ['all', 'upcoming', 'current', 'finished', 'cancelled'];

export default function History() {
  const { db } = useStore();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<PhaseFilter>('all');
  const [month, setMonth] = useState<string | null>(monthOf(today()));
  const [limit, setLimit] = useState(PAGE);

  const list = useMemo(() => filterHistory(db, { query, phase, month }), [db, query, phase, month]);
  const sum = summarize(list);
  const reset = () => setLimit(PAGE);

  return (
    <Screen title="Historia pobytów">
      <H1>Historia</H1>
      <Field label="Szukaj: pies, klient, telefon, boks" value={query} onChange={v => { setQuery(v); reset(); }} placeholder="np. Luna, Kowalska, boks 3" />

      <Row>
        {phases.map(p => (
          <Tile key={p} label={phaseLabel[p]} active={phase === p} onPress={() => { setPhase(p); reset(); }} style={{ minHeight: 48, paddingHorizontal: 12, flexGrow: 1 }} />
        ))}
      </Row>

      <Panel style={{ gap: 10 }}>
        <Row style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
          <Button title="‹" kind="outline" disabled={!month} onPress={() => { setMonth(m => (m ? plusMonths(m, -1) : m)); reset(); }} style={{ width: 60 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' }}>{month ? monthLabel(month) : 'Cały okres'}</Text>
          </View>
          <Button title="›" kind="outline" disabled={!month} onPress={() => { setMonth(m => (m ? plusMonths(m, 1) : m)); reset(); }} style={{ width: 60 }} />
        </Row>
        <Row>
          <Button title="Ten miesiąc" kind="outline" onPress={() => { setMonth(monthOf(today())); reset(); }} style={{ flex: 1 }} />
          <Button title="Cały okres" kind="outline" onPress={() => { setMonth(null); reset(); }} style={{ flex: 1 }} />
        </Row>
      </Panel>

      <Panel>
        <H2>Podsumowanie</H2>
        <Note>
          {sum.count} {plural(sum.count, 'pobyt', 'pobyty', 'pobytów')} · {sum.dogs} {plural(sum.dogs, 'pies', 'psy', 'psów')}
          {sum.cancelled ? ` · ${sum.cancelled} ${plural(sum.cancelled, 'anulowany', 'anulowane', 'anulowanych')}` : ''}
        </Note>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.green }}>{pln(sum.revenue)}</Text>
        <Note>Wpłacono: {pln(sum.paid)}{sum.unpaid ? ` · do zapłaty: ${pln(sum.unpaid)}` : ''}</Note>
        {month ? <Note>Liczą się pobyty, które choć częściowo przypadają na ten miesiąc (pełna kwota pobytu).</Note> : null}
      </Panel>

      {list.slice(0, limit).map(b => {
        const p = bookingPhase(b);
        return (
          <Tile
            key={b.id}
            leading={<View style={{ alignItems: 'center', gap: 4 }}><KennelBadge n={b.kennel} size={34} /><DogAvatars dogs={db.dogs.filter(d => b.dogIds.includes(d.id))} size={26} /></View>}
            label={`${dogNames(db, b)} · ${ownerName(db, b.ownerId)}`}
            sub={`${displayDate(b.arrival)} – ${displayDate(b.departure)}\n${phaseLabel[p]}${b.total !== null ? ` · ${pln(b.total)}` : ''}${b.total !== null && b.status !== 'cancelled' && b.paid < b.total ? ` · wpłacono ${pln(b.paid)}` : ''}`}
            tint={p === 'cancelled' ? '#F3F4F3' : undefined}
            onPress={() => router.push(`/pobyt/${b.id}`)}
          />
        );
      })}
      {list.length > limit ? <Button title={`Pokaż więcej (${list.length - limit})`} kind="outline" onPress={() => setLimit(l => l + PAGE)} /> : null}
      {!list.length ? <Note>{db.bookings.length ? 'Brak pobytów dla wybranych filtrów.' : 'Nie ma jeszcze żadnych pobytów.'}</Note> : null}
    </Screen>
  );
}
