import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Alert, StatusBar, 
  StyleSheet, KeyboardAvoidingView, Platform, RefreshControl,
  LayoutAnimation, UIManager, Image
} from 'react-native';
import { useUser, useAuth } from '@clerk/expo';
import { supabase } from '../lib/supabase';
import { 
  Plus, Search, Calendar, FolderKanban, 
  X, Trash2, Rocket, LayoutGrid, Users, ShieldCheck,
  MoreVertical, Target, ChevronRight, HomeIcon
} from 'lucide-react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Types & Configurations ---
type ProjectStatus = 'Planning' | 'Active' | 'Paused' | 'Completed';
type ProjectCategory = 'Web App' | 'Mobile App' | 'Marketing' | 'Internal';

type UserProject = {
  id: string;
  clerk_user_id: string;
  title: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  target_date: string;
  progress: number;
};

const STATUS_CONFIG: Record<ProjectStatus, { color: string, bg: string }> = {
  Planning: { color: '#A1A1AA', bg: 'rgba(161, 161, 170, 0.15)' },
  Active: { color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)' },
  Paused: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  Completed: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
};

const CATEGORY_ICONS: Record<ProjectCategory, any> = {
  'Web App': GlobeIcon,
  'Mobile App': SmartphoneIcon,
  'Marketing': MegaphoneIcon,
  'Internal': BriefcaseIcon,
};

// Simple SVG Icon mockups for Categories
function GlobeIcon(props: any) { return <LayoutGrid {...props} />; }
function SmartphoneIcon(props: any) { return <Rocket {...props} />; }
function MegaphoneIcon(props: any) { return <Target {...props} />; }
function BriefcaseIcon(props: any) { return <FolderKanban {...props} />; }

const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function ProjectsPortfolio() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();

  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'All'>('All');
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<UserProject>>({ 
    title: '', description: '', status: 'Active', category: 'Web App', target_date: getTodayStr(), progress: 0 
  });

  useEffect(() => {
    if (isLoaded && user) {
      fetchProjects();
    }
  }, [isLoaded, user]);

  // --- CRUD: READ (Secured by Clerk ID) ---
  const fetchProjects = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from('user_projects')
        .select('*')
        .eq('clerk_user_id', user.id) // 🔒 Fetch ONLY this user's projects
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setProjects(data || []);
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
    if (!formData.title?.trim()) return Alert.alert('Validation Error', 'Project title is required.');
    
    try {
      setIsSubmitting(true);
      const payload = { ...formData, clerk_user_id: user.id };
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      if (editingId) {
        setProjects(prev => prev.map(p => p.id === editingId ? { ...payload, id: editingId } as UserProject : p));
        await supabase.from('user_projects').update(payload).eq('id', editingId).eq('clerk_user_id', user.id);
      } else {
        const tempId = `temp-${Date.now()}`;
        setProjects(prev => [{ ...payload, id: tempId } as UserProject, ...prev]);
        await supabase.from('user_projects').insert([payload]);
        fetchProjects(); 
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
      fetchProjects();
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CRUD: DELETE ---
  const handleDelete = async (id: string) => {
    if (!user) return;
    Alert.alert('Delete Project', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setProjects(prev => prev.filter(p => p.id !== id));
          setModalVisible(false);
          await supabase.from('user_projects').delete().eq('id', id).eq('clerk_user_id', user.id);
        }
      }
    ]);
  };

  const openModal = (project?: UserProject) => {
    if (project) {
      setFormData(project);
      setEditingId(project.id);
    } else {
      setFormData({ title: '', description: '', status: 'Active', category: 'Web App', target_date: getTodayStr(), progress: 0 });
      setEditingId(null);
    }
    setModalVisible(true);
  };

  // --- Calculations & Filters ---
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter(p => p.status === 'Active').length,
    completed: projects.filter(p => p.status === 'Completed').length,
  }), [projects]);

  if (!isLoaded || (loading && !refreshing && projects.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your portfolio...</Text>
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
            <Image source={{ uri: user?.imageUrl }} style={styles.userAvatar} />
            <View>
              <Text style={styles.greetingText}>Workspace of</Text>
              <Text style={styles.userName}>{user?.firstName || 'User'}'s Portfolio</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => signOut()} style={styles.signOutBtn}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.signOutText}>Secured</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active Projects</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Projects</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={20} color="#71717A" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search projects by name..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}><X size={16} color="#71717A" /></TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- Filter Pills --- */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'Planning', 'Active', 'Paused', 'Completed'].map((status) => {
            const isActive = filterStatus === status;
            return (
              <TouchableOpacity 
                key={status} 
                style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFilterStatus(status as any); }}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{status}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* --- Projects List --- */}
      {filteredProjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}><FolderKanban size={40} color="#3F3F46" /></View>
          <Text style={styles.emptyTitle}>No projects found</Text>
          <Text style={styles.emptySub}>This is your private project directory. Click the + button to create a new project.</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchProjects(true)} tintColor="#FAFAFA" />}
        >
          {filteredProjects.map((project) => {
            const statConfig = STATUS_CONFIG[project.status];
            const CatIcon = CATEGORY_ICONS[project.category] || GlobeIcon;
            
            return (
              <TouchableOpacity 
                key={project.id} 
                activeOpacity={0.8}
                onPress={() => openModal(project)}
                style={styles.projectCard}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.catBadge, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <CatIcon size={12} color="#A1A1AA" />
                    <Text style={styles.catText}>{project.category}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statConfig.bg }]}>
                    <Text style={[styles.statusText, { color: statConfig.color }]}>{project.status}</Text>
                  </View>
                </View>

                <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
                {project.description ? <Text style={styles.projectDesc} numberOfLines={2}>{project.description}</Text> : null}
                
                <View style={styles.progressSection}>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressPercent}>{project.progress}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${project.progress}%`, backgroundColor: statConfig.color }]} />
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.dateRow}>
                    <Calendar size={14} color="#71717A" />
                    <Text style={styles.dateText}>Due: {project.target_date}</Text>
                  </View>
                  <ChevronRight size={18} color="#71717A" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* --- CRUD Form Modal --- */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDrag} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Project' : 'New Project'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color="#A1A1AA" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} bounces={false}>
              
              <Text style={styles.inputLabel}>PROJECT NAME</Text>
              <TextInput 
                value={formData.title} onChangeText={(t) => setFormData({...formData, title: t})}
                placeholder="e.g., Marketing Website Redesign" placeholderTextColor="#52525B"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <TextInput 
                value={formData.description} onChangeText={(t) => setFormData({...formData, description: t})}
                placeholder="High-level goals and scope..." placeholderTextColor="#52525B"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.inputLabel}>CATEGORY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollInput}>
                    {(['Web App', 'Mobile App', 'Marketing', 'Internal'] as ProjectCategory[]).map(cat => (
                      <TouchableOpacity 
                        key={cat} onPress={() => setFormData({...formData, category: cat})}
                        style={[styles.chip, formData.category === cat && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, formData.category === cat && styles.chipTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <Text style={styles.inputLabel}>TARGET DATE (YYYY-MM-DD)</Text>
              <TextInput 
                value={formData.target_date} onChangeText={(t) => setFormData({...formData, target_date: t})}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>STATUS</Text>
              <View style={styles.statusGrid}>
                {(['Planning', 'Active', 'Paused', 'Completed'] as ProjectStatus[]).map((status) => {
                  const isSel = formData.status === status;
                  const color = STATUS_CONFIG[status].color;
                  return (
                    <TouchableOpacity 
                      key={status} onPress={() => setFormData({...formData, status})}
                      style={[styles.statusOptBtn, isSel && { backgroundColor: `${color}15`, borderColor: color }]}
                    >
                      <View style={[styles.statusOptDot, { backgroundColor: isSel ? color : '#3F3F46' }]} />
                      <Text style={[styles.statusOptText, { color: isSel ? color : '#71717A' }]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>OVERALL PROGRESS ({formData.progress}%)</Text>
              <View style={styles.progressBtns}>
                {[0, 25, 50, 75, 100].map(val => (
                  <TouchableOpacity 
                    key={val} onPress={() => setFormData({...formData, progress: val})}
                    style={[styles.progBtn, formData.progress === val && styles.progBtnActive]}
                  >
                    <Text style={[styles.progBtnText, formData.progress === val && styles.progBtnTextActive]}>{val}%</Text>
                  </TouchableOpacity>
                ))}
              </View>

            </ScrollView>

            <View style={styles.actionRow}>
              {editingId && (
                <TouchableOpacity onPress={() => handleDelete(editingId)} style={styles.deleteBtn}>
                  <Trash2 color="#EF4444" size={20} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSave} disabled={isSubmitting} style={[styles.saveBtn, editingId ? { width: '78%' } : { width: '100%' }]}>
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{editingId ? 'Update Project' : 'Create Project'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fabMain} onPress={() => openModal()} activeOpacity={0.8}>
        <Plus size={26} color="#09090B" strokeWidth={3} />
      </TouchableOpacity>

      {/* Unified Bottom Navigation */}
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

         {/* ACTIVE STATE */}
         <View style={styles.navActiveItem}>
            <FolderKanban size={20} color="#6366F1" />
            <Text style={styles.navActiveText}>Projects</Text>
         </View>
         
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

// --- Ultra-Premium Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600' },
  
  // Header
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#000000' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#27272A', marginRight: 12 },
  greetingText: { color: '#71717A', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  userName: { color: '#FAFAFA', fontSize: 20, fontWeight: '900' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  signOutText: { color: '#10B981', fontSize: 11, fontWeight: '800', marginLeft: 6 },
  
  // Stats Row
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111113', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 24, marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  statBox: { alignItems: 'center' },
  statValue: { color: '#FAFAFA', fontSize: 24, fontWeight: '900' },
  statLabel: { color: '#71717A', fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 30, backgroundColor: '#27272A' },

  // Search Bar
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', borderRadius: 16, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#27272A' },
  searchInput: { flex: 1, color: '#FAFAFA', fontSize: 15, marginLeft: 10, fontWeight: '500' },
  
  // Filters
  filterWrapper: { borderBottomWidth: 1, borderBottomColor: '#18181B', paddingBottom: 16 },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A' },
  filterBtnActive: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA' },
  filterText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: '#000000', fontWeight: '800' },
  
  // List Area
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 60 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  // Project Card
  projectCard: { backgroundColor: '#09090B', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1F1F22' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  catBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#27272A' },
  catText: { color: '#A1A1AA', fontSize: 10, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  
  projectTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  projectDesc: { color: '#A1A1AA', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  
  progressSection: { marginBottom: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { color: '#71717A', fontSize: 12, fontWeight: '700' },
  progressPercent: { color: '#FAFAFA', fontSize: 14, fontWeight: '900' },
  progressTrack: { height: 6, backgroundColor: '#18181B', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#18181B' },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { color: '#71717A', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  
  // Modal 
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#09090B', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '92%', borderWidth: 1, borderColor: '#27272A' },
  modalDrag: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#18181B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  // Forms
  inputLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4, marginTop: 8 },
  input: { backgroundColor: '#111113', color: '#FAFAFA', padding: 16, borderRadius: 16, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#27272A', marginBottom: 16 },
  textArea: { height: 100, paddingTop: 16 },
  rowInputs: { flexDirection: 'row', marginBottom: 16 },
  
  scrollInput: { backgroundColor: '#111113', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: '#27272A' },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginRight: 8, backgroundColor: '#18181B' },
  chipActive: { backgroundColor: '#FAFAFA' },
  chipText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#000000', fontWeight: '800' },
  
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  statusOptBtn: { width: '48%', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A', marginBottom: 12 },
  statusOptDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  statusOptText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  
  progressBtns: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  progBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A', borderRadius: 10, marginHorizontal: 4, alignItems: 'center' },
  progBtnActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  progBtnText: { color: '#A1A1AA', fontSize: 12, fontWeight: '800' },
  progBtnTextActive: { color: '#FAFAFA' },
  
  // Actions
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#27272A', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, width: '20%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  saveBtn: { backgroundColor: '#FAFAFA', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#000000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  
  fabMain: { position: 'absolute', bottom: 100, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', shadowColor: '#FAFAFA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  // Bottom Nav (Matching the rest of the app)
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  navActiveText: { color: '#6366F1', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});