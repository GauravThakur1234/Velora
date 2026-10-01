import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Alert, StatusBar, 
  StyleSheet, KeyboardAvoidingView, Platform, RefreshControl,
  LayoutAnimation, UIManager, Image, Linking
} from 'react-native';
import { useUser, useAuth } from '@clerk/expo'; // Ensure modern Clerk import
import { supabase } from '../lib/supabase';
import { 
  Plus, Search, Phone, Mail, MoreVertical, ShieldCheck, 
  X, Trash2, Code2, PenTool, Megaphone, MonitorSmartphone, Users,
  LayoutGrid, ProjectorIcon, Calendar, HomeIcon
} from 'lucide-react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Types & Configurations ---
type MemberStatus = 'ONLINE' | 'OFFLINE' | 'IN_MEETING';
type Department = 'Engineering' | 'Design' | 'Marketing' | 'Product' | 'All';

type TeamMember = {
  id: string;
  clerk_user_id: string;
  full_name: string;
  role: string;
  department: Department;
  email: string;
  phone?: string; // New Phone Field
  status: MemberStatus;
};

const DEPARTMENTS: { name: Department, icon: any, color: string }[] = [
  { name: 'Engineering', icon: Code2, color: '#3B82F6' },
  { name: 'Design', icon: PenTool, color: '#F472B6' },
  { name: 'Product', icon: MonitorSmartphone, color: '#10B981' },
  { name: 'Marketing', icon: Megaphone, color: '#F59E0B' },
];

const STATUS_COLORS = {
  ONLINE: '#10B981',    
  OFFLINE: '#52525B',   
  IN_MEETING: '#F59E0B' 
};

export default function TeamsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDept, setActiveDept] = useState<Department | 'All'>('All');
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<TeamMember>>({
    full_name: '', role: '', department: 'Engineering', email: '', phone: '', status: 'ONLINE'
  });

  useEffect(() => {
    if (isLoaded && user) {
      fetchMembers();
    }
  }, [isLoaded, user]);

  // --- CRUD: READ ---
  const fetchMembers = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('clerk_user_id', user.id) 
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMembers(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- CRUD: CREATE & UPDATE ---
  const handleSave = async () => {
    if (!user) return;
    if (!formData.full_name || !formData.role || !formData.email) {
      return Alert.alert('Validation Error', 'Name, Role, and Email are required fields.');
    }
    
    try {
      setIsSubmitting(true);
      const payload = { ...formData, clerk_user_id: user.id };
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      if (editingId) {
        setMembers(prev => prev.map(m => m.id === editingId ? { ...payload, id: editingId } as TeamMember : m));
        await supabase.from('team_members').update(payload).eq('id', editingId).eq('clerk_user_id', user.id);
      } else {
        const tempId = `temp-${Date.now()}`;
        setMembers(prev => [{ ...payload, id: tempId } as TeamMember, ...prev]);
        await supabase.from('team_members').insert([payload]);
        fetchMembers(); 
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
      fetchMembers();
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CRUD: DELETE ---
  const handleDelete = (id: string) => {
    if (!user) return;
    Alert.alert('Remove Member', 'Are you sure you want to remove this person from your organization?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMembers(prev => prev.filter(m => m.id !== id));
          setModalVisible(false);
          await supabase.from('team_members').delete().eq('id', id).eq('clerk_user_id', user.id);
        }
      }
    ]);
  };

  // --- Native Device Actions ---
  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'This team member has not provided a phone number.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Action Failed', 'Could not open the native phone dialer.');
    });
  };

  const handleEmail = (email: string) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Action Failed', 'Could not open the native email client.');
    });
  };

  const openModal = (member?: TeamMember) => {
    if (member) {
      setFormData(member);
      setEditingId(member.id);
    } else {
      setFormData({ full_name: '', role: '', department: 'Engineering', email: '', phone: '', status: 'ONLINE' });
      setEditingId(null);
    }
    setModalVisible(true);
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.role.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = activeDept === 'All' || m.department === activeDept;
      return matchesSearch && matchesDept;
    });
  }, [members, searchQuery, activeDept]);

  if (!isLoaded || (loading && !refreshing && members.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your workspace...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* --- Premium Clerk User Header --- */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfoRow}>
            <Image source={{ uri: user?.imageUrl }} style={styles.userAvatar} />
            <View>
              <Text style={styles.greetingText}>Workspace of</Text>
              <Text style={styles.userName}>{user?.firstName || 'User'}'s Org</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => signOut()} style={styles.signOutBtn}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.signOutText}>Secured</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={20} color="#71717A" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search team members..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}><X size={16} color="#71717A" /></TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- Department Filter Tabs --- */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeDept === 'All' && styles.tabBtnActive]}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveDept('All'); }}
          >
            <Users size={16} color={activeDept === 'All' ? '#000' : '#A1A1AA'} />
            <Text style={[styles.tabText, activeDept === 'All' && styles.tabTextActive]}>All Org</Text>
          </TouchableOpacity>

          {DEPARTMENTS.map(dept => {
            const isActive = activeDept === dept.name;
            return (
              <TouchableOpacity 
                key={dept.name} 
                style={[styles.tabBtn, isActive && { backgroundColor: dept.color, borderColor: dept.color }]}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveDept(dept.name); }}
              >
                <dept.icon size={16} color={isActive ? '#000' : dept.color} />
                <Text style={[styles.tabText, isActive ? { color: '#000', fontWeight: '800' } : { color: dept.color }]}>{dept.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* --- Team Members Directory --- */}
      {filteredMembers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}><Users size={40} color="#3F3F46" /></View>
          <Text style={styles.emptyTitle}>Your team is empty</Text>
          <Text style={styles.emptySub}>This workspace is private to {user?.firstName}. Start adding members to build your organization.</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMembers(true)} tintColor="#FAFAFA" />}
        >
          {filteredMembers.map((member) => {
            const deptConfig = DEPARTMENTS.find(d => d.name === member.department) || DEPARTMENTS[0];
            const DeptIcon = deptConfig.icon;
            
            return (
              <TouchableOpacity 
                key={member.id} 
                activeOpacity={0.8}
                onPress={() => openModal(member)}
                style={styles.memberCard}
              >
                <View style={styles.cardTop}>
                  <View style={styles.memberInfo}>
                    <View style={[styles.memberAvatar, { borderColor: deptConfig.color }]}>
                      <Text style={[styles.memberInitials, { color: deptConfig.color }]}>
                        {member.full_name.charAt(0).toUpperCase()}
                      </Text>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[member.status] }]} />
                    </View>
                    
                    <View style={styles.textStack}>
                      <Text style={styles.memberName}>{member.full_name}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.moreBtn} onPress={() => openModal(member)}>
                    <MoreVertical size={20} color="#71717A" />
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardBottom}>
                  <View style={[styles.deptBadge, { backgroundColor: `${deptConfig.color}15`, borderColor: `${deptConfig.color}30` }]}>
                    <DeptIcon size={12} color={deptConfig.color} />
                    <Text style={[styles.deptText, { color: deptConfig.color }]}>{member.department}</Text>
                  </View>

                  <View style={styles.actionBtns}>
                    <TouchableOpacity 
                      style={[styles.circleBtn, !member.phone && styles.circleBtnDisabled]} 
                      onPress={() => handleCall(member.phone)}
                    >
                      <Phone size={14} color={member.phone ? "#FAFAFA" : "#52525B"} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.circleBtn} 
                      onPress={() => handleEmail(member.email)}
                    >
                      <Mail size={14} color="#FAFAFA" />
                    </TouchableOpacity>
                  </View>
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
              <Text style={styles.modalTitle}>{editingId ? 'Edit Team Member' : 'Invite New Member'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color="#A1A1AA" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} bounces={false}>
              
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput 
                value={formData.full_name} onChangeText={(t) => setFormData({...formData, full_name: t})}
                placeholder="e.g., Sarah Jenkins" placeholderTextColor="#52525B"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>JOB ROLE</Text>
              <TextInput 
                value={formData.role} onChangeText={(t) => setFormData({...formData, role: t})}
                placeholder="e.g., Lead Designer" placeholderTextColor="#52525B"
                style={styles.input}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.inputLabel}>WORK EMAIL</Text>
                  <TextInput 
                    value={formData.email} onChangeText={(t) => setFormData({...formData, email: t})}
                    placeholder="sarah@org.com" placeholderTextColor="#52525B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PHONE (OPTIONAL)</Text>
                  <TextInput 
                    value={formData.phone} onChangeText={(t) => setFormData({...formData, phone: t})}
                    placeholder="+1 234 567 890" placeholderTextColor="#52525B"
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>DEPARTMENT ASSIGNMENT</Text>
              <View style={styles.deptGrid}>
                {DEPARTMENTS.map((dept) => {
                  const isSel = formData.department === dept.name;
                  return (
                    <TouchableOpacity 
                      key={dept.name} onPress={() => setFormData({...formData, department: dept.name})}
                      style={[styles.deptOptBtn, isSel && { backgroundColor: dept.color, borderColor: dept.color }]}
                    >
                      <dept.icon size={16} color={isSel ? '#000' : dept.color} style={{ marginBottom: 8 }} />
                      <Text style={[styles.deptOptText, { color: isSel ? '#000' : '#71717A' }]}>{dept.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>CURRENT STATUS</Text>
              <View style={styles.statusRow}>
                {(['ONLINE', 'IN_MEETING', 'OFFLINE'] as MemberStatus[]).map(status => (
                  <TouchableOpacity 
                    key={status} onPress={() => setFormData({...formData, status})}
                    style={[styles.statusToggle, formData.status === status && { backgroundColor: '#27272A', borderColor: STATUS_COLORS[status] }]}
                  >
                    <View style={[styles.tinyDot, { backgroundColor: STATUS_COLORS[status] }]} />
                    <Text style={[styles.statusToggleText, formData.status === status && { color: '#FAFAFA' }]}>{status.replace('_', ' ')}</Text>
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
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{editingId ? 'Save Profile' : 'Add to Organization'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fabMain} onPress={() => openModal()} activeOpacity={0.8}>
        <Plus size={26} color="#FAFAFA" strokeWidth={3} />
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

         <Link href="/(tabs)/projects" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <ProjectorIcon size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Projects</Text>
           </TouchableOpacity>
         </Link>
         
         <View style={styles.navActiveItem}>
            <Users size={20} color="#6366F1" />
            <Text style={styles.navActiveText}>Teams</Text>
         </View>
                
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

// --- Stylesheet for Premium Dark Aesthetic ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600' },
  
  // Header
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#000000' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#27272A', marginRight: 12 },
  greetingText: { color: '#71717A', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  userName: { color: '#FAFAFA', fontSize: 20, fontWeight: '900' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  signOutText: { color: '#10B981', fontSize: 10, fontWeight: '800', marginLeft: 4 },
  
  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', borderRadius: 14, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#27272A' },
  searchInput: { flex: 1, color: '#FAFAFA', fontSize: 14, marginLeft: 10, fontWeight: '500' },
  
  // Department Tabs
  tabsWrapper: { borderBottomWidth: 1, borderBottomColor: '#18181B', paddingBottom: 16 },
  tabsScroll: { paddingHorizontal: 20, gap: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A' },
  tabBtnActive: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA' },
  tabText: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  tabTextActive: { color: '#000000', fontWeight: '800' },
  
  // List Area
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 60 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  // Member Card
  memberCard: { backgroundColor: '#09090B', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1F1F22' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginRight: 16 },
  memberInitials: { fontSize: 20, fontWeight: '900' },
  statusDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#09090B' },
  textStack: { flex: 1 },
  memberName: { color: '#FAFAFA', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  memberRole: { color: '#A1A1AA', fontSize: 13, fontWeight: '500' },
  moreBtn: { padding: 4 },
  
  divider: { height: 1, backgroundColor: '#1F1F22', marginVertical: 16 },
  
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deptBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  deptText: { fontSize: 11, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  
  // Action Buttons
  actionBtns: { flexDirection: 'row', gap: 12 },
  circleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  circleBtnDisabled: { opacity: 0.5 },
  
  // Modal 
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#09090B', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', borderWidth: 1, borderColor: '#27272A' },
  modalDrag: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FAFAFA', fontSize: 22, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#18181B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  // Forms
  inputLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4, marginTop: 8 },
  input: { backgroundColor: '#111113', color: '#FAFAFA', padding: 16, borderRadius: 14, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: '#27272A', marginBottom: 16 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  deptOptBtn: { width: '48%', padding: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A', marginBottom: 12 },
  deptOptText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statusToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#111113', borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#27272A' },
  tinyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusToggleText: { color: '#71717A', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  
  // Actions
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#27272A', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, width: '20%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  saveBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FAFAFA', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  
  fabMain: { position: 'absolute', bottom: 100, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 4, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  navActiveText: { color: '#6366F1', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});