import { useAuth, useSignUp, useSignIn } from '@clerk/expo';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { signIn, setActive: setSignInActive } = useSignIn();

  const [isSignInMode, setIsSignInMode] = useState(true);
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | 'code' | null>(null);

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
        await setSignInActive({ session: completeSignIn.createdSessionId });
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

  const handleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setIsLoading(true);
    
    try {
      const { error } = await signUp.password({ emailAddress, password });
      if (error) throw new Error(error.message);
      
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) throw new Error(sendError.message);
      
      setIsVerifying(true);
    } catch (err: any) {
      const errorMessage = err.errors?.[0]?.longMessage || err.message || "An error occurred";
      Alert.alert("Sign Up Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp) return;
    setIsLoading(true);
    
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) throw new Error(verifyError.message);
      
      if (signUp.status === 'complete') {
        await signUp.finalize();
        await setSignUpActive({ session: signUp.createdSessionId });
        // The useEffect will handle the redirect once isSignedIn becomes true
      }
    } catch (err: any) {
      const errorMessage = err.errors?.[0]?.longMessage || err.message || "Invalid code";
      Alert.alert("Verification Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isSignInMode) {
      handleSignIn();
    } else {
      handleSignUp();
    }
  };

  // Prevent UI rendering until Clerk is fully loaded
  if (!isLoaded) return null;

  // Show a clean loading state if authenticated to prevent the login screen from flashing before the redirect
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
            <View className="flex-row items-center justify-between mb-6">
              <View className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-2 shadow-lg ${isVerifying ? 'bg-fuchsia-500 shadow-fuchsia-500/80' : 'bg-indigo-500 shadow-indigo-500/80'}`} />
                <Text className="text-zinc-300 text-xs font-bold tracking-[0.2em] uppercase">
                  {isVerifying ? 'Authentication' : 'Secure Workspace'}
                </Text>
              </View>

              {isVerifying && (
                <Pressable onPress={() => setIsVerifying(false)} className="p-2">
                  <Text className="text-zinc-400 text-sm font-semibold">Change Email</Text>
                </Pressable>
              )}
            </View>
            
            <View className="flex-row flex-wrap items-end mb-3">
              <Text className="text-white text-[44px] font-black tracking-tight leading-none">
                {isVerifying ? 'Check your ' : isSignInMode ? 'Welcome ' : 'Start '}
              </Text>
              
              <View className="relative px-1">
                <View className={`absolute bottom-1 left-0 right-0 h-4 rounded-sm ${isVerifying ? 'bg-fuchsia-500/80' : 'bg-indigo-500/80'}`} />
                <Text className="text-white text-[44px] font-black tracking-tight leading-none relative z-10">
                  {isVerifying ? 'inbox.' : isSignInMode ? 'back.' : 'building.'}
                </Text>
              </View>
            </View>

            <Text className="text-zinc-400 text-base font-medium leading-relaxed mt-2">
              {isVerifying 
                ? `We sent a secure code to ` 
                : isSignInMode 
                ? 'Sign in to access your dashboard. '
                : 'Join top founders and elite teams. '}
              <Text className="text-zinc-200 font-bold">
                {isVerifying ? emailAddress : isSignInMode ? '' : 'No credit card required.'}
              </Text>
            </Text>
          </View>

          {/* Ultra-Premium Glassmorphic Container */}
          <View className="w-full bg-white/[0.02] rounded-[32px] border border-white/[0.08] p-2 shadow-2xl">
            <View className="w-full bg-black/40 rounded-[26px] p-6 border border-white/[0.04]">
              
              {!isVerifying ? (
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
                    onPress={handleSubmit}
                    disabled={isLoading || !emailAddress || !password}
                    className={`w-full bg-white rounded-2xl py-4 mt-4 items-center justify-center flex-row shadow-lg active:scale-[0.98] transition-all ${(isLoading || !emailAddress || !password) ? 'opacity-50' : 'opacity-100 shadow-white/20'}`}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#09090B" />
                    ) : (
                      <>
                        <Text className="text-zinc-950 font-black text-[17px] mr-2">
                          {isSignInMode ? 'Sign In' : 'Create Account'}
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#09090B" />
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View className="gap-6">
                  <View>
                    <Text className="text-zinc-400 text-xs font-bold tracking-wider uppercase mb-2 ml-1">6-Digit Code</Text>
                    <View className={`flex-row items-center bg-white/[0.03] border rounded-2xl px-4 py-5 transition-colors ${focusedInput === 'code' ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                      <Ionicons name="key" size={24} color={focusedInput === 'code' ? '#e879f9' : '#52525b'} style={{ position: 'absolute', left: 20 }} />
                      <TextInput
                        className="flex-1 text-white text-center text-3xl font-black tracking-[0.4em]"
                        value={code}
                        placeholder="000000"
                        placeholderTextColor="#27272A"
                        onChangeText={setCode}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!isLoading}
                        onFocus={() => setFocusedInput('code')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                  </View>

                  <Pressable 
                    onPress={handleVerify}
                    disabled={isLoading || code.length < 6}
                    className={`w-full bg-white rounded-2xl py-4 mt-4 items-center justify-center flex-row shadow-lg active:scale-[0.98] transition-all ${(isLoading || code.length < 6) ? 'opacity-50' : 'opacity-100 shadow-white/20'}`}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#09090B" />
                    ) : (
                      <Text className="text-zinc-950 font-black text-[17px]">
                        Verify & Enter
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

            </View>
          </View>

          <View className="mt-10 items-center">
            <View className="flex-row items-center mb-6 opacity-60">
              <Ionicons name="shield-checkmark" size={14} color="#A1A1AA" />
              <Text className="text-zinc-400 text-[11px] font-bold uppercase tracking-[0.15em] ml-2">
                Enterprise-Grade Encryption
              </Text>
            </View>
          </View>
          
          <View nativeID="clerk-captcha" />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}