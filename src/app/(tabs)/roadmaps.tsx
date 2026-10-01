import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Alert, StatusBar, 
  StyleSheet, KeyboardAvoidingView, Platform, RefreshControl,
  LayoutAnimation, UIManager
} from 'react-native';
import { useUser } from '@clerk/expo';
import { supabase } from '../../app/lib/supabase'; // Adjust path as needed
import { 
  Plus, Search, Calendar, X, Trash2, LayoutGrid, 
  Users, FolderKanban, Crown, Map, TrendingUp, GitMerge,
  HomeIcon, ChevronRight
} from 'lucide-react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ScenarioType = 'Best Case' | 'Likely' | 'Worst Case';
type RoadmapStatus = 'Planning' | 'Active' | 'Completed';

type UserRoadmap = {
  id: string;
  clerk_user_id: string;
  title: string;
  description: string;
  scenario_type: ScenarioType;
  start_date: string;
  end_date: string;
  progress: number;
  status: RoadmapStatus;
};

const SCENARIO_CONFIG: Record<ScenarioType, { color: string, bg: string }> = {
  'Best Case': { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  'Likely': { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  'Worst Case': { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function AdvancedRoadmaps() {
  const { user, isLoaded } = useUser();
  const [roadmaps, setRoadmaps] = useState<UserRoadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScenario, setFilterScenario] = useState<ScenarioType | 'All'>('All');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<UserRoadmap>>({ 
    title: '', description: '', scenario_type: 'Likely', status: 'Planning', 
    start_date: getTodayStr(), end_date: getTodayStr(), progress: 0 
  });

  useEffect(() => {
    if (isLoaded && user) fetchRoadmaps();
  }, [isLoaded, user]);

  const fetchRoadmaps = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const { data, error } = await supabase
        .from('user_roadmaps')
        .select('*')
        .eq('clerk_user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRoadmaps(data || []);
    } catch (error: any) {
      Alert.alert('Error fetching roadmaps', error.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.title?.trim() || !form.start_date || !form.end_date) {
      return Alert.alert('Validation', 'Title and dates are required.');
    }
    
    try {
      setIsSubmitting(true);
      const payload = { ...form, clerk_user_id: user.id };
      
      if (editingId) {
        const { error } = await supabase.from('user_roadmaps').update(payload).eq('id', editingId).eq('clerk_user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roadmaps').insert([payload]);
        if (error) throw error;
      }
      setModalVisible(false);
      fetchRoadmaps(); 
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    Alert.alert('Delete Roadmap', 'Remove this macro-level plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setRoadmaps(prev => prev.filter(r => r.id !== id));
          setModalVisible(false);
          await supabase.from('user_roadmaps').delete().eq('id', id).eq('clerk_user_id', user.id);
        }
      }
    ]);
  };

  const openModal = (item?: UserRoadmap) => {
    if (item) {
      setForm(item);
      setEditingId(item.id);
    } else {
      setForm({ title: '', description: '', scenario_type: 'Likely', status: 'Planning', start_date: getTodayStr(), end_date: getTodayStr(), progress: 0 });
      setEditingId(null);
    }
    setModalVisible(true);
  };

  const filteredRoadmaps = useMemo(() => {
    return roadmaps.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesScenario = filterScenario === 'All' || r.scenario_type === filterScenario;
      return matchesSearch && matchesScenario;
    });
  }, [roadmaps, searchQuery, filterScenario]);

  if (!isLoaded || (loading && !refreshing && roadmaps.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Loading Advanced Roadmaps...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.premiumBadge}>
              <Crown size={12} color="#F59E0B" />
              <Text style={styles.premiumText}>ENTERPRISE TIER</Text>
            </View>
            <Text style={styles.headerTitle}>Advanced Roadmaps</Text>
            <Text style={styles.headerSub}>Macro-level planning & forecasting</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Search size={20} color="#71717A" />
          <TextInput style={styles.searchInput} placeholder="Search plans..." placeholderTextColor="#71717A" value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><X size={16} color="#71717A" /></TouchableOpacity>}
        </View>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'Best Case', 'Likely', 'Worst Case'].map((scenario) => {
            const isActive = filterScenario === scenario;
            return (
              <TouchableOpacity key={scenario} style={[styles.filterBtn, isActive && styles.filterBtnActive]} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFilterScenario(scenario as any); }}>
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{scenario}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Roadmap List */}
      {filteredRoadmaps.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}><Map size={40} color="#3F3F46" /></View>
          <Text style={styles.emptyTitle}>No roadmaps found</Text>
          <Text style={styles.emptySub}>Create a macro-level plan to forecast releases and track cross-project dependencies.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchRoadmaps(true)} tintColor="#FAFAFA" />}>
          {filteredRoadmaps.map((item) => {
            const scenarioConfig = SCENARIO_CONFIG[item.scenario_type];
            
            return (
              <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => openModal(item)} style={styles.roadmapCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.scenarioBadge, { backgroundColor: scenarioConfig.bg, borderColor: scenarioConfig.color }]}>
                    <TrendingUp size={12} color={scenarioConfig.color} />
                    <Text style={[styles.scenarioText, { color: scenarioConfig.color }]}>{item.scenario_type}</Text>
                  </View>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>

                <Text style={styles.roadmapTitle} numberOfLines={1}>{item.title}</Text>
                {item.description ? <Text style={styles.roadmapDesc} numberOfLines={2}>{item.description}</Text> : null}
                
                {/* Timeline Visualization */}
                <View style={styles.timelineSection}>
                  <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>Start: {item.start_date}</Text>
                    <Text style={styles.dateLabel}>Target: {item.end_date}</Text>
                  </View>
                  <View style={styles.timelineTrack}>
                    <View style={[styles.timelineBar, { width: `${item.progress}%`, backgroundColor: '#F59E0B' }]} />
                  </View>
                  <Text style={styles.progressPercent}>{item.progress}% Overall Capacity</Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <GitMerge size={14} color="#71717A" />
                    <Text style={styles.dependencyText}>Cross-Project Tracking</Text>
                  </View>
                  <ChevronRight size={16} color="#F59E0B" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Roadmap Form Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDrag} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Roadmap' : 'New Roadmap'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}><X color="#A1A1AA" size={20} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} bounces={false}>
              <Text style={styles.inputLabel}>ROADMAP TITLE</Text>
              <TextInput value={form.title} onChangeText={t => setForm({...form, title: t})} placeholder="e.g., Q4 Enterprise Release" placeholderTextColor="#52525B" style={styles.input} />

              <Text style={styles.inputLabel}>SCENARIO FORECAST</Text>
              <View style={styles.rowInputs}>
                {(['Best Case', 'Likely', 'Worst Case'] as ScenarioType[]).map(scen => {
                  const isSel = form.scenario_type === scen;
                  const color = SCENARIO_CONFIG[scen].color;
                  return (
                    <TouchableOpacity key={scen} onPress={() => setForm({...form, scenario_type: scen})} style={[styles.typeBtn, isSel && { backgroundColor: `${color}15`, borderColor: color }]}>
                      <Text style={[styles.typeBtnText, { color: isSel ? color : '#71717A' }]}>{scen}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>START DATE</Text>
                  <TextInput value={form.start_date} onChangeText={t => setForm({...form, start_date: t})} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>TARGET DATE</Text>
                  <TextInput value={form.end_date} onChangeText={t => setForm({...form, end_date: t})} style={styles.input} />
                </View>
              </View>

              <Text style={styles.inputLabel}>DESCRIPTION / DEPENDENCIES</Text>
              <TextInput value={form.description} onChangeText={t => setForm({...form, description: t})} placeholder="Track resources and risks..." placeholderTextColor="#52525B" style={[styles.input, styles.textArea]} multiline textAlignVertical="top" />

              <Text style={styles.inputLabel}>MACRO PROGRESS ({form.progress}%)</Text>
              <View style={styles.progressBtns}>
                {[0, 25, 50, 75, 100].map(val => (
                  <TouchableOpacity key={val} onPress={() => setForm({...form, progress: val})} style={[styles.progBtn, form.progress === val && styles.progBtnActive]}>
                    <Text style={[styles.progBtnText, form.progress === val && styles.progBtnTextActive]}>{val}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.actionRow}>
              {editingId && <TouchableOpacity onPress={() => handleDelete(editingId)} style={styles.deleteBtn}><Trash2 color="#EF4444" size={20} /></TouchableOpacity>}
              <TouchableOpacity onPress={handleSave} disabled={isSubmitting} style={[styles.saveBtn, editingId ? { width: '78%' } : { width: '100%' }]}>
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{editingId ? 'Update Forecast' : 'Create Roadmap'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity style={styles.fabMain} onPress={() => openModal()} activeOpacity={0.8}>
        <Plus size={26} color="#000" strokeWidth={3} />
      </TouchableOpacity>

      {/* Bottom Navigation incorporating the new tab */}
      <View style={styles.bottomNav}>
         <Link href="/(tabs)/dashboard" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <HomeIcon size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Home</Text>
           </TouchableOpacity>
         </Link>
         <Link href="/(tabs)/projects" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <FolderKanban size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Projects</Text>
           </TouchableOpacity>
         </Link>
         
         <View style={styles.navActiveItem}>
            <Map size={20} color="#F59E0B" />
            <Text style={styles.navActiveText}>Roadmap</Text>
         </View>
         
         <Link href="/(tabs)/team" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <Users size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Teams</Text>
           </TouchableOpacity>
         </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600' },
  
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)' },
  premiumText: { color: '#F59E0B', fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 1 },
  headerTitle: { color: '#FAFAFA', fontSize: 26, fontWeight: '900' },
  headerSub: { color: '#A1A1AA', fontSize: 14, marginTop: 4 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', borderRadius: 16, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#27272A' },
  searchInput: { flex: 1, color: '#FAFAFA', fontSize: 15, marginLeft: 10, fontWeight: '500' },
  
  filterWrapper: { borderBottomWidth: 1, borderBottomColor: '#18181B', paddingBottom: 16 },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A' },
  filterBtnActive: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA' },
  filterText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: '#000000', fontWeight: '800' },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 60 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  roadmapCard: { backgroundColor: '#09090B', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1F1F22' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  scenarioBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  scenarioText: { fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 0.5 },
  statusText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700' },
  
  roadmapTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  roadmapDesc: { color: '#A1A1AA', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  
  timelineSection: { backgroundColor: '#111113', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dateLabel: { color: '#71717A', fontSize: 11, fontWeight: '700' },
  timelineTrack: { height: 8, backgroundColor: '#18181B', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  timelineBar: { height: '100%', borderRadius: 4 },
  progressPercent: { color: '#FAFAFA', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#18181B' },
  dependencyText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', marginLeft: 6 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#09090B', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', borderWidth: 1, borderColor: '#27272A' },
  modalDrag: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#18181B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  inputLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4, marginTop: 8 },
  input: { backgroundColor: '#111113', color: '#FAFAFA', padding: 16, borderRadius: 16, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#27272A', marginBottom: 16 },
  textArea: { height: 100, paddingTop: 16 },
  rowInputs: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#111113', borderRadius: 12, borderWidth: 1, borderColor: '#27272A' },
  typeBtnText: { fontSize: 12, fontWeight: '800' },
  
  progressBtns: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  progBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A', borderRadius: 10, marginHorizontal: 4, alignItems: 'center' },
  progBtnActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  progBtnText: { color: '#A1A1AA', fontSize: 12, fontWeight: '800' },
  progBtnTextActive: { color: '#000000' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#27272A', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, width: '20%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  saveBtn: { backgroundColor: '#F59E0B', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#000000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  
  fabMain: { position: 'absolute', bottom: 100, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  navActiveText: { color: '#F59E0B', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});