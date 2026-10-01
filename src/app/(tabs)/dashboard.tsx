import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, 
  Image, StyleSheet, StatusBar, Dimensions, Platform, RefreshControl, LayoutAnimation, UIManager 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useUser } from '@clerk/expo';
import { 
  Search, ChevronRight, Calendar, Clock, 
  LayoutGrid, CheckCircle2, Home, FolderKanban, Users, Target, 
  TrendingUp, BarChart3, Rocket, Settings,
  RoadIcon
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- Types ---
type KanbanTask = { id: string; title: string; status: string; priority: string; due_date: string; project_name: string };
type TeamMember = { id: string; full_name: string; department: string; status: string };
type ScheduleEvent = { id: string; title: string; start_time: string; end_time: string; category: string };
type Project = { id: string; title: string; status: string; progress: number };

const PRIORITY_COLORS: Record<string, string> = { LOW: '#A1A1AA', MEDIUM: '#6366F1', HIGH: '#F59E0B', URGENT: '#EF4444' };
const STATUS_COLORS: Record<string, string> = { TODO: '#52525B', IN_PROGRESS: '#6366F1', REVIEW: '#F59E0B', DONE: '#10B981' };

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      fetchDashboardData();
    }
  }, [isLoaded, user]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [tasksRes, teamRes, scheduleRes, projectsRes] = await Promise.all([
        supabase.from('user_kanban_tasks').select('*').eq('clerk_user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('team_members').select('*').eq('clerk_user_id', user.id).limit(5),
        supabase.from('user_daily_schedule').select('*').eq('clerk_user_id', user.id).order('start_time', { ascending: true }).limit(4),
        supabase.from('user_projects').select('*').eq('clerk_user_id', user.id).order('updated_at', { ascending: false }).limit(3)
      ]);

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      if (tasksRes.data) setTasks(tasksRes.data);
      if (teamRes.data) setTeam(teamRes.data);
      if (scheduleRes.data) setSchedule(scheduleRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      
    } catch (error) {
      console.log("Dashboard sync failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => fetchDashboardData(true), [user]);

  // --- Dynamic Analytics Engine ---
  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === 'DONE').length;
    const percentDone = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
    
    const pipeline = [
      { label: 'To Do', count: tasks.filter(t => t.status === 'TODO').length, color: STATUS_COLORS.TODO },
      { label: 'Active', count: tasks.filter(t => t.status === 'IN_PROGRESS').length, color: STATUS_COLORS.IN_PROGRESS },
      { label: 'Review', count: tasks.filter(t => t.status === 'REVIEW').length, color: STATUS_COLORS.REVIEW },
      { label: 'Done', count: doneTasks, color: STATUS_COLORS.DONE },
    ];

    const priorityCounts = {
      LOW: tasks.filter(t => t.status !== 'DONE' && t.priority === 'LOW').length,
      MEDIUM: tasks.filter(t => t.status !== 'DONE' && t.priority === 'MEDIUM').length,
      HIGH: tasks.filter(t => t.status !== 'DONE' && t.priority === 'HIGH').length,
      URGENT: tasks.filter(t => t.status !== 'DONE' && t.priority === 'URGENT').length,
    };
    const maxPrioCount = Math.max(...Object.values(priorityCounts), 1);

    const urgentTasks = tasks.filter(t => t.status !== 'DONE' && (t.priority === 'URGENT' || t.priority === 'HIGH')).slice(0, 4);

    return { totalTasks, doneTasks, percentDone, pipeline, priorityCounts, maxPrioCount, urgentTasks };
  }, [tasks]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (!isLoaded || (loading && !refreshing)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Compiling Analytics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
      >
        {/* --- Premium Header --- */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.userInfo}>
              <Image source={{ uri: user?.imageUrl }} style={styles.avatar} />
              <View>
                <Text style={styles.greetingText}>{greeting},</Text>
                <Text style={styles.userName}>{user?.firstName || 'Builder'}</Text>
              </View>
            </View>
            
            {/* Integrated Settings Link in Top Right */}
            <Link href="/(tabs)/settings" asChild>
              <TouchableOpacity style={styles.iconBtn}>
                <Settings size={20} color="#A1A1AA" />
              </TouchableOpacity>
            </Link>
          </View>
          
          <View style={styles.quickMetricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{projects.filter(p => p.status === 'Active').length}</Text>
              <Text style={styles.metricLabel}>Active Projects</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{team.length}</Text>
              <Text style={styles.metricLabel}>Team Members</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats.totalTasks - stats.doneTasks}</Text>
              <Text style={styles.metricLabel}>Open Issues</Text>
            </View>
          </View>
        </View>

        {/* --- Global Progress --- */}
        <View style={styles.sprintCard}>
          <View style={styles.sprintHeader}>
            <View style={styles.sprintTitleRow}>
              <View style={styles.sprintIconWrap}>
                <Target size={20} color="#6366F1" />
              </View>
              <View>
                <View style={styles.rowCenter}>
                  <Text style={styles.sprintTitle}>Sprint Velocity</Text>
                  <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>LIVE</Text></View>
                </View>
                <Text style={styles.sprintSub}>Overall task completion</Text>
              </View>
            </View>
            <Text style={styles.sprintPercent}>{stats.percentDone}%</Text>
          </View>
          
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${stats.percentDone}%` }]} />
          </View>
          <Text style={styles.sprintStat}>{stats.doneTasks} of {stats.totalTasks} tasks completed across all projects</Text>
        </View>

        {/* --- FULL WIDTH: Priority Bar Chart --- */}
        <View style={[styles.card, styles.fullWidthCard]}>
          <View style={styles.rowCenterSpace}>
            <Text style={styles.sectionTitleSmall}>Workload Intensity</Text>
            <BarChart3 size={18} color="#71717A" />
          </View>
          <Text style={styles.cardSubText}>Active open issues organized by priority level</Text>
          
          <View style={styles.barChartContainerBig}>
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map(prio => {
              const count = stats.priorityCounts[prio];
              const heightPercent = stats.maxPrioCount === 0 ? 0 : (count / stats.maxPrioCount) * 100;
              return (
                <View key={prio} style={styles.barColumnBig}>
                  <Text style={styles.barValueBig}>{count}</Text>
                  <View style={styles.barTrackBig}>
                    <View style={[styles.barFillBig, { height: `${heightPercent}%`, backgroundColor: PRIORITY_COLORS[prio] }]} />
                  </View>
                  <Text style={styles.barLabelBig}>{prio}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* --- FULL WIDTH: Pipeline Distribution --- */}
        <View style={[styles.card, styles.fullWidthCard]}>
           <View style={styles.rowCenterSpace}>
             <Text style={styles.sectionTitleSmall}>Status Pipeline</Text>
             <TrendingUp color="#71717A" size={18} />
           </View>
           <Text style={styles.cardSubText}>Task distribution across the kanban lifecycle</Text>

           <View style={styles.stackedBarContainer}>
             {stats.pipeline.map((p, i) => {
               const width = stats.totalTasks === 0 ? 0 : (p.count / stats.totalTasks) * 100;
               return width > 0 ? (
                 <View key={i} style={[styles.stackedSegment, { width: `${width}%`, backgroundColor: p.color }]} />
               ) : null;
             })}
           </View>

           <View style={styles.legendContainer}>
             {stats.pipeline.map((p, i) => (
               <View key={i} style={styles.legendItem}>
                 <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                 <Text style={styles.legendCountText}>{p.count}</Text>
                 <Text style={styles.legendText}>{p.label}</Text>
               </View>
             ))}
           </View>
        </View>

        {/* --- Action Required (Urgent Kanban Tasks) --- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Action Required</Text>
            {stats.urgentTasks.length > 0 && (
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{stats.urgentTasks.length}</Text></View>
            )}
          </View>
          
          <View style={styles.listCard}>
            {stats.urgentTasks.length === 0 ? (
              <View style={styles.emptyStateWrap}>
                <CheckCircle2 size={32} color="#10B981" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyStateText}>No urgent tasks. You're all caught up!</Text>
              </View>
            ) : (
              stats.urgentTasks.map((task, index) => (
                <View key={task.id} style={[styles.taskRow, index === stats.urgentTasks.length - 1 && styles.noBorder]}>
                  <View style={styles.taskInfo}>
                    <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                      <View style={styles.rowCenter}>
                        <FolderKanban size={10} color="#71717A" style={{ marginRight: 4 }} />
                        <Text style={styles.taskProject}>{task.project_name.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight color="#3F3F46" size={18} />
                </View>
              ))
            )}
          </View>
        </View>

        {/* --- Two Column: Schedule & Active Projects --- */}
        <View style={styles.twoColumnLayout}>
          
          <View style={[styles.card, styles.halfCard]}>
             <View style={styles.rowCenterSpace}>
               <Text style={styles.sectionTitleSmall}>Schedule</Text>
               <Calendar color="#6366F1" size={14} />
             </View>
             <View style={styles.divider} />
             {schedule.length === 0 ? (
               <Text style={styles.emptyStateTextSm}>Timeline is clear.</Text>
             ) : (
               schedule.map((evt) => (
                 <View key={evt.id} style={styles.scheduleRow}>
                   <View style={styles.rowCenter}>
                     <Clock color="#A1A1AA" size={12} />
                     <Text style={styles.scheduleTitle} numberOfLines={1}>{evt.title}</Text>
                   </View>
                   <Text style={styles.scheduleTime}>{evt.start_time.substring(0, 5)} - {evt.end_time.substring(0, 5)}</Text>
                 </View>
               ))
             )}
          </View>

          <View style={[styles.card, styles.halfCard]}>
             <View style={styles.rowCenterSpace}>
               <Text style={styles.sectionTitleSmall}>Active</Text>
               <Rocket color="#10B981" size={14} />
             </View>
             <View style={styles.divider} />
             {projects.length === 0 ? (
               <Text style={styles.emptyStateTextSm}>No active projects.</Text>
             ) : (
               projects.map((proj) => (
                 <View key={proj.id} style={styles.projectRow}>
                   <Text style={styles.projectTitle} numberOfLines={1}>{proj.title}</Text>
                   <View style={styles.projectProgTrack}>
                     <View style={[styles.projectProgFill, { width: `${proj.progress}%` }]} />
                   </View>
                 </View>
               ))
             )}
          </View>
        </View>

      </ScrollView>

      {/* --- Unified App Navigation --- */}
      <View style={styles.bottomNav}>
         <View style={styles.navActiveItem}>
            <Home size={20} color="#6366F1" />
            <Text style={styles.navActiveText}>Home</Text>
         </View>
         
         <Link href="/(tabs)/kanban" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <LayoutGrid size={22} color="#71717A" />
              <Text style={styles.bottomTabText}>Kanban</Text>
           </TouchableOpacity>
         </Link>
         <Link href="/(tabs)/projects" asChild>
           <TouchableOpacity style={styles.bottomTab}>
              <FolderKanban size={22} color="#71717A" />
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

// --- Ultra-Premium Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowCenterSpace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 12 },
  
  // Header
  header: { marginBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: '#27272A', marginRight: 16 },
  greetingText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600', marginBottom: 2, letterSpacing: 0.5 },
  userName: { color: '#FAFAFA', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  // Quick Metrics
  quickMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metricCard: { flex: 1, backgroundColor: '#111113', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#1F1F22', alignItems: 'center' },
  metricValue: { color: '#FAFAFA', fontSize: 24, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: '#71717A', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Sprint Velocity Card
  sprintCard: { backgroundColor: '#111113', padding: 20, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: '#1F1F22' },
  sprintHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sprintTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sprintIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(99, 102, 241, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  sprintTitle: { color: '#FAFAFA', fontSize: 18, fontWeight: '900', marginRight: 10 },
  activeBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  activeBadgeText: { color: '#10B981', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sprintSub: { color: '#71717A', fontSize: 12, marginTop: 6, fontWeight: '600' },
  sprintPercent: { color: '#6366F1', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  
  progressTrack: { height: 10, backgroundColor: '#27272A', borderRadius: 5, marginBottom: 12, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#6366F1', borderRadius: 5 },
  sprintStat: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#FAFAFA', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  countBadge: { backgroundColor: '#27272A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countBadgeText: { color: '#FAFAFA', fontSize: 12, fontWeight: '900' },

  // Visualizations (Charts)
  twoColumnLayout: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  card: { backgroundColor: '#111113', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#1F1F22' },
  halfCard: { flex: 1, padding: 16 },
  fullWidthCard: { width: '100%', marginBottom: 24 },
  sectionTitleSmall: { color: '#FAFAFA', fontSize: 16, fontWeight: '900' },
  cardSubText: { color: '#71717A', fontSize: 13, fontWeight: '600', marginBottom: 24, marginTop: 6 },
  
  // Big Bar Chart
  barChartContainerBig: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingHorizontal: 10, marginTop: 10 },
  barColumnBig: { alignItems: 'center', width: 44 },
  barValueBig: { color: '#FAFAFA', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  barTrackBig: { width: 28, height: 110, backgroundColor: '#27272A', borderRadius: 14, justifyContent: 'flex-end', overflow: 'hidden' },
  barFillBig: { width: '100%', borderRadius: 14 },
  barLabelBig: { color: '#71717A', fontSize: 11, fontWeight: '800', marginTop: 12, letterSpacing: 0.5 },

  // Stacked Bar (Pipeline)
  stackedBarContainer: { flexDirection: 'row', height: 20, backgroundColor: '#27272A', borderRadius: 10, overflow: 'hidden', marginBottom: 24 },
  stackedSegment: { height: '100%' },
  legendContainer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', minWidth: '40%' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  legendCountText: { color: '#FAFAFA', fontSize: 16, fontWeight: '900', marginRight: 6 },
  legendText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  // Lists
  listCard: { backgroundColor: '#111113', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#1F1F22' },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  noBorder: { borderBottomWidth: 0 },
  taskInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  priorityDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  taskTitle: { color: '#FAFAFA', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  taskProject: { color: '#A1A1AA', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  
  emptyStateWrap: { alignItems: 'center', paddingVertical: 20 },
  emptyStateText: { color: '#71717A', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyStateTextSm: { color: '#71717A', fontSize: 11, fontStyle: 'italic', marginTop: 10 },

  // Mini Lists
  scheduleRow: { marginBottom: 16 },
  scheduleTitle: { color: '#D4D4D8', fontSize: 13, fontWeight: '700', marginLeft: 8, flex: 1 },
  scheduleTime: { color: '#71717A', fontSize: 11, fontWeight: '800', marginTop: 6, marginLeft: 22 },
  
  projectRow: { marginBottom: 16 },
  projectTitle: { color: '#D4D4D8', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  projectProgTrack: { height: 4, backgroundColor: '#27272A', borderRadius: 2 },
  projectProgFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 2 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  navActiveText: { color: '#6366F1', fontSize: 12, fontWeight: '900', marginLeft: 8 }
});