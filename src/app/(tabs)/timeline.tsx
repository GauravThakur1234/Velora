import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, TextInput, StyleSheet, Modal, 
  KeyboardAvoidingView, Platform, RefreshControl, Alert,
  LayoutAnimation, UIManager, Image,
  Settings
} from 'react-native';
import { useUser } from '@clerk/expo';
import { supabase } from '../lib/supabase';
import { 
  Plus, CheckCircle2, Sparkles, X, Trash2, 
  LayoutGrid, ProjectorIcon, Calendar, Users, HomeIcon, Briefcase,
  TimelineIcon,
  SettingsIcon
} from 'lucide-react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Types & Configurations ---
type TimelineCategory = 'ADMIN' | 'BUILD' | 'MARKET' | 'BREAK';

type TimelineTask = {
  id: string;
  clerk_user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  category: TimelineCategory;
  project_name: string | null;
  is_completed: boolean;
  is_now: boolean;
};

const CATEGORY_CONFIG: Record<TimelineCategory, { color: string, bg: string }> = {
  ADMIN: { color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.15)' },
  BUILD: { color: '#D4D4D8', bg: 'rgba(212, 212, 216, 0.15)' },
  MARKET: { color: '#F472B6', bg: 'rgba(244, 114, 182, 0.15)' },
  BREAK: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
};

const PROJECTS = [
  { name: 'Core Platform', icon: '🚀' },
  { name: 'Marketing Site', icon: '📱' },
  { name: 'Internal Tools', icon: '⚙️' },
  { name: 'No Project', icon: '⚪' },
];

// Helper: Convert '13:30:00' to '1:30 PM'
const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${m} ${ampm}`;
};

export default function TimelineSchedule() {
  const { user, isLoaded } = useUser();

  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState<Partial<TimelineTask>>({ 
    start_time: '09:00:00', end_time: '10:00:00', category: 'BUILD', project_name: PROJECTS[0].name 
  });

  useEffect(() => {
    if (isLoaded && user) fetchTasks();
  }, [isLoaded, user]);

  // --- CRUD: READ (Secured by Clerk ID) ---
  const fetchTasks = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from('user_daily_schedule')
        .select('*')
        .eq('clerk_user_id', user.id) // 🔒 Fetch ONLY this user's schedule
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTasks(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => fetchTasks(true), []);

  // --- CRUD: CREATE ---
  const handleQuickAdd = () => {
    if (!quickAddText.trim()) return;
    setFormData(prev => ({ ...prev, title: quickAddText }));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.title?.trim() || !formData.start_time || !formData.end_time) {
      return Alert.alert('Error', 'Please fill all time and title fields.');
    }
    
    try {
      setIsSubmitting(true);
      const payload = {
        title: formData.title,
        start_time: formData.start_time,
        end_time: formData.end_time,
        category: formData.category,
        project_name: formData.project_name === 'No Project' ? null : formData.project_name,
        clerk_user_id: user.id, // 🔒 Tie to user
        is_completed: false,
        is_now: false
      };
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const tempId = `temp-${Date.now()}`;
      setTasks(prev => [...prev, { ...payload, id: tempId } as TimelineTask].sort((a, b) => a.start_time.localeCompare(b.start_time)));
      setModalVisible(false);
      setQuickAddText('');

      const { error } = await supabase.from('user_daily_schedule').insert([payload]);
      if (error) throw error;
      fetchTasks();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
      fetchTasks();
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CRUD: UPDATE (Toggle Completion & Now State) ---
  const toggleComplete = async (task: TimelineTask) => {
    if (!user) return;
    const newStatus = !task.is_completed;
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: newStatus, is_now: false } : t));
    
    try {
      await supabase.from('user_daily_schedule').update({ is_completed: newStatus, is_now: false }).eq('id', task.id).eq('clerk_user_id', user.id);
    } catch (error) {
      fetchTasks(); 
    }
  };

  const setAsNow = async (task: TimelineTask) => {
    if (!user) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    // Unset all other "now" tasks, set this one
    setTasks(prev => prev.map(t => ({ ...t, is_now: t.id === task.id })));
    
    try {
      await supabase.from('user_daily_schedule').update({ is_now: false }).eq('clerk_user_id', user.id).neq('id', task.id);
      await supabase.from('user_daily_schedule').update({ is_now: true, is_completed: false }).eq('id', task.id).eq('clerk_user_id', user.id);
    } catch (error) {
      fetchTasks(); 
    }
  };

  // --- CRUD: DELETE ---
  const handleDelete = (id: string) => {
    if (!user) return;
    Alert.alert('Remove Timeline Block', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTasks(prev => prev.filter(t => t.id !== id));
          await supabase.from('user_daily_schedule').delete().eq('id', id).eq('clerk_user_id', user.id);
        }
      }
    ]);
  };

  if (!isLoaded || (loading && !refreshing)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your schedule...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Top Floating Command Bar */}
      <View style={styles.topContainer}>
        <View style={styles.inputRow}>
          <TextInput 
            value={quickAddText}
            onChangeText={setQuickAddText}
            placeholder="Add something to ship today..."
            placeholderTextColor="#71717A"
            style={styles.textInput}
            onSubmitEditing={handleQuickAdd}
          />
          <TouchableOpacity onPress={handleQuickAdd} style={styles.addButton}>
            <Plus color="#FAFAFA" size={20} strokeWidth={3} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.assignLabel}>Assign to a project — optional</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectScroll}>
          {PROJECTS.map((proj, idx) => {
            const isSelected = formData.project_name === proj.name;
            return (
              <TouchableOpacity 
                key={idx} 
                onPress={() => setFormData(prev => ({ ...prev, project_name: proj.name }))}
                style={[styles.projectPill, isSelected && styles.projectPillActive]}
              >
                <Text style={styles.projectPillIcon}>{proj.icon}</Text>
                <Text style={[styles.projectPillText, isSelected && styles.projectPillTextActive]}>{proj.name}</Text>
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
        <View style={styles.scheduleHeaderRow}>
          <Text style={styles.scheduleTitle}>{user?.firstName?.toUpperCase()}'S SCHEDULE</Text>
          <View style={styles.generatedBadge}>
            <Text style={styles.generatedText}>LIVE SYNC</Text>
          </View>
        </View>

        {/* AI/Context Notes Card */}
        <View style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <Sparkles size={14} color="#8B5CF6" />
            <Text style={styles.notesTitle}>AI COACH NOTES</Text>
          </View>
          <Text style={styles.notesBody}>
            Deep work first while nothing can interrupt. Demo video and launch thread are batched back-to-back since they share context. Admin tasks land in the low-energy slot, and the day closes with a fix-it block so tomorrow starts clean.
          </Text>
        </View>

        {/* Timeline List */}
        {tasks.length === 0 ? (
           <View style={styles.emptyContainer}>
             <Calendar size={48} color="#27272A" />
             <Text style={styles.emptyTitle}>Your schedule is clear.</Text>
             <Text style={styles.emptySub}>Type in the command bar above to start planning your day.</Text>
           </View>
        ) : (
          <View style={styles.timelineContainer}>
            {tasks.map((task, index) => {
              const isLast = index === tasks.length - 1;
              const config = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.BUILD;
              
              let dotColor = '#27272A'; // Future (gray)
              if (task.is_completed) dotColor = '#10B981'; // Completed (emerald)
              if (task.is_now) dotColor = '#FAFAFA'; // Current (white glow)

              return (
                <View key={task.id} style={styles.timelineRow}>
                  
                  {/* Left Column: Time & Line */}
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, (task.is_now || task.is_completed) && { color: '#FAFAFA' }]}>
                      {formatTime(task.start_time).replace(' AM', '').replace(' PM', '')}
                    </Text>
                    {task.is_now && <Text style={styles.amPmText}>{formatTime(task.start_time).split(' ')[1]}</Text>}
                    
                    <View style={styles.lineContainer}>
                      <View style={[styles.timelineDot, { backgroundColor: dotColor }, task.is_now && styles.timelineDotNow]} />
                      {!isLast && <View style={[styles.timelineLine, task.is_completed && styles.timelineLineCompleted]} />}
                    </View>
                  </View>

                  {/* Right Column: Card */}
                  <TouchableOpacity 
                    onLongPress={() => handleDelete(task.id)}
                    onPress={() => task.is_completed ? toggleComplete(task) : setAsNow(task)}
                    activeOpacity={0.8}
                    style={[styles.taskCard, task.is_now && styles.taskCardNow, task.is_completed && styles.taskCardCompleted]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.categoryRow}>
                        <View style={[styles.categoryPill, { backgroundColor: config.bg }]}>
                          <Text style={[styles.categoryText, { color: config.color }]}>{task.category}</Text>
                        </View>
                        {task.is_now && (
                          <View style={styles.nowPill}>
                            <Text style={styles.nowText}>NOW</Text>
                          </View>
                        )}
                        {task.project_name && (
                          <View style={styles.projectMiniPill}>
                            <Briefcase size={10} color="#71717A" />
                            <Text style={styles.projectMiniText}>{task.project_name}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.timeRangeText, task.is_completed && styles.timeRangeCompleted]}>
                        {formatTime(task.start_time)}–{formatTime(task.end_time)}
                      </Text>
                    </View>

                    <View style={styles.cardBody}>
                      <Text 
                        style={[
                          styles.taskTitle, 
                          task.is_now && styles.taskTitleNow,
                          task.is_completed && styles.taskTitleCompleted
                        ]}
                      >
                        {task.title}
                      </Text>
                      
                      <TouchableOpacity onPress={() => toggleComplete(task)} style={styles.checkCircleBtn}>
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

      {/* --- Detailed Creation Modal --- */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDragIndicator} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Block</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color="#A1A1AA" size={20} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.inputLabel}>BLOCK TITLE</Text>
              <TextInput 
                value={formData.title} onChangeText={(t) => setFormData({...formData, title: t})}
                placeholder="What are you working on?" placeholderTextColor="#52525B"
                style={styles.modalInput}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.inputLabel}>START (HH:MM)</Text>
                  <TextInput value={formData.start_time} onChangeText={(t) => setFormData({...formData, start_time: t})} style={styles.modalInput} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>END (HH:MM)</Text>
                  <TextInput value={formData.end_time} onChangeText={(t) => setFormData({...formData, end_time: t})} style={styles.modalInput} />
                </View>
              </View>

              <Text style={styles.inputLabel}>WORK TYPE</Text>
              <View style={styles.categoryGrid}>
                {(['ADMIN', 'BUILD', 'MARKET', 'BREAK'] as TimelineCategory[]).map(cat => {
                  const isSel = formData.category === cat;
                  const color = CATEGORY_CONFIG[cat].color;
                  return (
                    <TouchableOpacity 
                      key={cat} onPress={() => setFormData({...formData, category: cat})}
                      style={[styles.modalCatBtn, isSel && { backgroundColor: `${color}15`, borderColor: color }]}
                    >
                      <Text style={[styles.modalCatText, { color: isSel ? color : '#71717A' }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity onPress={handleSave} disabled={isSubmitting} style={styles.saveBtn}>
              {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Commit to Schedule</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- Unified Bottom Navigation --- */}
      <View style={styles.bottomNav}>
         <Link href="/(tabs)/dashboard" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <HomeIcon size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Home</Text>
           </TouchableOpacity>
         </Link>
         <Link href="/(tabs)/kanban" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <LayoutGrid size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Kanban</Text>
           </TouchableOpacity>
         </Link>
         <Link href="/(tabs)/projects" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <ProjectorIcon size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Projects</Text>
           </TouchableOpacity>
         </Link>
         <Link href="/(tabs)/team" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <Users size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Teams</Text>
           </TouchableOpacity>
         </Link>
         
         {/* ACTIVE STATE */}
                <View style={styles.navActiveItem}>
                   <TimelineIcon size={20} color="#6366F1" />
                   <Text style={styles.navActiveText}>TimeLine</Text>
                </View>
                
                 <Link href="/(tabs)/settings" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <SettingsIcon size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Settings</Text>
           </TouchableOpacity>
         </Link>
      </View>
    </SafeAreaView>
  );
}

// --- Ultra-Premium Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600' },
  
  // Top Input Area
  topContainer: { padding: 16, paddingTop: Platform.OS === 'android' ? 40 : 16, backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#18181B' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', borderRadius: 16, paddingHorizontal: 12, height: 56, marginBottom: 16, borderWidth: 1, borderColor: '#27272A' },
  textInput: { flex: 1, color: '#FAFAFA', fontSize: 16, marginLeft: 8 },
  addButton: { width: 36, height: 36, backgroundColor: '#6366F1', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  assignLabel: { color: '#71717A', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  projectScroll: { paddingBottom: 4 },
  projectPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#27272A' },
  projectPillActive: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA' },
  projectPillIcon: { fontSize: 14, marginRight: 6 },
  projectPillText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  projectPillTextActive: { color: '#000000', fontWeight: '800' },
  
  // Scroll & Notes
  mainScroll: { padding: 20, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '900', marginTop: 16, marginBottom: 8 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

  scheduleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  scheduleTitle: { color: '#FAFAFA', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  generatedBadge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  generatedText: { color: '#10B981', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  notesCard: { backgroundColor: '#111113', borderRadius: 20, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: '#1F1F22' },
  notesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  notesTitle: { color: '#8B5CF6', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginLeft: 8 },
  notesBody: { color: '#A1A1AA', fontSize: 14, lineHeight: 22 },
  
  // Timeline Data
  timelineContainer: { paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', marginBottom: 16, minHeight: 80 },
  
  timeColumn: { width: 56, alignItems: 'flex-end', paddingRight: 16, position: 'relative' },
  timeText: { color: '#71717A', fontSize: 13, fontWeight: '700', marginTop: 16 },
  amPmText: { color: '#FAFAFA', fontSize: 10, fontWeight: '900', marginTop: 2 },
  
  lineContainer: { position: 'absolute', right: -6, top: 22, alignItems: 'center', bottom: -30 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#27272A', zIndex: 10 },
  timelineDotNow: { backgroundColor: '#FAFAFA', shadowColor: '#FAFAFA', shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#1F1F22', marginTop: -2 },
  timelineLineCompleted: { backgroundColor: '#10B981' },
  
  taskCard: { flex: 1, backgroundColor: '#09090B', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1F1F22', marginLeft: 16 },
  taskCardNow: { borderColor: '#52525B', backgroundColor: '#111113' },
  taskCardCompleted: { opacity: 0.6 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  categoryPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  categoryText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  nowPill: { backgroundColor: '#FAFAFA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  nowText: { color: '#000', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  projectMiniPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#27272A' },
  projectMiniText: { color: '#A1A1AA', fontSize: 9, fontWeight: '800', marginLeft: 4 },
  
  timeRangeText: { color: '#71717A', fontSize: 11, fontWeight: '700' },
  timeRangeCompleted: { textDecorationLine: 'line-through', color: '#52525B' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTitle: { color: '#D4D4D8', fontSize: 16, fontWeight: '700', flex: 1, lineHeight: 22 },
  taskTitleNow: { color: '#FAFAFA', fontWeight: '800' },
  taskTitleCompleted: { color: '#52525B', textDecorationLine: 'line-through' },
  checkCircleBtn: { padding: 4, marginLeft: 12 },
  
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#09090B', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: '#27272A' },
  modalDragIndicator: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FAFAFA', fontSize: 22, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#18181B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  inputLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  modalInput: { backgroundColor: '#111113', color: '#FAFAFA', padding: 18, borderRadius: 16, marginBottom: 20, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#27272A' },
  rowInputs: { flexDirection: 'row' },
  
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  modalCatBtn: { width: '48%', padding: 16, borderRadius: 14, backgroundColor: '#111113', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#27272A' },
  modalCatText: { fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  
  saveBtn: { backgroundColor: '#FAFAFA', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },
  
  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  navActiveText: { color: '#10B981', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});