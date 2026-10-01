import React from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09090B' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      
      {/* Background Ambient Glows (Startup Web Aesthetic) */}
      <View className="absolute top-[-10%] left-[-20%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px]" />
      <View className="absolute top-[30%] right-[-20%] w-72 h-72 bg-fuchsia-600/15 rounded-full blur-[100px]" />

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }} 
        showsVerticalScrollIndicator={false}
        className="flex-1 px-6 pt-8 pb-10"
      >
        
        {/* Header / Logo */}
        <View className="flex-row items-center mb-12">
          <View className="w-8 h-8 bg-white rounded-lg items-center justify-center mr-3 shadow-sm shadow-white/20">
            <View className="w-4 h-4 bg-zinc-950 rounded-sm" />
          </View>
          <Text className="text-white text-xl font-bold tracking-tight">Velora</Text>
        </View>

        {/* Hero Section */}
        <View className="items-start w-full">
          
          {/* Version / Update Pill */}
          <View className="bg-white/5 px-4 py-2 rounded-full border border-white/10 mb-6 flex-row items-center overflow-hidden">
            <View className="w-2 h-2 bg-fuchsia-400 rounded-full mr-2 shadow-[0_0_8px_rgba(232,121,249,0.8)]" />
            <Text className="text-zinc-300 text-xs font-semibold tracking-widest uppercase">
              Velora 2.0 is here
            </Text>
          </View>
          
          {/* Ultra-Bold Typography */}
          <Text className="text-white text-6xl font-black tracking-tighter leading-[64px] mb-6">
            The workspace for <Text className="text-transparent bg-clip-text" style={{ color: '#E879F9' }}>startups.</Text>
          </Text>
          
          <Text className="text-zinc-400 text-lg mb-8 leading-relaxed font-medium max-w-[90%]">
            Ditch the clutter. Velora is the lightning-fast issue tracker designed for teams that ship daily.
          </Text>

          {/* Social Proof (Overlapping Avatars) */}
          <View className="flex-row items-center mb-12">
            <View className="flex-row">
              {[
                'https://i.pravatar.cc/100?img=32',
                'https://i.pravatar.cc/100?img=47',
                'https://i.pravatar.cc/100?img=12',
                'https://i.pravatar.cc/100?img=68',
              ].map((uri, i) => (
                <Image 
                  key={i}
                  source={{ uri }}
                  className={`w-10 h-10 rounded-full border-2 border-zinc-950 ${i > 0 ? '-ml-4' : ''}`}
                />
              ))}
            </View>
            <View className="ml-4">
              <View className="flex-row items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Text key={star} className="text-yellow-500 text-sm">★</Text>
                ))}
              </View>
              <Text className="text-zinc-400 text-xs mt-0.5 font-medium">Joined by 10,000+ founders</Text>
            </View>
          </View>

          {/* Glassmorphic App Preview Card */}
          <View className="w-full bg-white/5 rounded-[32px] border border-white/10 p-1 mb-8 overflow-hidden shadow-2xl shadow-black">
            <View className="w-full bg-zinc-900/90 rounded-[28px] p-5">
              <View className="flex-row justify-between items-center mb-6">
                 <Text className="text-white font-bold text-lg">Active Sprint</Text>
                 <View className="bg-indigo-500/20 px-3 py-1 rounded-full">
                    <Text className="text-indigo-400 text-xs font-bold">4 days left</Text>
                 </View>
              </View>

              {/* Fake UI Rows */}
              <View className="gap-3">
                {[
                  { title: 'Implement Stripe Billing', tag: 'High', color: 'bg-rose-500/20 text-rose-400' },
                  { title: 'Fix navigation gesture bug', tag: 'Bug', color: 'bg-amber-500/20 text-amber-400' },
                  { title: 'Write launch copy', tag: 'Marketing', color: 'bg-emerald-500/20 text-emerald-400' },
                ].map((task, idx) => (
                  <View key={idx} className="flex-row justify-between items-center bg-zinc-800/50 p-4 rounded-2xl border border-white/5">
                    <View className="flex-row items-center flex-1">
                      <View className="w-5 h-5 rounded-full border-2 border-zinc-600 mr-3" />
                      <Text className="text-zinc-200 font-medium text-sm flex-1 mr-2" numberOfLines={1}>{task.title}</Text>
                    </View>
                    <View className={`px-2 py-1 rounded-md ${task.color.split(' ')[0]}`}>
                      <Text className={`text-[10px] font-bold ${task.color.split(' ')[1]}`}>{task.tag}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Fixed Bottom Action Area (Docked) */}
      <View className="w-full px-6 pt-4 pb-4 bg-zinc-950/80 border-t border-white/5">
      <Link href='/(auth)/authentication' className='w-full bg-white rounded-2xl py-4 items-center justify-center flex-row shadow-lg shadow-white/20 active:scale-[0.98] transition-transform'>
          <Text className="text-zinc-950 text-center font-extrabold text-lg mr-2">
            Start Building Free
          </Text>
          <Text className="text-zinc-950 text-xl">→</Text>
        </Link>
        <View className="flex-row justify-center mt-5">
          <Text className="text-zinc-500 font-medium text-sm">Already have an account? </Text>
          <Pressable>
            <Text className="text-white font-bold text-sm">Sign in</Text>
          </Pressable>
        </View>
      </View>

    </SafeAreaView>
  );
}