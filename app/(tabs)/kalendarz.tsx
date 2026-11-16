import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../../src/store';
import { bookingsOnDay, dogNames, kennelNumbers } from '../../src/lib/booking';
import { displayDate, displayDay, displayShort, plusDays, today, weekdayShort, weekStart } from '../../src/lib/dates';
import { statusLabel } from '../../src/lib/types';
import { Button, DateField, DogAvatars, H2, H3, KennelBadge, Note, Panel, Row, Screen, Tile } from '../../src/ui/components';
import { dogColor, kennelColor } from '../../src/lib/colors';
import { colors } from '../../src/ui/theme';

export default function Calendar() {
  const { db } = useStore();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(today());
  const step = mode === 'day' ? 1 : 7;
  const newAt = (kennel: number, date: string) => router.push(`/pobyt/nowy?kennel=${kennel}&date=${date}`);

  return (
    <Screen title="Kalendarz boksów">
      <Row>
        <Tile label="Dzień" active={mode === 'day'} onPress={() => setMode('day')} style={{ flex: 1 }} />
        <Tile label="Tydzień" active={mode === 'week'} onPress={() => setMode('week')} style={{ flex: 1 }} />
      </Row>
      <Row>
        <Button title="‹" kind="outline" onPress={() => setDay(plusDays(day, -step))} style={{ flex: 1 }} />
        <Button title="Dziś" kind="outline" onPress={() => setDay(today())} style={{ flex: 2 }} />
        <Button title="›" kind="outline" onPress={() => setDay(plusDays(day, step))} style={{ flex: 1 }} />
      </Row>
      <DateField label="Przejdź do dnia" value={day} onChange={v => v && setDay(v)} />
      {mode === 'day' ? renderDay(day, newAt) : renderWeek(day, newAt, d => { setDay(d); setMode('day'); })}
    </Screen>
  );

  function renderDay(day: string, onNew: (k: number, d: string) => void) {
    const list = bookingsOnDay(db, day);
    return (
      <>
        <H2>{displayDay(day)}</H2>
        <Note>Zajęte: {new Set(list.map(b => b.kennel)).size} z {db.settings.kennelCount}</Note>
        {kennelNumbers(db).map(k => {
          const bs = list.filter(b => b.kennel === k);
          return (
            <Panel key={k} style={{ backgroundColor: kennelColor(k).light, borderColor: kennelColor(k).strong, borderLeftWidth: 8, padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <KennelBadge n={k} />
                <H3>Boks {k} · {bs.length ? 'zajęty' : 'wolny'}</H3>
              </View>
              {bs.map(b => (
                <Tile key={b.id} leading={<DogAvatars dogs={db.dogs.filter(d => b.dogIds.includes(d.id))} />} label={dogNames(db, b)} sub={`${displayDate(b.arrival)} – ${displayDate(b.departure)} · ${statusLabel[b.status]}`} onPress={() => router.push(`/pobyt/${b.id}`)} />
              ))}
              {!bs.length ? <Button title="+ Zarezerwuj ten boks" kind="outline" onPress={() => onNew(k, day)} /> : null}
            </Panel>
          );
        })}
      </>
    );
  }

  function renderWeek(day: string, onNew: (k: number, d: string) => void, onPickDay: (d: string) => void) {
    const start = weekStart(day);
    const days = Array.from({ length: 7 }, (_, i) => plusDays(start, i));
    const perDay = days.map(d => bookingsOnDay(db, d));
    const t = today();
    return (
      <>
        <H2>{displayShort(days[0])} – {displayShort(days[6])}</H2>
        <Note>Dotknij zajętego pola, aby otworzyć pobyt, albo wolnego, aby zarezerwować.</Note>
        <Panel style={{ padding: 8, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            <View style={{ width: 34 }} />
            {days.map(d => (
              <Pressable key={d} onPress={() => onPickDay(d)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: d === t ? colors.greenLight : undefined }} accessibilityRole="button" accessibilityLabel={`Pokaż dzień ${displayDay(d)}`}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{weekdayShort(d)}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{displayShort(d)}</Text>
              </Pressable>
            ))}
          </View>
          {kennelNumbers(db).map(k => (
            <View key={k} style={{ flexDirection: 'row', gap: 3 }}>
              <View style={{ width: 34, justifyContent: 'center' }}><KennelBadge n={k} size={30} /></View>
              {days.map((d, i) => {
                const b = perDay[i].find(x => x.kennel === k);
                const firstDog = b ? db.dogs.find(d => d.id === b.dogIds[0]) : undefined;
                const kc = kennelColor(k);
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityLabel={b ? `Boks ${k}, ${displayDay(d)}: ${dogNames(db, b)}` : `Boks ${k}, ${displayDay(d)}: wolny`}
                    onPress={() => (b ? router.push(`/pobyt/${b.id}`) : onNew(k, d))}
                    style={{ flex: 1, minHeight: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: b ? (firstDog ? dogColor(firstDog).hex : kc.strong) : kc.light, borderWidth: b ? 2 : 1, borderColor: b ? kc.strong : kc.border }}
                  >
                    <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: b ? colors.white : colors.muted }}>{b ? `${b.status === 'checked_in' ? '✓' : ''}${dogNames(db, b).split(',')[0].slice(0, 6)}` : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Panel>
        <Note>Wiersz = boks w swoim kolorze. Zajęte pole ma kolor psa, „✓” oznacza, że pies jest już na miejscu. Jasne pole jest wolne.</Note>
      </>
    );
  }
}
