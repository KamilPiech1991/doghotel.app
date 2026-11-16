import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useStore } from '../../../src/store';
import { dogNames, isKennelFree } from '../../../src/lib/booking';
import { displayDate, pln } from '../../../src/lib/dates';
import { BookingStatus, sizeLabel, statusLabel } from '../../../src/lib/types';
import { confirm, notify } from '../../../src/ui/dialog';
import { Button, Field, H1, H2, H3, Note, Panel, Row, Screen, Warning } from '../../../src/ui/components';
import { colors } from '../../../src/ui/theme';

export default function BookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, setStatus, addPayment } = useStore();
  const [amount, setAmount] = useState('');
  const b = db.bookings.find(x => x.id === id);
  if (!b) return <Screen back title="Pobyt"><Note>Nie znaleziono pobytu.</Note></Screen>;

  const owner = db.owners.find(o => o.id === b.ownerId);
  const dogs = db.dogs.filter(d => b.dogIds.includes(d.id));
  const due = b.total !== null ? Math.max(0, Math.round((b.total - b.paid) * 100) / 100) : null;

  const change = async (status: BookingStatus, question: string, okLabel: string, destructive = false) => {
    if (status === 'reserved' && !isKennelFree(db, b.kennel, b.arrival, b.departure, b.id))
      return notify('Nie można przywrócić', `Boks ${b.kennel} jest już zajęty w tym terminie. Edytuj pobyt i wybierz inny boks.`);
    if (await confirm(question, `${dogNames(db, b)} · boks ${b.kennel}`, okLabel, destructive)) setStatus(b.id, status);
  };

  const pay = async () => {
    const n = Number(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n === 0) return notify('Wpisz kwotę wpłaty', 'Np. 120 albo 120,50. Kwota ujemna oznacza zwrot.');
    if (await confirm(n > 0 ? 'Zapisać wpłatę?' : 'Zapisać zwrot?', pln(Math.abs(n)), 'Zapisz')) {
      addPayment(b.id, n);
      setAmount('');
    }
  };

  return (
    <Screen back title="Szczegóły pobytu">
      <H1>{dogNames(db, b)}</H1>
      <Panel>
        <Text style={{ fontSize: 18, fontWeight: '800', color: b.status === 'cancelled' ? colors.red : colors.green }}>{statusLabel[b.status]}</Text>
        <H3>Boks {b.kennel}</H3>
        <Note>Przyjazd: {displayDate(b.arrival)}{'\n'}Odbiór: {displayDate(b.departure)}</Note>
        {b.notes ? <Note>Uwagi: {b.notes}</Note> : null}
      </Panel>

      <Row>
        {b.status === 'reserved' ? <Button title="✓ Potwierdź przyjazd" onPress={() => change('checked_in', 'Potwierdzić przyjazd?', 'Przyjechał')} style={{ flex: 1 }} /> : null}
        {b.status === 'checked_in' ? <Button title="✓ Potwierdź odbiór" onPress={() => change('checked_out', 'Potwierdzić odbiór psa?', 'Odebrany')} style={{ flex: 1 }} /> : null}
      </Row>

      <Panel>
        <H2>Klient</H2>
        <H3>{owner?.name ?? '(usunięty klient)'}</H3>
        {owner?.phone ? <Button title={`📞 Zadzwoń: ${owner.phone}`} kind="outline" onPress={() => Linking.openURL(`tel:${owner.phone.replace(/\s/g, '')}`)} /> : null}
        {dogs.map(d => <Note key={d.id}>🐾 {d.name} · {sizeLabel[d.size]}{d.weight ? ` · ${d.weight} kg` : ''}{d.notes ? `\n    ${d.notes}` : ''}</Note>)}
        {owner ? <Button title="Karta klienta" kind="outline" onPress={() => router.push(`/klient/${owner.id}`)} /> : null}
      </Panel>

      <Panel>
        <H2>Płatność</H2>
        <Text style={{ fontSize: 28, fontWeight: '900', color: colors.green }}>{b.total !== null ? pln(b.total) : '—'}</Text>
        <Note>Zaliczka: {pln(b.deposit)}{'\n'}Wpłacono: {pln(b.paid)}{due !== null ? `\nDo zapłaty: ${pln(due)}` : ''}</Note>
        {b.paid < b.deposit && b.status === 'reserved' ? <Warning>Zaliczka nie została jeszcze wpłacona w całości.</Warning> : null}
        {b.status !== 'cancelled' ? (
          <>
            <Field label="Kwota wpłaty (zł)" value={amount} onChange={setAmount} keyboardType="decimal-pad" placeholder="np. 120" />
            <Row>
              <Button title="Zapisz wpłatę" kind="outline" onPress={pay} style={{ flex: 2 }} />
              {due ? <Button title="Całość" kind="outline" onPress={() => setAmount(String(due))} style={{ flex: 1 }} /> : null}
            </Row>
          </>
        ) : null}
      </Panel>

      {b.status !== 'cancelled' && b.status !== 'checked_out' ? <Button title="Edytuj pobyt" kind="outline" onPress={() => router.push(`/pobyt/${b.id}/edytuj`)} /> : null}
      {b.status === 'reserved' ? <Button title="Anuluj rezerwację" kind="danger" onPress={() => change('cancelled', 'Anulować rezerwację?', 'Anuluj rezerwację', true)} /> : null}
      {b.status === 'cancelled' ? <Button title="Przywróć rezerwację" kind="outline" onPress={() => change('reserved', 'Przywrócić rezerwację?', 'Przywróć')} /> : null}
      {b.status === 'checked_in' ? <Button title="Cofnij przyjazd" kind="outline" onPress={() => change('reserved', 'Cofnąć potwierdzenie przyjazdu?', 'Cofnij')} /> : null}
    </Screen>
  );
}
