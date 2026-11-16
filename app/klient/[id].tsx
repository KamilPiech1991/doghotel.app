import { useLocalSearchParams } from 'expo-router';
import { OwnerScreen } from '../../src/screens/OwnerScreen';
export default function EditOwner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OwnerScreen key={id} ownerId={id} />;
}
