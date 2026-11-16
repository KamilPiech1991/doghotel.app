import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from './theme';

export function AppHeader({ title, back }: { title?: string; back?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.header, { paddingTop: insets.top + 12 }]}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Wróć" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.back} hitSlop={10}>
          <Text style={st.backText}>‹ Wróć</Text>
        </Pressable>
      ) : null}
      <Text style={st.brand}>🐾 PSOTELGRACJA</Text>
      <Text style={st.sub}>{title ?? 'Hotel dla psiaków'}</Text>
    </View>
  );
}

export function Screen({ children, title, back }: { children: React.ReactNode; title?: string; back?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader title={title} back={back} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={st.body}>
        <View style={st.inner}>{children}</View>
      </ScrollView>
    </View>
  );
}

type BtnKind = 'primary' | 'outline' | 'danger';
export function Button({ title, onPress, kind = 'primary', disabled = false, style }: { title: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [st.btn, kind === 'outline' && st.btnOutline, kind === 'danger' && st.btnDanger, disabled && { opacity: 0.45 }, pressed && { opacity: 0.75 }, style]}
    >
      <Text style={[st.btnText, kind === 'outline' && { color: colors.green }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, keyboardType, multiline, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'decimal-pad'; multiline?: boolean; onBlur?: () => void;
}) {
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#81948A"
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        style={[st.input, multiline && { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

/** Pole liczbowe: trzyma tekst lokalnie (można wpisać „7,5” albo wyczyścić pole), a liczbę oddaje przy wyjściu z pola. */
export function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text.replace(',', '.').trim());
    if (text.trim() === '' || !Number.isFinite(n)) return setText(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min, n));
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };
  return <Field label={label} value={text} onChange={setText} onBlur={commit} keyboardType="decimal-pad" />;
}

/** Pole daty/godziny. W przeglądarce używa natywnego wyboru daty telefonu (input type=date/time). */
function WebPicker({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type: 'date' | 'time' }) {
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      {React.createElement('input', {
        type,
        value,
        lang: 'pl',
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: { minHeight: 60, fontSize: 19, padding: '0 15px', borderRadius: 13, border: `1.5px solid ${colors.inputBorder}`, color: colors.ink, background: '#FFF', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' },
      })}
    </View>
  );
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  if (Platform.OS === 'web') return <WebPicker type="date" label={label} value={value} onChange={onChange} />;
  return <Field label={`${label} (RRRR-MM-DD)`} value={value} onChange={onChange} placeholder="2026-12-24" />;
}

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  if (Platform.OS === 'web') return <WebPicker type="time" label={label} value={value} onChange={onChange} />;
  return <Field label={`${label} (GG:MM)`} value={value} onChange={onChange} placeholder="10:00" />;
}

export function Tile({ label, sub, active, onPress, disabled = false, style }: { label: string; sub?: string; active?: boolean; onPress: () => void; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      accessibilityState={{ selected: !!active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [st.tile, active && st.tileActive, disabled && st.tileDisabled, pressed && { opacity: 0.8 }, style]}
    >
      <Text style={[st.tileText, active && { color: colors.white }, disabled && { color: colors.disabledText }]}>{label}</Text>
      {sub ? <Text style={[st.tileSub, active && { color: '#DDECE4' }, disabled && { color: colors.disabledText }]}>{sub}</Text> : null}
    </Pressable>
  );
}

export const Panel = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[st.panel, style]}>{children}</View>;
export const H1 = ({ children }: { children: React.ReactNode }) => <Text style={st.h1} accessibilityRole="header">{children}</Text>;
export const H2 = ({ children }: { children: React.ReactNode }) => <Text style={st.h2} accessibilityRole="header">{children}</Text>;
export const H3 = ({ children }: { children: React.ReactNode }) => <Text style={st.h3}>{children}</Text>;
export const Note = ({ children }: { children: React.ReactNode }) => <Text style={st.note}>{children}</Text>;
export const Warning = ({ children }: { children: React.ReactNode }) => <Text style={st.warning}>{children}</Text>;
export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[st.row, style]}>{children}</View>;

export const st = StyleSheet.create({
  header: { backgroundColor: colors.green, paddingHorizontal: 20, paddingBottom: 14 },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  backText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  brand: { fontSize: 22, fontWeight: '900', color: colors.white },
  sub: { fontSize: 15, color: '#DDECE4', marginTop: 2 },
  body: { padding: 16, paddingBottom: 40 },
  inner: { gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '900', color: colors.ink },
  h2: { fontSize: 22, fontWeight: '800', color: colors.ink },
  h3: { fontSize: 19, fontWeight: '800', color: colors.ink },
  note: { fontSize: 17, color: colors.muted, lineHeight: 25 },
  warning: { fontSize: 17, color: colors.warning, lineHeight: 25, fontWeight: '600' },
  panel: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  btn: { backgroundColor: colors.green, borderRadius: 15, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
  btnOutline: { backgroundColor: colors.white, borderColor: colors.green, borderWidth: 2 },
  btnDanger: { backgroundColor: colors.red },
  btnText: { color: colors.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  field: { gap: 7 },
  label: { fontSize: 17, fontWeight: '700', color: colors.ink },
  input: { backgroundColor: colors.white, borderColor: colors.inputBorder, borderWidth: 1.5, borderRadius: 13, minHeight: 60, paddingHorizontal: 15, fontSize: 19, color: colors.ink },
  tile: { borderWidth: 1.5, borderColor: '#9DB7A7', backgroundColor: colors.white, borderRadius: 13, minHeight: 58, padding: 9, justifyContent: 'center', alignItems: 'center' },
  tileActive: { backgroundColor: colors.green, borderColor: colors.green },
  tileDisabled: { backgroundColor: colors.disabled, borderColor: '#C7CDC8' },
  tileText: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  tileSub: { color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
