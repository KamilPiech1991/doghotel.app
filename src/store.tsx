import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { Booking, BookingStatus, DB, Dog, Owner, Settings, uid } from './lib/types';
import { demoDb, emptyDb, LEGACY_KEYS, migrate, STORAGE_KEY } from './lib/data';
import { nextDogColor } from './lib/colors';
import { isStaff, loadAll, remote, remoteEnabled, subscribeChanges, supabase } from './backend/supabase';
import { friendlyError } from './backend/mapping';
import { notify } from './ui/dialog';
import { colors } from './ui/theme';
import { LoginScreen, NoAccessScreen, ErrorScreen } from './screens/LoginScreen';

type Store = {
  db: DB;
  /** 'remote' = dane w bazie Supabase, 'local' = tylko na tym urządzeniu */
  mode: 'remote' | 'local';
  userEmail: string | null;
  saveOwner: (o: Omit<Owner, 'id'> & { id?: string }) => Promise<string | null>;
  deleteOwner: (id: string) => Promise<boolean>;
  saveDog: (d: Omit<Dog, 'id'> & { id?: string }) => Promise<string | null>;
  deleteDog: (id: string) => Promise<boolean>;
  saveBooking: (b: Booking) => Promise<boolean>;
  setStatus: (id: string, status: BookingStatus) => Promise<boolean>;
  addPayment: (id: string, amount: number) => Promise<boolean>;
  updateSettings: (patch: Partial<Settings>) => Promise<boolean>;
  replaceAll: (db: DB) => Promise<boolean>;
  loadDemo: () => Promise<boolean>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Dane zapisane wcześniej lokalnie na tym urządzeniu (do przeniesienia do bazy). */
  readLocalData: () => Promise<DB | null>;
  markLocalDataMoved: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore poza StoreProvider');
  return s;
}

async function readLocal(): Promise<DB | null> {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return migrate(JSON.parse(raw));
  }
  return null;
}

const Spinner = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
    <ActivityIndicator color={colors.green} size="large" />
  </View>
);

type Phase = 'loading' | 'login' | 'no-access' | 'error' | 'ready';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const mode: Store['mode'] = remoteEnabled ? 'remote' : 'local';
  const [db, setDb] = useState<DB>(emptyDb);
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState('');
  const saveFailed = useRef(false);
  const dbRef = useRef(db);
  dbRef.current = db;

  // ---------- tryb lokalny: odczyt i zapis w pamięci urządzenia ----------
  useEffect(() => {
    if (mode !== 'local') return;
    readLocal()
      .then(d => d && setDb(d))
      .catch(() => notify('Błąd odczytu', 'Nie udało się odczytać zapisanych danych. Przywróć kopię zapasową w Ustawieniach.'))
      .finally(() => setPhase('ready'));
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') navigator.storage?.persist?.().catch(() => {});
  }, [mode]);

  useEffect(() => {
    if (mode !== 'local' || phase !== 'ready') return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db))
      .then(() => { saveFailed.current = false; })
      .catch(() => {
        if (!saveFailed.current) notify('Błąd zapisu', 'Nie udało się zapisać danych na urządzeniu.');
        saveFailed.current = true;
      });
  }, [db, mode, phase]);

  // ---------- tryb bazy danych: logowanie, wczytanie, zmiany na żywo ----------
  const reload = useCallback(async () => {
    if (mode !== 'remote') return;
    try {
      setDb(await loadAll());
      setPhase('ready');
    } catch (e) {
      setLoadError(friendlyError(e));
      setPhase(p => (p === 'ready' ? p : 'error'));
    }
  }, [mode]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setPhase('login');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) { setDb(emptyDb()); setPhase('login'); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const email = session?.user.email ?? null;
  useEffect(() => {
    if (mode !== 'remote' || !email) return;
    let cancelled = false;
    setPhase('loading');
    isStaff(email)
      .then(ok => {
        if (cancelled) return;
        if (!ok) return setPhase('no-access');
        return reload();
      })
      .catch(e => { if (!cancelled) { setLoadError(friendlyError(e)); setPhase('error'); } });
    return () => { cancelled = true; };
  }, [mode, email, reload]);

  useEffect(() => {
    if (mode !== 'remote' || phase !== 'ready') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { reload(); }, 400);
    });
    // po powrocie do aplikacji (telefon był zablokowany) – odśwież dane
    const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') reload(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mode, phase, reload]);

  // ---------- operacje: najpierw zapis w bazie (w trybie bazy), potem zmiana na ekranie ----------
  const commit = useCallback(async (remoteOp: () => Promise<unknown>, apply: (p: DB) => DB): Promise<boolean> => {
    try {
      if (mode === 'remote') await remoteOp();
      setDb(apply);
      return true;
    } catch (e) {
      notify('Nie udało się zapisać', friendlyError(e));
      if (mode === 'remote') reload();
      return false;
    }
  }, [mode, reload]);

  const saveOwner = useCallback<Store['saveOwner']>(async o => {
    const existing = o.id ? dbRef.current.owners.find(x => x.id === o.id) : undefined;
    const owner: Owner = { ...existing, ...o, id: o.id ?? uid() } as Owner;
    const ok = await commit(() => remote.saveOwner(owner), p => ({
      ...p, owners: existing ? p.owners.map(x => (x.id === owner.id ? owner : x)) : [...p.owners, owner],
    }));
    return ok ? owner.id : null;
  }, [commit]);

  const deleteOwner = useCallback((id: string) => commit(() => remote.deleteOwner(id), p => ({
    ...p, owners: p.owners.filter(o => o.id !== id), dogs: p.dogs.filter(d => d.ownerId !== id),
  })), [commit]);

  const saveDog = useCallback<Store['saveDog']>(async d => {
    const existing = d.id ? dbRef.current.dogs.find(x => x.id === d.id) : undefined;
    const dog: Dog = { ...existing, ...d, id: d.id ?? uid(), color: d.color ?? existing?.color ?? nextDogColor(dbRef.current.dogs, d.ownerId) } as Dog;
    const ok = await commit(() => remote.saveDog(dog), p => ({
      ...p, dogs: existing ? p.dogs.map(x => (x.id === dog.id ? dog : x)) : [...p.dogs, dog],
    }));
    return ok ? dog.id : null;
  }, [commit]);

  const deleteDog = useCallback((id: string) => commit(() => remote.deleteDog(id), p => ({ ...p, dogs: p.dogs.filter(d => d.id !== id) })), [commit]);

  const saveBooking = useCallback((b: Booking) => commit(() => remote.saveBooking(b), p => ({
    ...p, bookings: p.bookings.some(x => x.id === b.id) ? p.bookings.map(x => (x.id === b.id ? b : x)) : [...p.bookings, b],
  })), [commit]);

  const setStatus = useCallback((id: string, status: BookingStatus) => commit(() => remote.setStatus(id, status), p => ({
    ...p, bookings: p.bookings.map(b => (b.id === id ? { ...b, status } : b)),
  })), [commit]);

  const addPayment = useCallback(async (id: string, amount: number) => {
    let serverPaid: number | null = null;
    return commit(async () => { serverPaid = await remote.addPayment(id, amount); }, p => ({
      ...p,
      bookings: p.bookings.map(b => (b.id === id ? { ...b, paid: serverPaid ?? Math.round((b.paid + amount) * 100) / 100 } : b)),
    }));
  }, [commit]);

  const updateSettings = useCallback((patch: Partial<Settings>) => commit(() => remote.updateSettings(patch), p => ({
    ...p, settings: { ...p.settings, ...patch },
  })), [commit]);

  const replaceAll = useCallback((next: DB) => commit(() => remote.replaceAll(next), () => next), [commit]);
  const loadDemo = useCallback(() => replaceAll(demoDb()), [replaceAll]);
  const signOut = useCallback(async () => { await supabase?.auth.signOut(); }, []);
  const markLocalDataMoved = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) await AsyncStorage.setItem(`${STORAGE_KEY}-przeniesione`, raw);
    await AsyncStorage.multiRemove([STORAGE_KEY, ...LEGACY_KEYS]);
  }, []);

  const value = useMemo<Store>(
    () => ({ db, mode, userEmail: email, saveOwner, deleteOwner, saveDog, deleteDog, saveBooking, setStatus, addPayment, updateSettings, replaceAll, loadDemo, reload, signOut, readLocalData: readLocal, markLocalDataMoved }),
    [db, mode, email, saveOwner, deleteOwner, saveDog, deleteDog, saveBooking, setStatus, addPayment, updateSettings, replaceAll, loadDemo, reload, signOut, markLocalDataMoved],
  );

  if (phase === 'loading') return <Spinner />;
  if (phase === 'login') return <LoginScreen />;
  if (phase === 'no-access') return <NoAccessScreen email={email ?? ''} onSignOut={signOut} />;
  if (phase === 'error') return <ErrorScreen message={loadError} onRetry={() => { setPhase('loading'); reload(); }} onSignOut={signOut} />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
