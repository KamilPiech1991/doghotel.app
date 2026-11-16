import { useLocalSearchParams } from 'expo-router';
import { BookingForm } from '../../../src/screens/BookingForm';

export default function EditBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingForm key={id} bookingId={id} />;
}
