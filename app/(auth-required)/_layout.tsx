import { Stack } from 'expo-router';

export default function AuthRequiredLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
