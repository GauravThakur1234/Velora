import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator, 
  Image,
  Pressable,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// Data Types based on our advanced schema
interface User {
  id: string;
  full_name: string;
  avatar_url: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  story_points: number;
  users: User; // Joined relation
}

export default function EnhancedDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    // Fetching tasks with their assigned users
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, status, priority, story_points,
        users (id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setTasks(data as unknown as Task[]);
    setLoading(false);
  };

  // --- Dynamic Chart Data Calculations ---
  
  // 1. Task Status Distribution (Donut Chart)
  const statusData = useMemo(() => {
    const counts = { todo: 0, in_progress: 0, review: 0, done: 0 };
    tasks.forEach(t => { if (counts[t.status as keyof typeof counts] !== undefined) counts[t.status as keyof typeof counts]++; });
    
    return [
      { value: counts.todo || 1, color: '#52525B', text: 'To Do' }, // Zinc
      { value: counts.in_progress || 1, color: '#6366F1', text: 'Active' }, // Indigo
      { value: counts.review || 1, color: '#E879F9', text: 'Review' }, // Fuchsia
      { value: counts.done || 1, color: '#34D399', text: 'Done' }, // Emerald
    ];
  }, [tasks]);

  // 2. Workload by Priority (Bar Chart)
  const priorityData = useMemo(() => {
    const points = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.forEach(t => { if (points[t.priority as keyof typeof points] !== undefined) points[t.priority as keyof typeof points] += t.story_points; });
    
    return [
      { value: points.low, label: 'Low', frontColor: '#A1A1AA' },
      { value: points.medium, label: 'Med', frontColor: '#FBBF24' },
      { value: points.high, label: 'High', frontColor: '#FB7185' },
      { value: points.urgent, label: 'Urg', frontColor: '#E11D48' },
    ];
  }, [tasks]);

  const totalPoints = tasks.reduce((sum, t) => sum + t.story_points, 0);
  const completedPoints = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + t.story_points, 0);
  const progressPercent = totalPoints === 0 ? 0 : Math.round((completedPoints / totalPoints) * 100);

  if (loading) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09090B' }} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Ambient Glow Effects */}
      <View className="absolute top-[-10%] right-[-20%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <View className="absolute top-[40%] left-[-20%] w-[400px] h-[400px] bg-fuchsia-600/10 rounded-full blur-[140px] pointer-events-none" />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* Header Area */}
        <View className="px-6 pt-6 pb-2">
          <View className="flex-row justify-between items-center mb-8">
            <View className="bg-white/5 px-4 py-1.5 rounded-full border border-white/10 flex-row items-center">
              <View className="w-2 h-2 bg-emerald-400 rounded-full mr-2 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <Text className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Sprint 42 Active</Text>
            </View>
            <Pressable className="w-10 h-10 bg-zinc-900 rounded-full items-center justify-center border border-white/10">
              <Text className="text-white">🔔</Text>
            </Pressable>
          </View>

          {/* Premium Highlighted Typography */}
          <View className="flex-row flex-wrap items-baseline mb-2">
            <Text className="text-white text-5xl font-black tracking-tighter leading-tight">
              Project{' '}
            </Text>
            <View className="relative">
              <View className="absolute bottom-2 left-0 right-0 h-4 bg-fuchsia-500/80 rounded-sm" />
              <Text className="text-white text-5xl font-black tracking-tighter leading-tight relative z-10">
                Velocity.
              </Text>
            </View>
          </View>
          <Text className="text-zinc-400 text-base font-medium">Tracking {tasks.length} active issues across the board.</Text>
        </View>

        {/* Bento Grid: Core Analytics */}
        <View className="px-6 mt-8 flex-row gap-4">
          
          {/* Main Donut Chart Widget */}
          <View className="flex-[1.5] bg-white/5 rounded-[32px] p-1 border border-white/10 shadow-xl shadow-black">
            <View className="flex-1 bg-zinc-900/90 rounded-[28px] p-5 items-center justify-center">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest self-start mb-2">Distribution</Text>
              <View className="scale-90">
                <PieChart
                  data={statusData}
                  donut
                  innerRadius={50}
                  radius={75}
                  innerCircleColor="#18181B"
                  centerLabelComponent={() => (
                    <View className="items-center justify-center">
                      <Text className="text-white text-3xl font-black">{progressPercent}%</Text>
                      <Text className="text-zinc-500 text-[10px] font-bold">DONE</Text>
                    </View>
                  )}
                />
              </View>
            </View>
          </View>

          {/* Side Mini-Widgets */}
          <View className="flex-1 gap-4">
            <View className="flex-1 bg-white/5 rounded-[24px] p-1 border border-white/10">
              <View className="flex-1 bg-indigo-500/10 rounded-[20px] p-4 justify-center">
                <Text className="text-indigo-400 text-3xl font-black">{completedPoints}</Text>
                <Text className="text-zinc-400 text-xs font-bold mt-1">Pts Completed</Text>
              </View>
            </View>
            
            <View className="flex-1 bg-white/5 rounded-[24px] p-1 border border-white/10">
              <View className="flex-1 bg-rose-500/10 rounded-[20px] p-4 justify-center">
                <Text className="text-rose-400 text-3xl font-black">{tasks.filter(t => t.priority === 'urgent').length}</Text>
                <Text className="text-zinc-400 text-xs font-bold mt-1">Urgent Issues</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bento Grid: Workload Bar Chart */}
        <View className="px-6 mt-4">
          <View className="w-full bg-white/5 rounded-[32px] p-1 border border-white/10">
            <View className="w-full bg-zinc-900/90 rounded-[28px] p-6">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-white font-bold text-lg">Story Points by Priority</Text>
                <Text className="text-zinc-500 text-xs font-bold tracking-wider uppercase">Burndown</Text>
              </View>
              <View className="ml-[-10px]">
                <BarChart
                  data={priorityData}
                  width={width - 120}
                  height={120}
                  barWidth={32}
                  spacing={24}
                  roundedTop
                  roundedBottom
                  hideRules
                  xAxisThickness={0}
                  yAxisThickness={0}
                  yAxisTextStyle={{ color: '#71717A' }}
                  noOfSections={3}
                  labelTextStyle={{ color: '#A1A1AA', fontWeight: 'bold' }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Task Feed (Jira-style Backlog/Active list) */}
        <View className="px-6 mt-8">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-white text-2xl font-black tracking-tight">Active Tasks</Text>
            <Text className="text-indigo-400 text-sm font-bold">View Board →</Text>
          </View>

          <View className="gap-3">
            {tasks.map((task) => (
              <View key={task.id} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex-row items-center justify-between transition-transform active:scale-[0.98]">
                
                <View className="flex-1 mr-3">
                  <Text className="text-white font-semibold text-base mb-1" numberOfLines={1}>
                    {task.title}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-zinc-500 text-xs font-bold mr-3">VEL-{task.id.slice(0, 3).toUpperCase()}</Text>
                    
                    {/* Status Pill */}
                    <View className={`px-2 py-0.5 rounded flex-row items-center mr-2
                      ${task.status === 'done' ? 'bg-emerald-500/20' : 
                        task.status === 'in_progress' ? 'bg-indigo-500/20' : 
                        task.status === 'review' ? 'bg-fuchsia-500/20' : 'bg-zinc-800'}`}
                    >
                      <View className={`w-1.5 h-1.5 rounded-full mr-1.5
                        ${task.status === 'done' ? 'bg-emerald-400' : 
                          task.status === 'in_progress' ? 'bg-indigo-400' : 
                          task.status === 'review' ? 'bg-fuchsia-400' : 'bg-zinc-500'}`} 
                      />
                      <Text className={`text-[10px] font-black uppercase ${task.status === 'done' ? 'text-emerald-400' : task.status === 'in_progress' ? 'text-indigo-400' : task.status === 'review' ? 'text-fuchsia-400' : 'text-zinc-400'}`}>
                        {task.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Assignee & Points */}
                <View className="items-end">
                  {task.users?.avatar_url ? (
                    <Image 
                      source={{ uri: task.users.avatar_url }} 
                      className="w-8 h-8 rounded-full border border-zinc-700 mb-1"
                    />
                  ) : (
                    <View className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 mb-1" />
                  )}
                  <View className="bg-zinc-800 px-1.5 py-0.5 rounded">
                    <Text className="text-zinc-400 text-[10px] font-bold">{task.story_points} pt</Text>
                  </View>
                </View>

              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}