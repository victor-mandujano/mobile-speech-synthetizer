import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Repo Reader' }} />
        <Stack.Screen name="speech-spike" options={{ title: 'Speech test' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
