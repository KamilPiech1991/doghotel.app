import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Booking, BookingStatus, DB, Dog, Owner, Settings, uid } from './lib/types';
import { demoDb, emptyDb, LEGACY_KEYS, migrate, STORAGE_KEY } from './lib/data';
import { nextDogColor } from './lib/colors';
import { notify } from './ui/dialog';
import { colors } from './ui/theme';

type Store = {
  db: DB;
  saveOwner: (o: Omit<Owner, 'id'> & { id?: string }) => string;
  deleteOwner: (id: string) => void;
  saveDog: (d: Omit<Dog, 'id'> & { id?: string }) => string;
  deleteDog: (id: string) => void;
  saveBooking: (b: Booking) => void;
  setStatus: (id: string, status: BookingStatus) => void;
  addPayment: (id: string, amount: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (db: DB) => void;
  loadDemo: () => void;
};

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore poza StoreProvider');
  return s;
}

async function loadFromStorage(): Promise<DB> {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return migrate(JSON.parse(raw));
  }
  return emptyDb();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(emptyDb);
  const [loaded, setLoaded] = useState(false);
  const saveFailed = useRef(false);

  useEffect(() => {
    loadFromStorage()
      .then(setDb)
      .catch(() => notify('Błąd odczytu', 'Nie udało się odczytać zapisanych danych. Przywróć kopię zapasową w Ustawieniach.'))
      .finally(() => setLoaded(true));
    // Prośba do przeglądarki, by nie usuwała danych przy braku miejsca.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db))
      .then(() => { saveFailed.current = false; })
      .catch(() => {
        if (!saveFailed.current) notify('Błąd zapisu', 'Nie udało się zapisać danych na urządzeniu.');
        saveFailed.current = true;
      });
  }, [db, loaded]);

  const saveOwner = useCallback<Store['saveOwner']>(o => {
    const id = o.id ?? uid();
    setDb(p => ({ ...p, owners: o.id ? p.owners.map(x => (x.id === id ? { ...x, ...o, id } : x)) : [...p.owners, { ...o, id }] }));
    return id;
  }, []);

  const deleteOwner = useCallback((id: string) => {
    setDb(p => ({ ...p, owners: p.owners.filter(o => o.id !== id), dogs: p.dogs.filter(d => d.ownerId !== id) }));
  }, []);

  const saveDog = useCallback<Store['saveDog']>(d => {
    const id = d.id ?? uid();
    setDb(p => ({
      ...p,
      dogs: d.id
        ? p.dogs.map(x => (x.id === id ? { ...x, ...d, id } : x))
        : [...p.dogs, { ...d, id, color: d.color ?? nextDogColor(p.dogs, d.ownerId) }],
    }));
    return id;
  }, []);

  const deleteDog = useCallback((id: string) => setDb(p => ({ ...p, dogs: p.dogs.filter(d => d.id !== id) })), []);

  const saveBooking = useCallback((b: Booking) => {
    setDb(p => ({ ...p, bookings: p.bookings.some(x => x.id === b.id) ? p.bookings.map(x => (x.id === b.id ? b : x)) : [...p.bookings, b] }));
  }, []);

  const setStatus = useCallback((id: string, status: BookingStatus) => {
    setDb(p => ({ ...p, bookings: p.bookings.map(b => (b.id === id ? { ...b, status } : b)) }));
  }, []);

  const addPayment = useCallback((id: string, amount: number) => {
    setDb(p => ({ ...p, bookings: p.bookings.map(b => (b.id === id ? { ...b, paid: Math.round((b.paid + amount) * 100) / 100 } : b)) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => setDb(p => ({ ...p, settings: { ...p.settings, ...patch } })), []);
  const replaceAll = useCallback((next: DB) => setDb(next), []);
  const loadDemo = useCallback(() => setDb(demoDb()), []);

  const value = useMemo(
    () => ({ db, saveOwner, deleteOwner, saveDog, deleteDog, saveBooking, setStatus, addPayment, updateSettings, replaceAll, loadDemo }),
    [db, saveOwner, deleteOwner, saveDog, deleteDog, saveBooking, setStatus, addPayment, updateSettings, replaceAll, loadDemo],
  );

  if (!loaded)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
