import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';

// Cache the Clerk JWT to keep the user logged in between app launches
const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`${key} was used 🔐 \n`);
      } else {
        console.log('No values stored under key: ' + key);
      }
      return item;
    } catch (error) {
      console.error('SecureStore get item error: ', error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

// Add this to your .env file: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key_here
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env'
  );
}

const InitialLayout = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait until Clerk has finished checking the secure store for a session
    if (!isLoaded) return;

    // Check if the user is currently trying to access any screen inside the (tabs) folder
    const inTabsGroup = segments[0] === '(tabs)';

    if (isSignedIn && !inTabsGroup) {
      // 1. User is logged in but NOT in the dashboard (e.g., they are on the sign-in screen)
      // Redirect them to the dashboard immediately.
      router.replace('/(tabs)/dashboard');
    } else if (!isSignedIn && inTabsGroup) {
      // 2. User is logged out but trying to access the dashboard
      // Kick them back to the sign-in screen.
      router.replace('/sign-in');
    }
  }, [isSignedIn, isLoaded, segments]);

  // Slot acts as the placeholder where Expo Router renders your current screen
  return <Slot />;
};

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <InitialLayout />
    </ClerkProvider>
  );
}