import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../src/store';
import { validateBooking } from '../src/lib/booking';
import { displayDate, displayDay, parseLocal, pln, today } from '../src/lib/dates';
import { depositFor, quote } from '../src/lib/pricing';
import { Booking, sizeLabel, uid } from '../src/lib/types';
import { chooseDog, parseVoiceBooking, VoiceDraft } from '../src/lib/voice';
import { useSpeech } from '../src/voice/useSpeech';
import { confirm, notify } from '../src/ui/dialog';
import { Button, DogAvatar, DogAvatars, Field, H1, H2, KennelBadge, Note, Panel, Row, Screen, Tile, Warning } from '../src/ui/components';
import { colors } from '../src/ui/theme';

const score = (d: VoiceDraft) => (d.dogs.length ? 4 : d.candidates.length ? 2 : 0) + (d.arrivalDate ? 1 : 0) + (d.departureDate ? 1 : 0);

export default function VoiceBooking() {
  const { db, saveBooking } = useStore();
  const [text, setText] = useState('');
  const [pickedDogId, setPickedDogId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = today();

  const speech = useSpeech(alternatives => {
    // wybierz wariant, w którym rozpoznano najwięcej (pies, daty)
    const best = alternatives.map(a => ({ a, s: score(parseVoiceBooking(a, db, t)) })).sort((x, y) => y.s - x.s)[0];
    setText(best.a);
    setPickedDogId(null);
  });

  const draft = useMemo(() => {
    if (!text.trim()) return null;
    const d = parseVoiceBooking(text, db, t);
    const picked = pickedDogId ? d.candidates.find(c => c.id === pickedDogId) : undefined;
    return picked ? chooseDog(d, picked) : d;
  }, [text, db, t, pickedDogId]);

  const arrival = draft?.arrivalDate ? parseLocal(draft.arrivalDate, draft.arrivalTime) : null;
  const departure = draft?.departureDate ? parseLocal(draft.departureDate, draft.departureTime) : null;
  const pricing = draft && draft.dogs.length ? quote(db.settings, draft.dogs, arrival, departure) : null;
  const ready = !!draft && !draft.problems.length && !!draft.ownerId && !!draft.kennel && !!arrival && !!departure && pricing?.total != null;

  const save = async () => {
    if (!draft || !ready || pricing?.total == null) return;
    const booking: Booking = {
      id: uid(), ownerId: draft.ownerId!, dogIds: draft.dogs.map(d => d.id), kennel: draft.kennel!,
      arrival: arrival!, departure: departure!, status: 'reserved', total: pricing.total,
      deposit: depositFor(pricing.total, db.settings.depositPercent), paid: 0,
      notes: `Rezerwacja głosowa: „${draft.text.trim()}”`, createdAt: new Date().toISOString(),
    };
    const errors = validateBooking(db, booking);
    if (errors.length) return notify('Nie można zarezerwować', errors.join('\n'));
    const ok = await confirm('Zarezerwować?', `${draft.dogs.map(d => d.name).join(', ')} (${ownerLabel(draft.ownerId!)})\nBoks ${draft.kennel}\n${displayDate(arrival!)} – ${displayDate(departure!)}\nCena: ${pln(pricing.total)}`, 'Zarezerwuj');
    if (!ok) return;
    setSaving(true);
    const saved = await saveBooking(booking);
    setSaving(false);
    if (saved) router.replace(`/pobyt/${booking.id}`);
  };

  const ownerLabel = (id: string) => db.owners.find(o => o.id === id)?.name ?? '';

  const openForm = () => {
    if (!draft) return router.push('/pobyt/nowy');
    const q = new URLSearchParams();
    if (draft.ownerId) q.set('ownerId', draft.ownerId);
    if (draft.dogs.length) q.set('dogIds', draft.dogs.map(d => d.id).join(','));
    if (draft.arrivalDate) q.set('date', draft.arrivalDate);
    q.set('arrivalTime', draft.arrivalTime);
    if (draft.departureDate) q.set('departureDate', draft.departureDate);
    q.set('departureTime', draft.departureTime);
    if (draft.kennel) q.set('kennel', String(draft.kennel));
    router.push(`/pobyt/nowy?${q.toString()}`);
  };

  return (
    <Screen back title="Rezerwacja głosowa">
      <H1>Powiedz, kto i na kiedy</H1>
      <Note>Np. „Luna od piątku do niedzieli”, „Reksio od 22 grudnia do 28 grudnia”, „Lunę i Borysa od jutra na 3 dni, boks 4”.</Note>

      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speech.listening ? 'Zakończ słuchanie' : 'Mów – rezerwacja głosowa'}
          onPress={speech.listening ? speech.stop : speech.start}
          style={({ pressed }) => ({
            width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center',
            backgroundColor: speech.listening ? colors.red : colors.green, opacity: pressed ? 0.8 : 1,
            borderWidth: 6, borderColor: speech.listening ? '#F6C9C6' : colors.greenLight,
          })}
        >
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 48, color: speech.listening ? colors.red : colors.green }}>{speech.listening ? '■' : '🎙'}</Text>
          </View>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '800', color: speech.listening ? colors.red : colors.ink }}>
          {speech.listening ? 'Słucham… mów teraz' : 'Naciśnij i mów'}
        </Text>
        {speech.listening && speech.interim ? <Text style={{ fontSize: 18, color: colors.muted, textAlign: 'center' }}>„{speech.interim}”</Text> : null}
      </View>
      {speech.error ? <Warning>{speech.error}</Warning> : null}
      {!speech.supported ? <Warning>Ta przeglądarka nie obsługuje rozpoznawania mowy. Kliknij pole poniżej i użyj mikrofonu 🎤 na klawiaturze telefonu.</Warning> : null}

      <Field label="Polecenie (możesz poprawić ręcznie)" value={text} onChange={v => { setText(v); setPickedDogId(null); }} placeholder="Luna od piątku do niedzieli" multiline />

      {draft ? (
        <Panel>
          <H2>Rozpoznano</H2>

          {draft.dogs.length ? (
            <Row style={{ alignItems: 'center' }}>
              <DogAvatars dogs={draft.dogs} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{draft.dogs.map(d => d.name).join(', ')}</Text>
                <Note>{ownerLabel(draft.ownerId!)} · {draft.dogs.map(d => sizeLabel[d.size].toLowerCase()).join(', ')}</Note>
              </View>
            </Row>
          ) : null}
          {draft.candidates.length ? (
            <>
              <Note>Którego psa chodzi?</Note>
              {draft.candidates.map(c => (
                <Tile key={c.id} leading={<DogAvatar dog={c} size={40} />} label={c.name} sub={ownerLabel(c.ownerId)} onPress={() => setPickedDogId(c.id)} />
              ))}
            </>
          ) : null}

          <Text style={{ fontSize: 18, color: colors.ink, lineHeight: 28 }}>
            <Text style={{ fontWeight: '800' }}>Przyjazd: </Text>{draft.arrivalDate ? `${displayDay(draft.arrivalDate)}, ${draft.arrivalTime}` : '—'}{'\n'}
            <Text style={{ fontWeight: '800' }}>Odbiór: </Text>{draft.departureDate ? `${displayDay(draft.departureDate)}, ${draft.departureTime}` : '—'}
          </Text>
          {draft.kennel ? (
            <Row style={{ alignItems: 'center' }}>
              <KennelBadge n={draft.kennel} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>Boks {draft.kennel}{draft.requestedKennel === draft.kennel ? '' : ' (pierwszy wolny)'}</Text>
            </Row>
          ) : null}
          {pricing?.total != null ? <Text style={{ fontSize: 26, fontWeight: '900', color: colors.green }}>{pln(pricing.total)}</Text> : null}
          {pricing?.missing.length ? pricing.missing.filter(m => m !== 'Nieprawidłowy termin').map((m, i) => <Warning key={i}>{m}</Warning>) : null}
          {draft.problems.map((m, i) => <Warning key={`p${i}`}>{m}</Warning>)}
          {draft.notes.map((m, i) => <Note key={`n${i}`}>{m}</Note>)}

          <Button title={saving ? 'Zapisywanie…' : '✓ Zarezerwuj'} onPress={save} disabled={!ready || saving} />
          <Button title="Popraw w formularzu" kind="outline" onPress={openForm} />
        </Panel>
      ) : null}
    </Screen>
  );
}
