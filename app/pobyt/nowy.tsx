import { useLocalSearchParams } from 'expo-router';
import { BookingForm } from '../../src/screens/BookingForm';

export default function NewBooking() {
  const p = useLocalSearchParams<{ ownerId?: string; kennel?: string; date?: string; dogIds?: string; arrivalTime?: string; departureDate?: string; departureTime?: string }>();
  const kennel = p.kennel ? Number(p.kennel) : undefined;
  return (
    <BookingForm
      key={JSON.stringify(p)}
      preset={{
        ownerId: p.ownerId,
        kennel: Number.isInteger(kennel) ? kennel : undefined,
        date: p.date,
        dogIds: p.dogIds ? p.dogIds.split(',') : undefined,
        arrivalTime: p.arrivalTime,
        departureDate: p.departureDate,
        departureTime: p.departureTime,
      }}
    />
  );
}
