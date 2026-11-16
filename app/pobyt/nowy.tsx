import { useLocalSearchParams } from 'expo-router';
import { BookingForm } from '../../src/screens/BookingForm';

export default function NewBooking() {
  const p = useLocalSearchParams<{ ownerId?: string; kennel?: string; date?: string }>();
  const kennel = p.kennel ? Number(p.kennel) : undefined;
  return <BookingForm key={`${p.ownerId}-${p.kennel}-${p.date}`} preset={{ ownerId: p.ownerId, kennel: Number.isInteger(kennel) ? kennel : undefined, date: p.date }} />;
}
