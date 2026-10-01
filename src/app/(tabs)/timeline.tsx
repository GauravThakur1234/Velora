// timeline.tsx
// ⚠️ SUPABASE PREREQUISITE: Run this in your Supabase SQL Editor to support the new features:
// ALTER TABLE user_daily_schedule ADD COLUMN IF NOT EXISTS task_date DATE DEFAULT CURRENT_DATE;
// ALTER TABLE user_daily_schedule ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';
// ALTER TABLE user_daily_schedule ADD COLUMN IF NOT EXISTS description TEXT;

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, TextInput, StyleSheet, Modal, 
  KeyboardAvoidingView, Platform, RefreshControl, Alert,
  LayoutAnimation, UIManager, Animated, Dimensions
} from 'react-native';
import { useUser } from '@clerk/expo';
import { supabase } from '../lib/supabase';
import { 
  Plus, CheckCircle2, Sparkles, X, Trash2, 
  LayoutGrid, ProjectorIcon, Calendar, Users, HomeIcon, Briefcase,
  TimelineIcon, SettingsIcon, Clock, Flame, ChevronRight, Edit3, Circle,
  BarChart2, Zap
} from 'lucide-react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- Types & Configurations ---
type TimelineCategory = 'ADMIN' | 'BUILD' | 'MARKET' | 'BREAK' | 'MEETING';
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

type TimelineTask = {
  id: string;
  clerk_user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  task_date: string;
  category: TimelineCategory;
  project_name: string | null;
  priority: Priority;
  is_completed: boolean;
  is_now: boolean;
};

const CATEGORY_CONFIG: Record<TimelineCategory, { color: string, bg: string, icon: any }> = {
  ADMIN: { color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.12)', icon: Briefcase },
  BUILD: { color: '#818CF8', bg: 'rgba(129, 140, 248, 0.12)', icon: Zap },
  MARKET: { color: '#F472B6', bg: 'rgba(244, 114, 182, 0.12)', icon: BarChart2 },
  BREAK: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', icon: Clock },
  MEETING: { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', icon: Users },
};

const PROJECTS = [
  { name: 'Core Platform', icon: '🚀' },
  { name: 'Marketing Site', icon: '📱' },
  { name: 'Internal Tools', icon: '⚙️' },
  { name: 'Client Work', icon: '💼' },
  { name: 'No Project', icon: '⚪' },
];

const PRIORITIES: Record<Priority, { color: string, icon: any }> = {
  LOW: { color: '#71717A', icon: Circle },
  NORMAL: { color: '#60A5FA', icon: Circle },
  HIGH: { color: '#F97316', icon: Flame },
  URGENT: { color: '#EF4444', icon: Flame },
};

// --- Helpers ---
const getTodayString = () => new Date().toISOString().split('T')[0];

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${m} ${ampm}`;
};

const generateDateStrip = () => {
  const dates = [];
  const today = new Date();
  for (let i = -3; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      dayNum: d.getDate(),
      isToday: i === 0,
    });
  }
  return dates;
};

export default function EnhancedTimelineSchedule() {
  const { user, isLoaded } = useUser();
  
  // State
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dates] = useState(generateDateStrip());
  
  // Progress Animation
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<TimelineTask>>({ 
    start_time: '09:00', end_time: '10:00', category: 'BUILD', project_name: PROJECTS[0].name, priority: 'NORMAL', task_date: getTodayString()
  });

  useEffect(() => {
    if (isLoaded && user) fetchTasks();
  }, [isLoaded, user, selectedDate]);

  useEffect(() => {
    const completed = tasks.filter(t => t.is_completed).length;
    const total = tasks.length;
    const percentage = total === 0 ? 0 : (completed / total) * 100;
    
    Animated.timing(progressAnim, {
      toValue: percentage,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [tasks]);

  // --- CRUD Operations ---
  const fetchTasks = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from('user_daily_schedule')
        .select('*')
        .eq('clerk_user_id', user.id)
        .eq('task_date', selectedDate)
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTasks(data || []);
    } catch (error: any) {
      console.error('Fetch error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => fetchTasks(true), [selectedDate]);

  const openCreateModal = () => {
    setFormData({
      title: '', description: '', start_time: '09:00', end_time: '10:00', 
      category: 'BUILD', project_name: PROJECTS[0].name, priority: 'NORMAL', task_date: selectedDate
    });
    setSelectedTask(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.title?.trim() || !formData.start_time || !formData.end_time) {
      return Alert.alert('Error', 'Time and title are required.');
    }
    
    try {
      setIsSubmitting(true);
      const payload = {
        title: formData.title,
        description: formData.description || null,
        start_time: formData.start_time.includes(':00') ? formData.start_time : `${formData.start_time}:00`,
        end_time: formData.end_time.includes(':00') ? formData.end_time : `${formData.end_time}:00`,
        task_date: formData.task_date || selectedDate,
        category: formData.category,
        priority: formData.priority,
        project_name: formData.project_name === 'No Project' ? null : formData.project_name,
        clerk_user_id: user.id,
      };

      if (selectedTask) {
        // Update
        const { error } = await supabase.from('user_daily_schedule').update(payload).eq('id', selectedTask.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase.from('user_daily_schedule').insert([{ ...payload, is_completed: false, is_now: false }]);
        if (error) throw error;
      }
      
      setModalVisible(false);
      fetchTasks();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleComplete = async (task: TimelineTask) => {
    if (!user) return;
    const newStatus = !task.is_completed;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: newStatus, is_now: false } : t));
    await supabase.from('user_daily_schedule').update({ is_completed: newStatus, is_now: false }).eq('id', task.id);
    setActionModalVisible(false);
  };

  const setAsNow = async (task: TimelineTask) => {
    if (!user) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => prev.map(t => ({ ...t, is_now: t.id === task.id, is_completed: t.id === task.id ? false : t.is_completed })));
    await supabase.from('user_daily_schedule').update({ is_now: false }).eq('clerk_user_id', user.id).eq('task_date', selectedDate);
    await supabase.from('user_daily_schedule').update({ is_now: true, is_completed: false }).eq('id', task.id);
    setActionModalVisible(false);
  };

  const handleDelete = (id: string) => {
    if (!user) return;
    Alert.alert('Delete Block', 'Permanently remove this time block?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTasks(prev => prev.filter(t => t.id !== id));
          setActionModalVisible(false);
          await supabase.from('user_daily_schedule').delete().eq('id', id);
        }
      }
    ]);
  };

  const openActionModal = (task: TimelineTask) => {
    setSelectedTask(task);
    setActionModalVisible(true);
  };

  // Dynamic AI Insight Generator
  const generateInsight = () => {
    if (tasks.length === 0) return "Your schedule is clear. Plan your day to maximize deep work.";
    const completed = tasks.filter(t => t.is_completed).length;
    if (completed === tasks.length) return "Incredible work! You've cleared your entire schedule for today.";
    
    const buildTasks = tasks.filter(t => t.category === 'BUILD').length;
    const adminTasks = tasks.filter(t => t.category === 'ADMIN').length;
    
    if (buildTasks > adminTasks) return "Focus heavily on execution today. Protect your deep work blocks from interruptions.";
    if (adminTasks > 1) return "High operational load today. Try to batch these admin tasks to save cognitive energy.";
    return "Steady pace ahead. Complete your highest priority task first to build momentum.";
  };

  if (!isLoaded || (loading && !refreshing && tasks.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Synchronizing Workspace...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" backgroundColor="#000000" />
      
      {/* Absolute Ambient Backgrounds */}
      <View style={[styles.ambientGlow, { top: -50, left: -50, backgroundColor: 'rgba(99, 102, 241, 0.08)' }]} />
      <View style={[styles.ambientGlow, { top: 100, right: -100, backgroundColor: 'rgba(236, 72, 153, 0.05)' }]} />

      {/* --- Top Header & Date Strip --- */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.greetingText}>Timeline Workspace</Text>
            <Text style={styles.dateLabel}>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          </View>
          <TouchableOpacity onPress={openCreateModal} style={styles.fabButton}>
            <Plus color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
          {dates.map((d, i) => {
            const isSelected = d.dateStr === selectedDate;
            return (
              <TouchableOpacity 
                key={i} 
                onPress={() => setSelectedDate(d.dateStr)}
                style={[styles.dateBlock, isSelected && styles.dateBlockSelected, d.isToday && !isSelected && styles.dateBlockToday]}
              >
                <Text style={[styles.dateDayName, isSelected && { color: '#000' }]}>{d.dayName}</Text>
                <Text style={[styles.dateDayNum, isSelected && { color: '#000' }]}>{d.dayNum}</Text>
                {d.isToday && <View style={[styles.todayDot, isSelected && { backgroundColor: '#000' }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.mainScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A1A1AA" />}
      >
        {/* Progress Bar & Insights */}
        <View style={styles.dashboardCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>DAILY VELOCITY</Text>
            <Text style={styles.progressStats}>{tasks.filter(t => t.is_completed).length} / {tasks.length} Done</Text>
          </View>
          
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, {
              width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
            }]} />
          </View>

          <View style={styles.aiInsightBox}>
            <Sparkles size={16} color="#A78BFA" style={{ marginTop: 2 }} />
            <Text style={styles.aiInsightText}>{generateInsight()}</Text>
          </View>
        </View>

        {/* Timeline List */}
        {tasks.length === 0 ? (
           <View style={styles.emptyContainer}>
             <View style={styles.emptyIconBg}>
               <Calendar size={32} color="#71717A" />
             </View>
             <Text style={styles.emptyTitle}>No blocks scheduled</Text>
             <Text style={styles.emptySub}>Reclaim your day. Tap the + icon above to start time-blocking your objectives.</Text>
           </View>
        ) : (
          <View style={styles.timelineContainer}>
            {tasks.map((task, index) => {
              const isLast = index === tasks.length - 1;
              const catConfig = CATEGORY_CONFIG[task.category];
              const prioConfig = PRIORITIES[task.priority];
              const CategoryIcon = catConfig.icon;
              
              let statusColor = '#27272A';
              if (task.is_completed) statusColor = '#10B981';
              if (task.is_now) statusColor = '#6366F1';

              return (
                <View key={task.id} style={styles.timelineRow}>
                  {/* Left Column: Time & Line */}
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, task.is_now && styles.timeTextNow]}>
                      {formatTime(task.start_time).replace(' AM', '').replace(' PM', '')}
                    </Text>
                    <Text style={styles.amPmText}>{formatTime(task.start_time).split(' ')[1]}</Text>
                    
                    <View style={styles.lineContainer}>
                      <View style={[styles.timelineDot, { backgroundColor: statusColor, borderColor: task.is_now ? 'rgba(99, 102, 241, 0.4)' : 'transparent', borderWidth: task.is_now ? 4 : 0 }]} />
                      {!isLast && <View style={[styles.timelineLine, task.is_completed && styles.timelineLineCompleted]} />}
                    </View>
                  </View>

                  {/* Right Column: Card */}
                  <TouchableOpacity 
                    onPress={() => openActionModal(task)}
                    activeOpacity={0.7}
                    style={[
                      styles.taskCard, 
                      task.is_now && styles.taskCardNow, 
                      task.is_completed && styles.taskCardCompleted,
                      task.priority === 'URGENT' && !task.is_completed && styles.taskCardUrgent
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.badgesRow}>
                        <View style={[styles.categoryPill, { backgroundColor: catConfig.bg }]}>
                          <CategoryIcon size={10} color={catConfig.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.categoryText, { color: catConfig.color }]}>{task.category}</Text>
                        </View>
                        
                        {task.priority === 'URGENT' && (
                          <View style={[styles.priorityPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                            <Flame size={10} color="#EF4444" style={{ marginRight: 2 }} />
                            <Text style={[styles.priorityText, { color: '#EF4444' }]}>URGENT</Text>
                          </View>
                        )}
                        
                        {task.is_now && (
                          <View style={styles.nowBadge}>
                            <View style={styles.nowPulse} />
                            <Text style={styles.nowBadgeText}>IN PROGRESS</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.durationText, task.is_completed && styles.timeRangeCompleted]}>
                        {formatTime(task.start_time)} – {formatTime(task.end_time)}
                      </Text>
                    </View>

                    <View style={styles.cardBody}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={[styles.taskTitle, task.is_now && styles.taskTitleNow, task.is_completed && styles.taskTitleCompleted]}>
                          {task.title}
                        </Text>
                        {task.project_name && (
                          <View style={styles.projectContext}>
                            <Briefcase size={12} color="#71717A" />
                            <Text style={styles.projectContextText}>{task.project_name}</Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Quick Complete Toggle Button inside Card */}
                      <TouchableOpacity 
                        onPress={() => toggleComplete(task)} 
                        style={[styles.quickCompleteBtn, task.is_completed && styles.quickCompleteBtnActive]}
                      >
                        <CheckCircle2 color={task.is_completed ? '#10B981' : '#3F3F46'} size={24} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* --- Action Modal (Tap on Task) --- */}
      <Modal visible={actionModalVisible} animationType="fade" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.modalDragIndicator} />
            <Text style={styles.actionSheetTitle} numberOfLines={1}>{selectedTask?.title}</Text>
            
            <TouchableOpacity style={styles.actionButton} onPress={() => selectedTask && toggleComplete(selectedTask)}>
              <CheckCircle2 size={20} color={selectedTask?.is_completed ? '#A1A1AA' : '#10B981'} />
              <Text style={[styles.actionButtonText, { color: selectedTask?.is_completed ? '#A1A1AA' : '#10B981' }]}>
                {selectedTask?.is_completed ? 'Mark as Incomplete' : 'Mark as Completed'}
              </Text>
            </TouchableOpacity>
            
            {!selectedTask?.is_completed && !selectedTask?.is_now && (
              <TouchableOpacity style={styles.actionButton} onPress={() => selectedTask && setAsNow(selectedTask)}>
                <Zap size={20} color="#6366F1" />
                <Text style={[styles.actionButtonText, { color: '#6366F1' }]}>Start Working on this Now</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionButton} onPress={() => { setActionModalVisible(false); setFormData(selectedTask as any); setModalVisible(true); }}>
              <Edit3 size={20} color="#FAFAFA" />
              <Text style={styles.actionButtonText}>Edit Time Block</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.actionButtonDestructive]} onPress={() => selectedTask && handleDelete(selectedTask.id)}>
              <Trash2 size={20} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Delete Time Block</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* --- Detailed Editor/Create Modal --- */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{selectedTask ? 'Edit Block' : 'New Block'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color="#A1A1AA" size={20} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.inputLabel}>WHAT ARE YOU EXECUTING?</Text>
              <TextInput 
                value={formData.title} onChangeText={(t) => setFormData({...formData, title: t})}
                placeholder="e.g., Build Authentication Flow" placeholderTextColor="#52525B"
                style={styles.modalInput}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.inputLabel}>START (HH:MM)</Text>
                  <TextInput value={formData.start_time} onChangeText={(t) => setFormData({...formData, start_time: t})} style={styles.modalInput} keyboardType="numbers-and-punctuation"/>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>END (HH:MM)</Text>
                  <TextInput value={formData.end_time} onChangeText={(t) => setFormData({...formData, end_time: t})} style={styles.modalInput} keyboardType="numbers-and-punctuation" />
                </View>
              </View>

              <Text style={styles.inputLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                {(['BUILD', 'ADMIN', 'MARKET', 'MEETING', 'BREAK'] as TimelineCategory[]).map(cat => {
                  const isSel = formData.category === cat;
                  const config = CATEGORY_CONFIG[cat];
                  return (
                    <TouchableOpacity 
                      key={cat} onPress={() => setFormData({...formData, category: cat})}
                      style={[styles.modalCatBtn, isSel && { backgroundColor: config.bg, borderColor: config.color }]}
                    >
                      <Text style={[styles.modalCatText, { color: isSel ? config.color : '#71717A' }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>PRIORITY LEVEL</Text>
              <View style={styles.priorityGrid}>
                {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as Priority[]).map(prio => {
                  const isSel = formData.priority === prio;
                  const config = PRIORITIES[prio];
                  return (
                    <TouchableOpacity 
                      key={prio} onPress={() => setFormData({...formData, priority: prio})}
                      style={[styles.prioBtn, isSel && { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: config.color }]}
                    >
                      <Text style={[styles.prioText, { color: isSel ? config.color : '#71717A' }]}>{prio}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>PROJECT ASSIGNMENT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                {PROJECTS.map(proj => {
                  const isSel = formData.project_name === proj.name;
                  return (
                    <TouchableOpacity 
                      key={proj.name} onPress={() => setFormData({...formData, project_name: proj.name})}
                      style={[styles.projectSelectBtn, isSel && styles.projectSelectBtnActive]}
                    >
                      <Text style={styles.projectSelectIcon}>{proj.icon}</Text>
                      <Text style={[styles.projectSelectText, isSel && { color: '#000' }]}>{proj.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={handleSave} disabled={isSubmitting} style={styles.saveBtn}>
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Commit to Timeline</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- Unified Bottom Navigation --- */}
      <View style={styles.bottomNav}>
         <Link href="/(tabs)/dashboard" asChild><TouchableOpacity style={styles.bottomTab}><HomeIcon size={22} color="#71717A" /><Text style={styles.bottomTabText}>Home</Text></TouchableOpacity></Link>
         <Link href="/(tabs)/kanban" asChild><TouchableOpacity style={styles.bottomTab}><LayoutGrid size={22} color="#71717A" /><Text style={styles.bottomTabText}>Kanban</Text></TouchableOpacity></Link>
         <Link href="/(tabs)/projects" asChild><TouchableOpacity style={styles.bottomTab}><ProjectorIcon size={22} color="#71717A" /><Text style={styles.bottomTabText}>Projects</Text></TouchableOpacity></Link>
         <Link href="/(tabs)/team" asChild><TouchableOpacity style={styles.bottomTab}><Users size={22} color="#71717A" /><Text style={styles.bottomTabText}>Teams</Text></TouchableOpacity></Link>
         
         {/* ACTIVE STATE */}
         <View style={styles.navActiveItem}>
            <TimelineIcon size={20} color="#6366F1" />
            <Text style={styles.navActiveText}>TimeLine</Text>
         </View>
      </View>
    </SafeAreaView>
  );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600' },
  ambientGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: 'blur(80px)' },

  // Header & Dates
  headerContainer: { paddingTop: 10, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.8)', borderBottomWidth: 1, borderBottomColor: '#18181B' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  greetingText: { color: '#FAFAFA', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  dateLabel: { color: '#A1A1AA', fontSize: 13, fontWeight: '600', marginTop: 2 },
  fabButton: { width: 44, height: 44, backgroundColor: '#6366F1', borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  
  dateScroll: { paddingHorizontal: 16, paddingBottom: 4 },
  dateBlock: { width: 60, height: 75, backgroundColor: '#09090B', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#18181B' },
  dateBlockToday: { borderColor: '#3F3F46' },
  dateBlockSelected: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA', transform: [{ scale: 1.05 }] },
  dateDayName: { color: '#71717A', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  dateDayNum: { color: '#FAFAFA', fontSize: 20, fontWeight: '900' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#6366F1', marginTop: 4 },

  // Main Scroll & Dashboard
  mainScroll: { padding: 20, paddingBottom: 120 },
  dashboardCard: { backgroundColor: '#09090B', borderRadius: 20, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: '#1F1F22' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  progressTitle: { color: '#A1A1AA', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  progressStats: { color: '#FAFAFA', fontSize: 14, fontWeight: '800' },
  progressBarBg: { height: 6, backgroundColor: '#18181B', borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 3 },
  aiInsightBox: { flexDirection: 'row', backgroundColor: 'rgba(167, 139, 250, 0.08)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.15)' },
  aiInsightText: { color: '#C4B5FD', fontSize: 13, lineHeight: 20, marginLeft: 10, flex: 1, fontWeight: '500' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 40, padding: 20 },
  emptyIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#27272A' },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Timeline
  timelineContainer: { paddingLeft: 0 },
  timelineRow: { flexDirection: 'row', marginBottom: 16, minHeight: 85 },
  timeColumn: { width: 60, alignItems: 'flex-end', paddingRight: 16, position: 'relative' },
  timeText: { color: '#71717A', fontSize: 13, fontWeight: '700', marginTop: 16 },
  timeTextNow: { color: '#6366F1', fontWeight: '900' },
  amPmText: { color: '#52525B', fontSize: 10, fontWeight: '800', marginTop: 2 },
  
  lineContainer: { position: 'absolute', right: -6, top: 22, alignItems: 'center', bottom: -40 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, zIndex: 10 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#18181B', marginTop: -2 },
  timelineLineCompleted: { backgroundColor: 'rgba(16, 185, 129, 0.3)' },

  // Task Cards
  taskCard: { flex: 1, backgroundColor: '#09090B', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1F1F22', marginLeft: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  taskCardNow: { borderColor: '#6366F1', backgroundColor: '#111113' },
  taskCardCompleted: { opacity: 0.5, borderColor: '#18181B' },
  taskCardUrgent: { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.02)' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  categoryText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  priorityPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  priorityText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  nowBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  nowPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#818CF8', marginRight: 6 },
  nowBadgeText: { color: '#818CF8', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  
  durationText: { color: '#71717A', fontSize: 11, fontWeight: '700', marginLeft: 8 },
  timeRangeCompleted: { textDecorationLine: 'line-through', color: '#52525B' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTitle: { color: '#E4E4E7', fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
  taskTitleNow: { color: '#FAFAFA', fontWeight: '800' },
  taskTitleCompleted: { color: '#52525B', textDecorationLine: 'line-through' },
  
  projectContext: { flexDirection: 'row', alignItems: 'center' },
  projectContextText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  
  quickCompleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  quickCompleteBtnActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  actionSheet: { backgroundColor: '#09090B', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#27272A' },
  modalDragIndicator: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  actionSheetTitle: { color: '#FAFAFA', fontSize: 18, fontWeight: '800', marginBottom: 24, textAlign: 'center' },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#18181B' },
  actionButtonDestructive: { borderBottomWidth: 0, marginTop: 8 },
  actionButtonText: { color: '#FAFAFA', fontSize: 16, fontWeight: '600', marginLeft: 16 },

  fullModalContent: { backgroundColor: '#09090B', height: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderWidth: 1, borderColor: '#27272A' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '900' },
  closeBtn: { width: 40, height: 40, backgroundColor: '#18181B', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  inputLabel: { color: '#71717A', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  modalInput: { backgroundColor: '#111113', color: '#FAFAFA', padding: 18, borderRadius: 16, marginBottom: 20, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#27272A' },
  rowInputs: { flexDirection: 'row' },
  
  modalCatBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#111113', marginRight: 10, borderWidth: 1, borderColor: '#27272A' },
  modalCatText: { fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  
  priorityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  prioBtn: { flex: 1, minWidth: '45%', paddingVertical: 14, borderRadius: 12, backgroundColor: '#111113', alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  prioText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  projectSelectBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#111113', marginRight: 10, borderWidth: 1, borderColor: '#27272A' },
  projectSelectBtnActive: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA' },
  projectSelectIcon: { fontSize: 14, marginRight: 8 },
  projectSelectText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },

  modalFooter: { paddingTop: 20, borderTopWidth: 1, borderTopColor: '#18181B' },
  saveBtn: { backgroundColor: '#FAFAFA', padding: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  navActiveText: { color: '#6366F1', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});