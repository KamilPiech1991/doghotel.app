export type Size = 'small' | 'medium' | 'large';

export type Owner = {
  id: string;
  name: string;
  phone: string;
  notes?: string;
};

export type Dog = {
  id: string;
  ownerId: string;
  name: string;
  size: Size;
  weight?: string;
  breed?: string;
  notes?: string;
  /** id koloru z dogPalette (src/lib/colors.ts) */
  color?: string;
};

export type BookingStatus = 'reserved' | 'checked_in' | 'checked_out' | 'cancelled';

export type Booking = {
  id: string;
  ownerId: string;
  dogIds: string[];
  kennel: number;
  /** ISO 8601 (UTC) – moment przyjazdu */
  arrival: string;
  /** ISO 8601 (UTC) – moment odbioru */
  departure: string;
  status: BookingStatus;
  total: number | null;
  deposit: number;
  paid: number;
  notes?: string;
  createdAt: string;
};

export type Rates = Record<Size, number>;

export type SpecialPeriod = {
  id: string;
  name: string;
  /** RRRR-MM-DD, włącznie */
  from: string;
  /** RRRR-MM-DD, włącznie */
  to: string;
  rates: Rates;
};

export type Settings = {
  kennelCount: number;
  rates: Rates;
  depositPercent: number;
  cleaningMinutes: number;
  specialPeriods: SpecialPeriod[];
};

export type DB = {
  version: 2;
  owners: Owner[];
  dogs: Dog[];
  bookings: Booking[];
  settings: Settings;
};

export const sizeLabel: Record<Size, string> = { small: 'Mały', medium: 'Średni', large: 'Duży' };
export const sizes: Size[] = ['small', 'medium', 'large'];

export const statusLabel: Record<BookingStatus, string> = {
  reserved: 'Zarezerwowany',
  checked_in: 'Na miejscu',
  checked_out: 'Odebrany',
  cancelled: 'Anulowany',
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
