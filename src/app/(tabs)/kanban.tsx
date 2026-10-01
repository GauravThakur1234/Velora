import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Alert, StatusBar, 
  StyleSheet, KeyboardAvoidingView, Platform, RefreshControl,
  LayoutAnimation, UIManager, Dimensions, Image
} from 'react-native';
import { useUser } from '@clerk/expo';
import { supabase } from '../lib/supabase';
import { 
  Plus, MoreHorizontal, Calendar, Clock, AlertCircle, 
  CheckCircle2, CircleDashed, LayoutGrid, LayoutList, 
  Search, ShieldCheck, X, Trash2, ArrowRight,
  Users, ProjectorIcon, HomeIcon, FolderKanban, SlidersHorizontal
} from 'lucide-react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.82;

// --- Types & Configurations ---
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type ViewMode = 'BOARD' | 'LIST';

type KanbanTask = {
  id: string;
  clerk_user_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project_name: string;
  due_date: string;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, icon: any, progress: number, next: TaskStatus | null }> = {
  TODO: { label: 'To Do', color: '#A1A1AA', icon: CircleDashed, progress: 5, next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'In Progress', color: '#8B5CF6', icon: Clock, progress: 45, next: 'REVIEW' },
  REVIEW: { label: 'In Review', color: '#F59E0B', icon: AlertCircle, progress: 80, next: 'DONE' },
  DONE: { label: 'Completed', color: '#10B981', icon: CheckCircle2, progress: 100, next: null },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, bg: string }> = {
  LOW: { label: 'Low', color: '#A1A1AA', bg: 'rgba(161, 161, 170, 0.15)' },
  MEDIUM: { label: 'Medium', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
  HIGH: { label: 'High', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  URGENT: { label: 'Urgent', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function PersonalKanban() {
  const { user, isLoaded } = useUser();

  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Advanced UI State
  const [viewMode, setViewMode] = useState<ViewMode>('BOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'URGENT' | 'TODAY'>('ALL');
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<KanbanTask>>({ 
    title: '', description: '', status: 'TODO', priority: 'MEDIUM', project_name: 'Core Platform', due_date: getTodayStr() 
  });

  useEffect(() => {
    if (isLoaded && user) {
      fetchTasks();
    }
  }, [isLoaded, user]);

  // --- CRUD: READ (Secured by Clerk ID) ---
  const fetchTasks = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from('user_kanban_tasks')
        .select('*')
        .eq('clerk_user_id', user.id) // 🔒 Fetch ONLY this user's data
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTasks(data || []);
    } catch (error: any) {
      Alert.alert('Connection Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- CRUD: CREATE & UPDATE ---
  const handleSave = async () => {
    if (!user) return;
    if (!formData.title?.trim()) return Alert.alert('Validation Error', 'Task title is required.');
    
    try {
      setIsSubmitting(true);
      const payload = { ...formData, clerk_user_id: user.id }; 
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      if (editingId) {
        setTasks(prev => prev.map(t => t.id === editingId ? { ...payload, id: editingId } as KanbanTask : t));
        await supabase.from('user_kanban_tasks').update(payload).eq('id', editingId).eq('clerk_user_id', user.id);
      } else {
        const tempId = `temp-${Date.now()}`;
        setTasks(prev => [{ ...payload, id: tempId } as KanbanTask, ...prev]);
        await supabase.from('user_kanban_tasks').insert([payload]);
        fetchTasks(); 
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
      fetchTasks();
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CRUD: DELETE ---
  const handleDelete = async (id: string) => {
    if (!user) return;
    Alert.alert('Delete Task', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTasks(prev => prev.filter(t => t.id !== id));
          setModalVisible(false);
          await supabase.from('user_kanban_tasks').delete().eq('id', id).eq('clerk_user_id', user.id);
        }
      }
    ]);
  };

  // --- Quick Status Move ---
  const quickMoveTask = async (task: KanbanTask) => {
    if (!user) return;
    const nextStatus = STATUS_CONFIG[task.status].next;
    if (!nextStatus) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    
    try {
      await supabase.from('user_kanban_tasks').update({ status: nextStatus }).eq('id', task.id).eq('clerk_user_id', user.id);
    } catch (error) {
      fetchTasks(); 
    }
  };

  const openModal = (task?: KanbanTask, defaultStatus: TaskStatus = 'TODO') => {
    if (task) {
      setFormData(task);
      setEditingId(task.id);
    } else {
      setFormData({ title: '', description: '', status: defaultStatus, priority: 'MEDIUM', project_name: 'Core Platform', due_date: getTodayStr() });
      setEditingId(null);
    }
    setModalVisible(true);
  };

  // --- Search and Filltering -----
  const filteredTasks = useMemo(() => {
    let result = tasks;
    
    // Search
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(lowerQ) || t.project_name?.toLowerCase().includes(lowerQ));
    }
    
    // Quick Filltering
    if (activeFilter === 'URGENT') result = result.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH');
    if (activeFilter === 'TODAY') result = result.filter(t => t.due_date === getTodayStr());
    
    return result;
  }, [tasks, searchQuery, activeFilter]);

  // --- Sub-Components ---
  const TaskCard = ({ task, isList = false }: { task: KanbanTask, isList?: boolean }) => {
    const prioConfig = PRIORITY_CONFIG[task.priority];
    const statConfig = STATUS_CONFIG[task.status];
    
    // Format Date: e.g., "Today", "Tomorrow", or "Oct 12"
    const isToday = task.due_date === getTodayStr();
    let dateLabel = isToday ? 'Today' : new Date(task.due_date).toLocaleString('default', { month: 'short', day: 'numeric' });

    return (
      <TouchableOpacity 
        onPress={() => openModal(task)}
        activeOpacity={0.7}
        style={[styles.card, { borderLeftColor: prioConfig.color }, isList && styles.cardList]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.projectText}>{task.project_name?.toUpperCase()}</Text>
          <View style={styles.cardHeaderRight}>
            {isList && (
              <View style={[styles.statusMiniBadge, { backgroundColor: `${statConfig.color}15` }]}>
                <statConfig.icon size={12} color={statConfig.color} />
                <Text style={[styles.statusMiniText, { color: statConfig.color }]}>{statConfig.label}</Text>
              </View>
            )}
            <TouchableOpacity><MoreHorizontal size={18} color="#71717A" /></TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.cardTitle}>{task.title}</Text>
        {task.description ? <Text style={styles.cardDesc} numberOfLines={2}>{task.description}</Text> : null}

        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <View style={[styles.priorityBadge, { backgroundColor: prioConfig.bg }]}>
              <Text style={[styles.priorityText, { color: prioConfig.color }]}>{prioConfig.label}</Text>
            </View>
            <View style={[styles.dateRow, isToday && { borderColor: '#8B5CF6' }]}>
              <Calendar size={12} color={isToday ? '#8B5CF6' : '#71717A'} />
              <Text style={[styles.dateText, isToday && { color: '#8B5CF6' }]}>{dateLabel}</Text>
            </View>
          </View>
          <Image source={{ uri: user?.imageUrl }} style={styles.cardAvatar} />
        </View>

        {isList && statConfig.next && (
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => quickMoveTask(task)}>
            <Text style={styles.quickActionText}>Move to {STATUS_CONFIG[statConfig.next].label}</Text>
            <ArrowRight size={14} color="#FAFAFA" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const BoardColumn = ({ status }: { status: TaskStatus }) => {
    const columnTasks = filteredTasks.filter(t => t.status === status);
    const config = STATUS_CONFIG[status];

    return (
      <View style={styles.columnContainer}>
        <View style={styles.columnHeader}>
          <View style={styles.columnHeaderLeft}>
            <View style={[styles.columnIconWrap, { backgroundColor: `${config.color}15` }]}>
              <config.icon size={16} color={config.color} />
            </View>
            <Text style={styles.columnTitle}>{config.label}</Text>
            <View style={styles.badgeCount}><Text style={styles.badgeText}>{columnTasks.length}</Text></View>
          </View>
          <TouchableOpacity onPress={() => openModal(undefined, status)} style={styles.addIconBtn}>
            <Plus size={20} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnScroll}>
          {columnTasks.map(task => <TaskCard key={task.id} task={task} />)}
          <TouchableOpacity onPress={() => openModal(undefined, status)} style={styles.addCardBtn}>
            <Plus size={16} color="#71717A" />
            <Text style={styles.addCardText}>New Issue</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  if (!isLoaded || (loading && !refreshing && tasks.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Initializing Workspace...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* --- Premium Header --- */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfoRow}>
            <Text style={styles.headerTitle}>Kanban Board</Text>
            <View style={styles.securedBadge}>
              <ShieldCheck size={12} color="#10B981" />
              <Text style={styles.securedText}>Private to {user?.firstName}</Text>
            </View>
          </View>
          <Image source={{ uri: user?.imageUrl }} style={styles.userAvatarTop} />
        </View>

        {/* Controls Row */}
        <View style={styles.controlsRow}>
          <View style={styles.searchBar}>
            <Search size={18} color="#71717A" />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search issues..."
              placeholderTextColor="#71717A"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}><X size={16} color="#71717A" /></TouchableOpacity>
            )}
          </View>
          <View style={styles.viewToggles}>
            <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setViewMode('BOARD'); }} style={[styles.toggleBtn, viewMode === 'BOARD' && styles.toggleActive]}>
              <LayoutGrid size={18} color={viewMode === 'BOARD' ? '#FAFAFA' : '#71717A'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setViewMode('LIST'); }} style={[styles.toggleBtn, viewMode === 'LIST' && styles.toggleActive]}>
              <LayoutList size={18} color={viewMode === 'LIST' ? '#FAFAFA' : '#71717A'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Filters */}
        <View style={styles.filtersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity onPress={() => setActiveFilter('ALL')} style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, activeFilter === 'ALL' && styles.filterChipTextActive]}>All Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveFilter('URGENT')} style={[styles.filterChip, activeFilter === 'URGENT' && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, activeFilter === 'URGENT' && styles.filterChipTextActive]}>🔥 High Priority</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveFilter('TODAY')} style={[styles.filterChip, activeFilter === 'TODAY' && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, activeFilter === 'TODAY' && styles.filterChipTextActive]}>📅 Due Today</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* --- Main Board/List Area --- */}
      {filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}><LayoutGrid size={40} color="#3F3F46" /></View>
          <Text style={styles.emptyTitle}>No matching issues</Text>
          <Text style={styles.emptySub}>Adjust your filters or create a new task.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => openModal()}>
            <Plus size={20} color="#000" />
            <Text style={styles.emptyBtnText}>New Issue</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'BOARD' ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          snapToInterval={COLUMN_WIDTH + 16}
          decelerationRate="fast"
          contentContainerStyle={styles.boardScroll}
        >
          {STATUS_ORDER.map(status => <BoardColumn key={status} status={status} />)}
        </ScrollView>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchTasks(true)} tintColor="#FAFAFA" />}
        >
          {STATUS_ORDER.map(status => {
            const groupTasks = filteredTasks.filter(t => t.status === status);
            if (groupTasks.length === 0) return null;
            const config = STATUS_CONFIG[status];
            
            return (
              <View key={status} style={styles.listGroup}>
                <View style={styles.listGroupHeader}>
                  <config.icon size={20} color={config.color} />
                  <Text style={[styles.listGroupTitle, { color: config.color }]}>{config.label}</Text>
                  <View style={styles.listGroupCount}><Text style={styles.listGroupCountText}>{groupTasks.length}</Text></View>
                </View>
                {groupTasks.map(task => <TaskCard key={task.id} task={task} isList={true} />)}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* --- CRUD Form Modal --- */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDragIndicator} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Issue' : 'Create Issue'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color="#A1A1AA" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
              
              <Text style={styles.inputLabel}>ISSUE TITLE</Text>
              <TextInput 
                value={formData.title} onChangeText={(t) => setFormData({...formData, title: t})}
                placeholder="What needs to be done?" placeholderTextColor="#52525B"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <TextInput 
                value={formData.description} onChangeText={(t) => setFormData({...formData, description: t})}
                placeholder="Add context, acceptance criteria..." placeholderTextColor="#52525B"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.inputLabel}>PROJECT</Text>
                  <TextInput 
                    value={formData.project_name} onChangeText={(t) => setFormData({...formData, project_name: t})}
                    placeholder="e.g. Core App" placeholderTextColor="#52525B"
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>DUE DATE</Text>
                  <TextInput 
                    value={formData.due_date} onChangeText={(t) => setFormData({...formData, due_date: t})}
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>STATUS</Text>
              <View style={styles.statusChanger}>
                {STATUS_ORDER.map(status => {
                  const isSel = formData.status === status;
                  const col = STATUS_CONFIG[status].color;
                  return (
                    <TouchableOpacity 
                      key={status} onPress={() => setFormData({...formData, status})}
                      style={[styles.statusOption, isSel && { backgroundColor: `${col}15`, borderColor: col }]}
                    >
                      <Text style={[styles.statusOptionText, isSel && { color: col, fontWeight: '800' }]}>{STATUS_CONFIG[status].label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>PRIORITY</Text>
              <View style={styles.priorityGrid}>
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TaskPriority[]).map((prio) => {
                  const isSel = formData.priority === prio;
                  const config = PRIORITY_CONFIG[prio];
                  return (
                    <TouchableOpacity 
                      key={prio} onPress={() => setFormData({...formData, priority: prio})}
                      style={[styles.prioBtn, isSel && { backgroundColor: config.bg, borderColor: config.color }]}
                    >
                      <Text style={[styles.prioBtnText, { color: isSel ? config.color : '#71717A' }]}>{config.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.actionRow}>
              {editingId && (
                <TouchableOpacity onPress={() => handleDelete(editingId)} style={styles.deleteBtn}>
                  <Trash2 color="#EF4444" size={20} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSave} disabled={isSubmitting} style={[styles.saveBtn, editingId ? { width: '80%' } : { width: '100%' }]}>
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{editingId ? 'Update Issue' : 'Create Issue'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Global FAB */}
      {viewMode === 'LIST' && (
        <TouchableOpacity style={styles.fabMain} onPress={() => openModal()} activeOpacity={0.8}>
          <Plus size={28} color="#FAFAFA" strokeWidth={3} />
        </TouchableOpacity>
      )}

      {/* Unified Bottom Navigation */}
      <View style={styles.bottomNav}>
         <Link href="/(tabs)/dashboard" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <HomeIcon size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Home</Text>
           </TouchableOpacity>
         </Link>

         {/* ACTIVE STATE */}
         <View style={styles.navActiveItem}>
            <LayoutGrid size={20} color="#8B5CF6" />
            <Text style={styles.navActiveText}>Kanban</Text>
         </View>

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
         
         <Link href="/(tabs)/timeline" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <Calendar size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Timeline</Text>
           </TouchableOpacity>
         </Link>
      </View>
    </SafeAreaView>
  );
}

// --- Raw Stylesheet for Premium, Bug-Free Layout ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600' },
  
  // Header
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#18181B' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  userInfoRow: { flex: 1 },
  headerTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  securedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  securedText: { color: '#10B981', fontSize: 10, fontWeight: '800', marginLeft: 4 },
  userAvatarTop: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#27272A' },
  
  // Controls (Search & View Toggles)
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#27272A', marginRight: 12 },
  searchInput: { flex: 1, color: '#FAFAFA', fontSize: 14, marginLeft: 8, fontWeight: '500' },
  viewToggles: { flexDirection: 'row', backgroundColor: '#111113', padding: 3, borderRadius: 10, borderWidth: 1, borderColor: '#27272A' },
  toggleBtn: { padding: 8, borderRadius: 8 },
  toggleActive: { backgroundColor: '#27272A' },

  // Filters
  filtersRow: { flexDirection: 'row' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A', marginRight: 8 },
  filterChipActive: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA' },
  filterChipText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#000000', fontWeight: '800' },

  // Empty State
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
  emptyBtnText: { color: '#09090B', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  
  // Board View (Horizontal)
  boardScroll: { paddingHorizontal: 16, paddingVertical: 16 },
  columnContainer: { width: COLUMN_WIDTH, backgroundColor: '#09090B', borderRadius: 20, padding: 12, marginRight: 16, borderWidth: 1, borderColor: '#1F1F22' },
  columnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  columnHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  columnIconWrap: { padding: 6, borderRadius: 8 },
  columnTitle: { color: '#FAFAFA', fontSize: 14, fontWeight: '800', marginLeft: 8, marginRight: 8, letterSpacing: 0.5 },
  badgeCount: { backgroundColor: '#27272A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#FAFAFA', fontSize: 10, fontWeight: '900' },
  addIconBtn: { padding: 4 },
  columnScroll: { paddingBottom: 40 },
  
  // List View (Vertical)
  listScroll: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 20 },
  listGroup: { marginBottom: 36 },
  listGroupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  listGroupTitle: { fontSize: 16, fontWeight: '900', marginLeft: 8, letterSpacing: 1 },
  listGroupCount: { backgroundColor: '#18181B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8, borderWidth: 1, borderColor: '#27272A' },
  listGroupCountText: { color: '#A1A1AA', fontSize: 11, fontWeight: '900' },
  
  // Cards
  card: { backgroundColor: '#111113', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1F1F22', borderLeftWidth: 4 },
  cardList: { backgroundColor: '#09090B' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  projectText: { color: '#71717A', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  statusMiniBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 10 },
  statusMiniText: { fontSize: 9, fontWeight: '800', marginLeft: 4 },
  
  cardTitle: { color: '#FAFAFA', fontSize: 15, fontWeight: '800', lineHeight: 22, marginBottom: 6 },
  cardDesc: { color: '#A1A1AA', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { flexDirection: 'row', alignItems: 'center' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10 },
  priorityText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  dateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#27272A' },
  dateText: { color: '#A1A1AA', fontSize: 11, fontWeight: '700', marginLeft: 6 },
  cardAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#27272A' },
  
  quickActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#18181B', marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#27272A' },
  quickActionText: { color: '#FAFAFA', fontSize: 12, fontWeight: '800' },
  addCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#27272A', marginTop: 4, backgroundColor: '#09090B' },
  addCardText: { color: '#71717A', fontSize: 13, fontWeight: '800', marginLeft: 8 },
  
  // Modal & Form
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#09090B', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', borderWidth: 1, borderColor: '#27272A' },
  modalDragIndicator: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FAFAFA', fontSize: 22, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#18181B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  statusChanger: { flexDirection: 'row', backgroundColor: '#111113', borderRadius: 14, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: '#27272A' },
  statusOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  statusOptionText: { color: '#71717A', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  
  inputLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#111113', color: '#FAFAFA', padding: 16, borderRadius: 14, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: '#27272A', marginBottom: 20 },
  textArea: { height: 100, paddingTop: 16 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  
  priorityGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  prioBtn: { width: '23%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A' },
  prioBtnText: { fontWeight: '900', fontSize: 10, letterSpacing: 0.5 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#27272A' },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, width: '18%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  saveBtn: { backgroundColor: '#8B5CF6', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FAFAFA', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  
  fabMain: { position: 'absolute', bottom: 100, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(139, 92, 246, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' },
  navActiveText: { color: '#8B5CF6', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});