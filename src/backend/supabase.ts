import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Booking, DB, Dog, Owner, Settings } from '../lib/types';
import { BookingRow, bookingToRow, dbFromRows, DogRow, dogToRow, OwnerRow, ownerToRow, SettingsRow, settingsToRow } from './mapping';

// Adres i klucz publiczny projektu Supabase (wstawiane przy budowaniu).
// Klucz publiczny (anon / publishable) może być jawny – dane chronią zasady RLS w bazie.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const remoteEnabled = !!url && !!key;

export const supabase: SupabaseClient | null = remoteEnabled
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
        ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      },
    })
  : null;

const sb = () => {
  if (!supabase) throw new Error('Baza danych nie jest skonfigurowana.');
  return supabase;
};

const check = <T,>(res: { data: T; error: unknown }): T => {
  if (res.error) throw res.error;
  return res.data;
};

export async function isStaff(email: string): Promise<boolean> {
  const rows = check(await sb().from('staff').select('email').eq('email', email.toLowerCase()));
  return (rows ?? []).length > 0;
}

export async function loadAll(): Promise<DB> {
  const [owners, dogs, bookings, settings] = await Promise.all([
    sb().from('owners').select('*'),
    sb().from('dogs').select('*'),
    sb().from('bookings').select('*'),
    sb().from('settings').select('*').eq('id', 1).single(),
  ]);
  return dbFromRows(
    check(owners) as OwnerRow[],
    check(dogs) as DogRow[],
    check(bookings) as BookingRow[],
    check(settings) as SettingsRow,
  );
}

export const remote = {
  saveOwner: async (o: Owner) => { check(await sb().from('owners').upsert(ownerToRow(o))); },
  deleteOwner: async (id: string) => { check(await sb().from('owners').delete().eq('id', id)); },
  saveDog: async (d: Dog) => { check(await sb().from('dogs').upsert(dogToRow(d))); },
  deleteDog: async (id: string) => { check(await sb().from('dogs').delete().eq('id', id)); },
  saveBooking: async (b: Booking) => { check(await sb().from('bookings').upsert(bookingToRow(b))); },
  setStatus: async (id: string, status: Booking['status']) => { check(await sb().from('bookings').update({ status }).eq('id', id)); },
  addPayment: async (id: string, amount: number): Promise<number> =>
    Number(check(await sb().rpc('add_payment', { p_booking_id: id, p_amount: amount }))),
  updateSettings: async (patch: Partial<Settings>) => { check(await sb().from('settings').update(settingsToRow(patch)).eq('id', 1)); },
  replaceAll: async (db: DB) => { check(await sb().rpc('replace_all', { p_data: db })); },
};

/** Nasłuch zmian z innych urządzeń. Zwraca funkcję wyłączającą nasłuch. */
export function subscribeChanges(onChange: () => void): () => void {
  const client = sb();
  const channel = client
    .channel('psotelgracja-zmiany')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => onChange())
    .subscribe();
  return () => { client.removeChannel(channel); };
}
