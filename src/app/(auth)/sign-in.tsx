import { useAuth, useSignIn } from '@clerk/expo';
import { useState, useEffect } from 'react';
import { 
  Text, 
  TextInput, 
  View, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SignInScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn, setActive } = useSignIn();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);

  // Automatically redirect to Dashboard once authenticated
  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isSignedIn]);

  const handleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    setIsLoading(true);
    
    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (completeSignIn.status === 'complete') {
        await setActive({ session: completeSignIn.createdSessionId });
        // The useEffect will handle the redirect once isSignedIn becomes true
      } else {
        console.warn('Sign in requires additional steps:', completeSignIn.status);
      }
    } catch (err: any) {
      const errorMessage = err.errors?.[0]?.longMessage || err.message || "Invalid email or password.";
      Alert.alert("Sign In Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent UI rendering until Clerk is fully loaded
  if (!isLoaded) return null;

  // Show a clean loading state if already authenticated to prevent flashing
  if (isSignedIn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#09090B' }}>
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-20 h-20 bg-indigo-500/10 rounded-full items-center justify-center mb-6">
            <Ionicons name="shield-checkmark" size={40} color="#818CF8" />
          </View>
          <Text className="text-white text-3xl font-black tracking-tight mb-2">Authenticated</Text>
          <Text className="text-zinc-400 text-base font-medium">Securing your workspace...</Text>
          <ActivityIndicator size="small" color="#818CF8" style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09090B' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      
      {/* Immersive Ambient Background */}
      <View className="absolute top-[-10%] right-[-20%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[100px]" />
      <View className="absolute bottom-[-10%] left-[-20%] w-[500px] h-[500px] bg-fuchsia-600/15 rounded-full blur-[100px]" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} 
          keyboardShouldPersistTaps="handled"
          className="px-6 py-8"
          showsVerticalScrollIndicator={false}
        >
          
          {/* Header Section */}
          <View className="mb-12 mt-4">
            <View className="flex-row items-center mb-6">
              <View className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex-row items-center">
                <View className="w-2 h-2 rounded-full mr-2 shadow-lg bg-indigo-500 shadow-indigo-500/80" />
                <Text className="text-zinc-300 text-xs font-bold tracking-[0.2em] uppercase">
                  Secure Workspace
                </Text>
              </View>
            </View>
            
            <View className="flex-row flex-wrap items-end mb-3">
              <Text className="text-white text-[44px] font-black tracking-tight leading-none">
                Welcome 
              </Text>
              
              <View className="relative px-1">
                <View className="absolute bottom-1 left-0 right-0 h-4 rounded-sm bg-indigo-500/80" />
                <Text className="text-white text-[44px] font-black tracking-tight leading-none relative z-10">
                  back.
                </Text>
              </View>
            </View>

            <Text className="text-zinc-400 text-base font-medium leading-relaxed mt-2">
              Sign in to access your dashboard.
            </Text>
          </View>

          {/* Ultra-Premium Glassmorphic Container */}
          <View className="w-full bg-white/[0.02] rounded-[32px] border border-white/[0.08] p-2 shadow-2xl">
            <View className="w-full bg-black/40 rounded-[26px] p-6 border border-white/[0.04]">
              
              <View className="gap-6">
                <View>
                  <Text className="text-zinc-400 text-xs font-bold tracking-wider uppercase mb-2 ml-1">Work Email</Text>
                  <View className={`flex-row items-center bg-white/[0.03] border rounded-2xl px-4 py-4 transition-colors ${focusedInput === 'email' ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10'}`}>
                    <Ionicons name="mail" size={20} color={focusedInput === 'email' ? '#818cf8' : '#52525b'} style={{ marginRight: 12 }} />
                    <TextInput
                      className="flex-1 text-white text-base font-medium"
                      autoCapitalize="none"
                      value={emailAddress}
                      placeholder="founder@startup.com"
                      placeholderTextColor="#52525B"
                      onChangeText={setEmailAddress}
                      keyboardType="email-address"
                      editable={!isLoading}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-zinc-400 text-xs font-bold tracking-wider uppercase mb-2 ml-1">Password</Text>
                  <View className={`flex-row items-center bg-white/[0.03] border rounded-2xl px-4 py-4 transition-colors ${focusedInput === 'password' ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10'}`}>
                    <Ionicons name="lock-closed" size={20} color={focusedInput === 'password' ? '#818cf8' : '#52525b'} style={{ marginRight: 12 }} />
                    <TextInput
                      className="flex-1 text-white text-base font-medium"
                      value={password}
                      placeholder="••••••••"
                      placeholderTextColor="#52525B"
                      secureTextEntry={true}
                      onChangeText={setPassword}
                      editable={!isLoading}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                <Pressable 
                  onPress={handleSignIn}
                  disabled={isLoading || !emailAddress || !password}
                  className={`w-full bg-white rounded-2xl py-4 mt-4 items-center justify-center flex-row shadow-lg active:scale-[0.98] transition-all ${(isLoading || !emailAddress || !password) ? 'opacity-50' : 'opacity-100 shadow-white/20'}`}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#09090B" />
                  ) : (
                    <>
                      <Text className="text-zinc-950 font-black text-[17px] mr-2">
                        Sign In
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color="#09090B" />
                    </>
                  )}
                </Pressable>
              </View>

            </View>
          </View>

          <View className="mt-10 items-center">
            <View className="flex-row items-center mb-6 opacity-60">
              <Ionicons name="shield-checkmark" size={14} color="#A1A1AA" />
              <Text className="text-zinc-400 text-[11px] font-bold uppercase tracking-[0.15em] ml-2">
                Enterprise-Grade Encryption
              </Text>
            </View>

            {/* Change '/sign-up' to match your actual route name */}
            <Link href="/(auth)/authentication" asChild>
              <Pressable className="flex-row items-center p-2" disabled={isLoading}>
                <Text className="text-zinc-400 text-sm font-medium">
                  Don't have an account? <Text className="text-white font-bold">Sign Up</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}