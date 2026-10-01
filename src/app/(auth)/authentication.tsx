import { useAuth, useSignUp } from '@clerk/expo';
import { useState } from 'react';
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
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Ensure @expo/vector-icons is installed

export default function MainScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signUp, setActive } = useSignUp();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | 'code' | null>(null);

const handleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setIsLoading(true);
    
    try {
      // Safely check for Clerk Core 3 (The Newest 2026 API)
      if (signUp.verifications && typeof signUp.verifications.sendEmailCode === 'function') {
        const { error } = await signUp.password({ emailAddress, password });
        if (error) throw new Error(error.message);
        
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) throw new Error(sendError.message);
        
      } else {
        // Fallback for Clerk v4 / v5 (Older APIs)
        await signUp.create({ emailAddress, password });

        if (typeof signUp.prepareVerification === 'function') {
          await signUp.prepareVerification({ strategy: 'email_code' });
        } else if (typeof (signUp as any).prepareEmailAddressVerification === 'function') {
          await (signUp as any).prepareEmailAddressVerification({ strategy: 'email_code' });
        } else {
          throw new Error("Could not find a valid verification method for this Clerk version.");
        }
      }
      
      setIsVerifying(true);
    } catch (err: any) {
      console.error("Clerk Sign Up Error:", err);
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
      // Safely check for Clerk Core 3 (The Newest 2026 API)
      if (signUp.verifications && typeof signUp.verifications.verifyEmailCode === 'function') {
        const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
        if (verifyError) throw new Error(verifyError.message);
        
        if (signUp.status === 'complete') {
          await signUp.finalize();
          // setActive is handled automatically by .finalize() in Core 3
        }
      } else {
        // Fallback for Clerk v4 / v5 (Older APIs)
        let completeSignUp: any;
        
        if (typeof signUp.attemptVerification === 'function') {
          completeSignUp = await signUp.attemptVerification({ strategy: 'email_code', code });
        } else if (typeof (signUp as any).attemptEmailAddressVerification === 'function') {
          completeSignUp = await (signUp as any).attemptEmailAddressVerification({ code });
        } else {
          throw new Error("Could not find a valid verify method for this Clerk version.");
        }

        if (completeSignUp.status === 'complete') {
          await setActive({ session: completeSignUp.createdSessionId });
        } else {
          console.warn('Sign up incomplete:', completeSignUp);
        }
      }
    } catch (err: any) {
      console.error("Clerk Verify Error:", err);
      const errorMessage = err.errors?.[0]?.longMessage || err.message || "Invalid code";
      Alert.alert("Verification Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded) return null;

  if (isSignedIn) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09090B' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      
      {/* Immersive Ambient Background */}
      <View className="absolute top-[-10%] right-[-20%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[100px]" />
      <View className="absolute bottom-[-10%] left-[-20%] w-[500px] h-[500px] bg-fuchsia-600/15 rounded-full blur-[100px]" />
      <View className="absolute top-[40%] left-[10%] w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[120px]" />

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

              {/* Back button for UX during verification */}
              {isVerifying && (
                <Pressable onPress={() => setIsVerifying(false)} className="p-2">
                  <Text className="text-zinc-400 text-sm font-semibold">Change Email</Text>
                </Pressable>
              )}
            </View>
            
            {/* Startup Club Style Highlighted Typography */}
            <View className="flex-row flex-wrap items-end mb-3">
              <Text className="text-white text-[44px] font-black tracking-tight leading-none">
                {isVerifying ? 'Check your ' : 'Start '}
              </Text>
              
              <View className="relative px-1">
                {/* Sleeker Marker Highlight */}
                <View className={`absolute bottom-1 left-0 right-0 h-4 rounded-sm ${isVerifying ? 'bg-fuchsia-500/80' : 'bg-indigo-500/80'}`} />
                <Text className="text-white text-[44px] font-black tracking-tight leading-none relative z-10">
                  {isVerifying ? 'inbox.' : 'building.'}
                </Text>
              </View>
            </View>

            <Text className="text-zinc-400 text-base font-medium leading-relaxed mt-2">
              {isVerifying 
                ? `We sent a secure code to ` 
                : 'Join top founders and elite teams. '}
              <Text className="text-zinc-200 font-bold">
                {isVerifying ? emailAddress : 'No credit card required.'}
              </Text>
            </Text>
          </View>

          {/* Ultra-Premium Glassmorphic Container */}
          <View className="w-full bg-white/[0.02] rounded-[32px] border border-white/[0.08] p-2 shadow-2xl">
            <View className="w-full bg-black/40 rounded-[26px] p-6 border border-white/[0.04]">
              
              {!isVerifying ? (
                <View className="gap-6">
                  {/* Email Input */}
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

                  {/* Password Input */}
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

                  {/* Submit Button */}
                  <Pressable 
                    onPress={handleSignUp}
                    disabled={isLoading || !emailAddress || !password}
                    className={`w-full bg-white rounded-2xl py-4 mt-4 items-center justify-center flex-row shadow-lg active:scale-[0.98] transition-all ${isLoading ? 'opacity-70' : 'opacity-100 shadow-white/20'}`}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#09090B" />
                    ) : (
                      <>
                        <Text className="text-zinc-950 font-black text-[17px] mr-2">
                          Create Account
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#09090B" />
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View className="gap-6">
                  {/* Verification Code Input */}
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

                  {/* Verify Button */}
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

          {/* Bottom Footer Section */}
          <View className="mt-10 items-center">
            {/* Enterprise Trust Marker */}
            <View className="flex-row items-center mb-6 opacity-60">
              <Ionicons name="shield-checkmark" size={14} color="#A1A1AA" />
              <Text className="text-zinc-400 text-[11px] font-bold uppercase tracking-[0.15em] ml-2">
                Enterprise-Grade Encryption
              </Text>
            </View>

            {/* Login Redirect */}
            {!isVerifying && (
              <Pressable 
                onPress={() => router.push('/sign-in')} // Update with your actual sign-in route
                className="flex-row items-center p-2"
              >
                <Text className="text-zinc-400 text-sm font-medium">
                  Already have an account? <Text className="text-white font-bold">Sign In</Text>
                </Text>
              </Pressable>
            )}
          </View>
          
          <View nativeID="clerk-captcha" />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}