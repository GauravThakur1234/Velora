import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Alert, StatusBar, 
  StyleSheet, KeyboardAvoidingView, Platform, RefreshControl,
  LayoutAnimation, UIManager, Image, Dimensions
} from 'react-native';
import { useUser, useAuth } from '@clerk/expo';
import { supabase } from '../lib/supabase';
import { 
  Plus, Search, Calendar, FolderKanban, 
  X, Trash2, Rocket, LayoutGrid, Users, ShieldCheck,
  Target, ChevronRight, HomeIcon,
  Bug, BookOpen, Wrench, ArrowRight, ArrowLeft, CheckCircle2,
  Clock, CircleDashed, ListTodo, PlayCircle, BarChart3, Edit3,
  Crown, Map, TrendingUp, GitMerge
} from 'lucide-react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- View Modes ---
type MainViewMode = 'PROJECTS' | 'ROADMAPS';

// --- Projects Types ---
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

// --- Agile / Scrum Types ---
type TaskPhase = 'Backlog' | 'Active Sprint';
type TaskType = 'Story' | 'Bug' | 'Tech Debt';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

type AgileTask = {
  id: string;
  clerk_user_id: string;
  project_id: string;
  title: string;
  description: string;
  task_type: TaskType;
  status: TaskStatus;
  sprint_phase: TaskPhase;
  story_points: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
};

// --- Roadmaps Types ---
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

// --- Configurations ---
const STATUS_CONFIG: Record<ProjectStatus, { color: string, bg: string }> = {
  Planning: { color: '#A1A1AA', bg: 'rgba(161, 161, 170, 0.15)' },
  Active: { color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)' },
  Paused: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  Completed: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
};

const SCENARIO_CONFIG: Record<ScenarioType, { color: string, bg: string }> = {
  'Best Case': { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  'Likely': { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  'Worst Case': { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

const TASK_TYPE_CONFIG: Record<TaskType, { icon: any, color: string }> = {
  'Story': { icon: BookOpen, color: '#3B82F6' },
  'Bug': { icon: Bug, color: '#EF4444' },
  'Tech Debt': { icon: Wrench, color: '#F59E0B' },
};

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, icon: any }> = {
  TODO: { label: 'To Do', color: '#A1A1AA', icon: CircleDashed },
  IN_PROGRESS: { label: 'In Progress', color: '#8B5CF6', icon: Clock },
  DONE: { label: 'Done', color: '#10B981', icon: CheckCircle2 },
};

function GlobeIcon(props: any) { return <LayoutGrid {...props} />; }
function SmartphoneIcon(props: any) { return <Rocket {...props} />; }
function MegaphoneIcon(props: any) { return <Target {...props} />; }
function BriefcaseIcon(props: any) { return <FolderKanban {...props} />; }

const CATEGORY_ICONS: Record<ProjectCategory, any> = {
  'Web App': GlobeIcon,
  'Mobile App': SmartphoneIcon,
  'Marketing': MegaphoneIcon,
  'Internal': BriefcaseIcon,
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function ProjectsPortfolio() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();

  // --- View Switcher State ---
  const [activeMainView, setActiveMainView] = useState<MainViewMode>('PROJECTS');

  // --- Common State ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Projects State ---
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [filterProjectStatus, setFilterProjectStatus] = useState<ProjectStatus | 'All'>('All');
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<Partial<UserProject>>({ 
    title: '', description: '', status: 'Active', category: 'Web App', target_date: getTodayStr(), progress: 0 
  });

  // --- Agile Workspace State ---
  const [activeWorkspace, setActiveWorkspace] = useState<UserProject | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'BACKLOG' | 'SPRINT'>('BACKLOG');
  const [workspaceTasks, setWorkspaceTasks] = useState<AgileTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<Partial<AgileTask>>({
    title: '', description: '', task_type: 'Story', status: 'TODO', sprint_phase: 'Backlog', story_points: 3, priority: 'MEDIUM'
  });

  // --- Roadmaps State ---
  const [roadmaps, setRoadmaps] = useState<UserRoadmap[]>([]);
  const [filterScenario, setFilterScenario] = useState<ScenarioType | 'All'>('All');
  const [roadmapModalVisible, setRoadmapModalVisible] = useState(false);
  const [editingRoadmapId, setEditingRoadmapId] = useState<string | null>(null);
  const [roadmapForm, setRoadmapForm] = useState<Partial<UserRoadmap>>({
    title: '', description: '', scenario_type: 'Likely', status: 'Planning', 
    start_date: getTodayStr(), end_date: getTodayStr(), progress: 0
  });

  useEffect(() => {
    if (isLoaded && user) {
      fetchAllData();
    }
  }, [isLoaded, user]);

  const fetchAllData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    await Promise.all([fetchProjects(), fetchRoadmaps()]);
    setLoading(false); 
    setRefreshing(false);
  };

  // ==========================================
  // API: PROJECTS
  // ==========================================
  const fetchProjects = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_projects')
        .select('*')
        .eq('clerk_user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setProjects(data || []);
    } catch (error: any) {
      Alert.alert('Error fetching projects', error.message);
    }
  };

  const handleProjectSave = async () => {
    if (!user) return;
    if (!projectForm.title?.trim()) return Alert.alert('Validation', 'Title is required.');
    
    try {
      setIsSubmitting(true);
      const payload = { ...projectForm, clerk_user_id: user.id };
      
      if (editingProjectId) {
        const { error } = await supabase
          .from('user_projects')
          .update(payload)
          .eq('id', editingProjectId)
          .eq('clerk_user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_projects').insert([payload]);
        if (error) throw error;
      }
      setProjectModalVisible(false);
      fetchProjects(); 
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProjectDelete = async (id: string) => {
    if (!user) return;
    Alert.alert('Delete Project', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setProjects(prev => prev.filter(p => p.id !== id));
          setProjectModalVisible(false);
          const { error } = await supabase.from('user_projects').delete().eq('id', id).eq('clerk_user_id', user.id);
          if (error) Alert.alert("Error deleting project", error.message);
        }
      }
    ]);
  };

  // ==========================================
  // API: ROADMAPS
  // ==========================================
  const fetchRoadmaps = async () => {
    if (!user) return;
    try {
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
    }
  };

  const handleRoadmapSave = async () => {
    if (!user) return;
    if (!roadmapForm.title?.trim() || !roadmapForm.start_date || !roadmapForm.end_date) {
      return Alert.alert('Validation', 'Title and dates are required.');
    }
    
    try {
      setIsSubmitting(true);
      const payload = { ...roadmapForm, clerk_user_id: user.id };
      
      if (editingRoadmapId) {
        const { error } = await supabase
          .from('user_roadmaps')
          .update(payload)
          .eq('id', editingRoadmapId)
          .eq('clerk_user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roadmaps').insert([payload]);
        if (error) throw error;
      }
      setRoadmapModalVisible(false);
      fetchRoadmaps(); 
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoadmapDelete = async (id: string) => {
    if (!user) return;
    Alert.alert('Delete Roadmap', 'Remove this macro-level plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setRoadmaps(prev => prev.filter(r => r.id !== id));
          setRoadmapModalVisible(false);
          await supabase.from('user_roadmaps').delete().eq('id', id).eq('clerk_user_id', user.id);
        }
      }
    ]);
  };

  // ==========================================
  // API: AGILE TASKS
  // ==========================================
  const fetchWorkspaceTasks = async (projectId: string) => {
    if (!user) return;
    try {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from('user_agile_tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('clerk_user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setWorkspaceTasks(data || []);
    } catch (error: any) {
      setWorkspaceTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleTaskSave = async () => {
    if (!user || !activeWorkspace) return;
    if (!taskForm.title?.trim()) return Alert.alert('Validation', 'Task title required.');
    
    try {
      setIsSubmitting(true);
      const payload = { ...taskForm, project_id: activeWorkspace.id, clerk_user_id: user.id };
      
      if (editingTaskId) {
        const { data, error } = await supabase
          .from('user_agile_tasks')
          .update(payload)
          .eq('id', editingTaskId)
          .eq('clerk_user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        setWorkspaceTasks(prev => prev.map(t => t.id === editingTaskId ? (data as AgileTask) : t));
      } else {
        const { data, error } = await supabase
          .from('user_agile_tasks')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        setWorkspaceTasks(prev => [data as AgileTask, ...prev]);
      }
      setTaskModalVisible(false);
    } catch (error: any) {
      Alert.alert('Task Sync Failed', error.message || 'Make sure your table exists.');
      fetchWorkspaceTasks(activeWorkspace.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveTaskPhase = async (task: AgileTask, newPhase: TaskPhase) => {
    if (!user) return;
    const newStatus = newPhase === 'Backlog' ? 'TODO' : task.status;
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWorkspaceTasks(prev => prev.map(t => t.id === task.id ? { ...t, sprint_phase: newPhase, status: newStatus } : t));
    
    const { error } = await supabase
      .from('user_agile_tasks')
      .update({ sprint_phase: newPhase, status: newStatus })
      .eq('id', task.id)
      .eq('clerk_user_id', user.id);
      
    if (error) {
       Alert.alert("Error moving task", error.message);
       fetchWorkspaceTasks(task.project_id);
    }
  };

  const updateTaskStatus = async (task: AgileTask, newStatus: TaskStatus) => {
    if (!user) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWorkspaceTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    
    const { error } = await supabase
      .from('user_agile_tasks')
      .update({ status: newStatus })
      .eq('id', task.id)
      .eq('clerk_user_id', user.id);
      
    if (error) Alert.alert("Error updating status", error.message);
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    Alert.alert('Remove Task', 'Delete this task permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setWorkspaceTasks(prev => prev.filter(t => t.id !== id));
          setTaskModalVisible(false);
          const { error } = await supabase
            .from('user_agile_tasks')
            .delete()
            .eq('id', id)
            .eq('clerk_user_id', user.id);
          if (error) Alert.alert("Error deleting task", error.message);
        }
      }
    ]);
  };

  // ==========================================
  // HELPERS & MODALS
  // ==========================================
  const openProjectModal = (project?: UserProject) => {
    if (project) {
      setProjectForm(project);
      setEditingProjectId(project.id);
    } else {
      setProjectForm({ title: '', description: '', status: 'Active', category: 'Web App', target_date: getTodayStr(), progress: 0 });
      setEditingProjectId(null);
    }
    setProjectModalVisible(true);
  };

  const openRoadmapModal = (roadmap?: UserRoadmap) => {
    if (roadmap) {
      setRoadmapForm(roadmap);
      setEditingRoadmapId(roadmap.id);
    } else {
      setRoadmapForm({ title: '', description: '', scenario_type: 'Likely', status: 'Planning', start_date: getTodayStr(), end_date: getTodayStr(), progress: 0 });
      setEditingRoadmapId(null);
    }
    setRoadmapModalVisible(true);
  };

  const openWorkspace = (project: UserProject) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveWorkspace(project);
    fetchWorkspaceTasks(project.id);
  };

  const openTaskModal = (task?: AgileTask) => {
    if (task) {
      setTaskForm(task);
      setEditingTaskId(task.id);
    } else {
      setTaskForm({ 
        title: '', description: '', task_type: 'Story', status: 'TODO', 
        sprint_phase: workspaceTab === 'BACKLOG' ? 'Backlog' : 'Active Sprint', 
        story_points: 3, priority: 'MEDIUM' 
      });
      setEditingTaskId(null);
    }
    setTaskModalVisible(true);
  };

  // --- Derived Calculations ---
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterProjectStatus === 'All' || p.status === filterProjectStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, filterProjectStatus]);

  const filteredRoadmaps = useMemo(() => {
    return roadmaps.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesScenario = filterScenario === 'All' || r.scenario_type === filterScenario;
      return matchesSearch && matchesScenario;
    });
  }, [roadmaps, searchQuery, filterScenario]);

  const stats = useMemo(() => ({
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'Active').length,
    totalRoadmaps: roadmaps.length,
  }), [projects, roadmaps]);

  // Agile Derived State
  const backlogTasks = useMemo(() => workspaceTasks.filter(t => t.sprint_phase === 'Backlog'), [workspaceTasks]);
  const sprintTasks = useMemo(() => workspaceTasks.filter(t => t.sprint_phase === 'Active Sprint'), [workspaceTasks]);
  const sprintPointsTotal = sprintTasks.reduce((acc, t) => acc + t.story_points, 0);
  const sprintPointsDone = sprintTasks.filter(t => t.status === 'DONE').reduce((acc, t) => acc + t.story_points, 0);
  const sprintProgress = sprintPointsTotal === 0 ? 0 : Math.round((sprintPointsDone / sprintPointsTotal) * 100);

  // Loading Screen
  if (!isLoaded || (loading && !refreshing && projects.length === 0 && roadmaps.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading workspace & roadmaps...</Text>
      </View>
    );
  }

  // ==========================================
  // VIEW 1: AGILE WORKSPACE OVERLAY
  // ==========================================
  if (activeWorkspace) {
    const projColor = STATUS_CONFIG[activeWorkspace.status].color;
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        <View style={styles.workspaceHeader}>
          <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveWorkspace(null); }} style={styles.backBtn}>
            <ArrowLeft size={20} color="#FAFAFA" />
          </TouchableOpacity>
          <View style={styles.workspaceHeaderCenter}>
            <Text style={styles.workspaceTitle} numberOfLines={1}>{activeWorkspace.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_CONFIG[activeWorkspace.status].bg, alignSelf: 'center', marginTop: 4 }]}>
              <Text style={[styles.statusText, { color: projColor }]}>{activeWorkspace.status}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => openProjectModal(activeWorkspace)} style={styles.editProjBtn}>
            <Edit3 size={18} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        <View style={styles.agileTabs}>
          <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setWorkspaceTab('BACKLOG'); }} style={[styles.agileTab, workspaceTab === 'BACKLOG' && styles.agileTabActive]}>
            <ListTodo size={18} color={workspaceTab === 'BACKLOG' ? '#FAFAFA' : '#71717A'} />
            <Text style={[styles.agileTabText, workspaceTab === 'BACKLOG' && styles.agileTabTextActive]}>Product Backlog</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{backlogTasks.length}</Text></View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setWorkspaceTab('SPRINT'); }} style={[styles.agileTab, workspaceTab === 'SPRINT' && styles.agileTabActive]}>
            <PlayCircle size={18} color={workspaceTab === 'SPRINT' ? '#6366F1' : '#71717A'} />
            <Text style={[styles.agileTabText, workspaceTab === 'SPRINT' && { color: '#6366F1' }]}>Active Sprint</Text>
            {sprintTasks.length > 0 && <View style={[styles.countBadge, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}><Text style={[styles.countText, { color: '#6366F1' }]}>{sprintTasks.length}</Text></View>}
          </TouchableOpacity>
        </View>

        {tasksLoading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.workspaceScroll}>
            {workspaceTab === 'SPRINT' && sprintTasks.length > 0 && (
              <View style={styles.sprintDashboard}>
                <View style={styles.sprintDashTop}>
                  <View>
                    <Text style={styles.sprintDashTitle}>Sprint Capacity</Text>
                    <Text style={styles.sprintDashSub}>{sprintPointsDone} of {sprintPointsTotal} Story Points Done</Text>
                  </View>
                  <Text style={styles.sprintPercent}>{sprintProgress}%</Text>
                </View>
                <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${sprintProgress}%`, backgroundColor: '#6366F1' }]} /></View>
              </View>
            )}

            {(workspaceTab === 'BACKLOG' ? backlogTasks : sprintTasks).length === 0 ? (
              <View style={styles.emptyTasks}>
                <BarChart3 size={48} color="#27272A" />
                <Text style={styles.emptyTasksTitle}>No items found</Text>
                <Text style={styles.emptyTasksSub}>
                  {workspaceTab === 'BACKLOG' ? 'Start writing user stories and bugs for your backlog.' : 'Your active sprint is empty. Move items from the backlog.'}
                </Text>
                <TouchableOpacity style={styles.emptyTasksBtn} onPress={() => openTaskModal()}>
                  <Plus size={16} color="#000" />
                  <Text style={styles.emptyTasksBtnText}>Create Issue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              (workspaceTab === 'BACKLOG' ? backlogTasks : sprintTasks).map(task => {
                const typeConfig = TASK_TYPE_CONFIG[task.task_type];
                const statusConfig = TASK_STATUS_CONFIG[task.status];
                const isSprint = task.sprint_phase === 'Active Sprint';

                return (
                  <TouchableOpacity key={task.id} activeOpacity={0.7} onPress={() => openTaskModal(task)} style={styles.taskCard}>
                    <View style={styles.taskCardHeader}>
                      <View style={styles.taskTypeBadge}>
                        <typeConfig.icon size={12} color={typeConfig.color} />
                        <Text style={[styles.taskTypeText, { color: typeConfig.color }]}>{task.task_type}</Text>
                      </View>
                      
                      {isSprint ? (
                        <TouchableOpacity 
                          style={[styles.taskStatusBadge, { backgroundColor: `${statusConfig.color}15`, borderColor: statusConfig.color }]}
                          onPress={() => {
                            if (task.status === 'TODO') updateTaskStatus(task, 'IN_PROGRESS');
                            else if (task.status === 'IN_PROGRESS') updateTaskStatus(task, 'DONE');
                            else updateTaskStatus(task, 'TODO');
                          }}
                        >
                          <statusConfig.icon size={12} color={statusConfig.color} />
                          <Text style={[styles.taskStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.storyPointBadge}>
                          <Text style={styles.storyPointText}>{task.story_points} pts</Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.description ? <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text> : null}
                    
                    <View style={styles.taskCardFooter}>
                      <View style={styles.taskFooterLeft}>
                        {isSprint && (
                          <View style={styles.storyPointBadgeMini}>
                            <Text style={styles.storyPointTextMini}>{task.story_points} pts</Text>
                          </View>
                        )}
                        <Text style={styles.taskPriority}>{task.priority}</Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={[styles.moveBtn, isSprint && { backgroundColor: '#18181B', borderColor: '#27272A' }]} 
                        onPress={() => moveTaskPhase(task, isSprint ? 'Backlog' : 'Active Sprint')}
                      >
                        <Text style={[styles.moveBtnText, isSprint && { color: '#A1A1AA' }]}>
                          {isSprint ? 'To Backlog' : 'Add to Sprint'}
                        </Text>
                        {isSprint ? <ArrowLeft size={12} color="#A1A1AA" /> : <ArrowRight size={12} color="#6366F1" />}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.fabMain} onPress={() => openTaskModal()} activeOpacity={0.8}>
          <Plus size={26} color="#09090B" strokeWidth={3} />
        </TouchableOpacity>

        {/* Task Form Modal */}
        <Modal visible={taskModalVisible} animationType="slide" transparent={true}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalDrag} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingTaskId ? 'Edit Issue' : 'Create Issue'}</Text>
                <TouchableOpacity onPress={() => setTaskModalVisible(false)} style={styles.closeBtn}><X color="#A1A1AA" size={20} /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
                <Text style={styles.inputLabel}>ISSUE TITLE</Text>
                <TextInput value={taskForm.title} onChangeText={t => setTaskForm({...taskForm, title: t})} style={styles.input} placeholder="e.g. Implement login flow..." placeholderTextColor="#52525B" />

                <Text style={styles.inputLabel}>DESCRIPTION</Text>
                <TextInput value={taskForm.description} onChangeText={t => setTaskForm({...taskForm, description: t})} style={[styles.input, styles.textArea]} multiline textAlignVertical="top" placeholder="Acceptance criteria..." placeholderTextColor="#52525B" />

                <Text style={styles.inputLabel}>ISSUE TYPE</Text>
                <View style={styles.rowInputs}>
                  {(['Story', 'Bug', 'Tech Debt'] as TaskType[]).map(type => {
                    const isSel = taskForm.task_type === type;
                    const config = TASK_TYPE_CONFIG[type];
                    return (
                      <TouchableOpacity key={type} onPress={() => setTaskForm({...taskForm, task_type: type})} style={[styles.typeBtn, isSel && { backgroundColor: `${config.color}15`, borderColor: config.color }]}>
                        <config.icon size={14} color={isSel ? config.color : '#71717A'} />
                        <Text style={[styles.typeBtnText, { color: isSel ? config.color : '#71717A' }]}>{type}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.inputLabel}>STORY POINTS</Text>
                    <View style={styles.scrollInput}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {[1, 2, 3, 5, 8, 13].map(pt => (
                          <TouchableOpacity key={pt} onPress={() => setTaskForm({...taskForm, story_points: pt})} style={[styles.chip, taskForm.story_points === pt && styles.chipActive]}>
                            <Text style={[styles.chipText, taskForm.story_points === pt && styles.chipTextActive]}>{pt}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>SPRINT PHASE</Text>
                    <View style={styles.scrollInput}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {(['Backlog', 'Active Sprint'] as TaskPhase[]).map(ph => (
                          <TouchableOpacity key={ph} onPress={() => setTaskForm({...taskForm, sprint_phase: ph})} style={[styles.chip, taskForm.sprint_phase === ph && styles.chipActive]}>
                            <Text style={[styles.chipText, taskForm.sprint_phase === ph && styles.chipTextActive]}>{ph}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.actionRow}>
                {editingTaskId && <TouchableOpacity onPress={() => deleteTask(editingTaskId)} style={styles.deleteBtn}><Trash2 color="#EF4444" size={20} /></TouchableOpacity>}
                <TouchableOpacity onPress={handleTaskSave} disabled={isSubmitting} style={[styles.saveBtn, editingTaskId ? { width: '78%' } : { width: '100%' }, { backgroundColor: '#6366F1' }]}>
                  {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveBtnText, { color: '#FFF' }]}>{editingTaskId ? 'Update Issue' : 'Create Issue'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==========================================
  // MAIN VIEW (PROJECTS & ROADMAPS SEGMENT)
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Portfolio Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfoRow}>
            <Image source={{ uri: user?.imageUrl }} style={styles.userAvatar} />
            <View>
              <Text style={styles.greetingText}>Workspace of</Text>
              <Text style={styles.userName}>{user?.firstName || 'User'}'s Hub</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => signOut()} style={styles.signOutBtn}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.signOutText}>Secured</Text>
          </TouchableOpacity>
        </View>

        {/* View Switcher Tabs: Projects vs Roadmaps */}
        <View style={styles.mainViewSwitcher}>
          <TouchableOpacity 
            style={[styles.switchTab, activeMainView === 'PROJECTS' && styles.switchTabActive]}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveMainView('PROJECTS'); }}
          >
            <FolderKanban size={16} color={activeMainView === 'PROJECTS' ? '#FAFAFA' : '#71717A'} />
            <Text style={[styles.switchTabText, activeMainView === 'PROJECTS' && styles.switchTabTextActive]}>
              Projects ({stats.totalProjects})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.switchTab, activeMainView === 'ROADMAPS' && styles.switchTabActiveRoadmap]}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveMainView('ROADMAPS'); }}
          >
            <Map size={16} color={activeMainView === 'ROADMAPS' ? '#F59E0B' : '#71717A'} />
            <Text style={[styles.switchTabText, activeMainView === 'ROADMAPS' && styles.switchTabTextActiveRoadmap]}>
              Roadmaps ({stats.totalRoadmaps})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Stats Row */}
        {activeMainView === 'PROJECTS' ? (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.activeProjects}</Text>
              <Text style={styles.statLabel}>Active Projects</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{projects.filter(p => p.status === 'Completed').length}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalProjects}</Text>
              <Text style={styles.statLabel}>Total Projects</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.statsRow, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.totalRoadmaps}</Text>
              <Text style={styles.statLabel}>Roadmaps</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{roadmaps.filter(r => r.scenario_type === 'Likely').length}</Text>
              <Text style={styles.statLabel}>Likely Case</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{roadmaps.filter(r => r.scenario_type === 'Best Case').length}</Text>
              <Text style={styles.statLabel}>Best Case</Text>
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={20} color="#71717A" />
          <TextInput 
            style={styles.searchInput} 
            placeholder={activeMainView === 'PROJECTS' ? "Search projects by name..." : "Search macro roadmaps..."} 
            placeholderTextColor="#71717A" 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
          />
          {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><X size={16} color="#71717A" /></TouchableOpacity>}
        </View>
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {activeMainView === 'PROJECTS' ? (
            ['All', 'Planning', 'Active', 'Paused', 'Completed'].map((status) => {
              const isActive = filterProjectStatus === status;
              return (
                <TouchableOpacity 
                  key={status} style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                  onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFilterProjectStatus(status as any); }}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{status}</Text>
                </TouchableOpacity>
              );
            })
          ) : (
            ['All', 'Best Case', 'Likely', 'Worst Case'].map((scenario) => {
              const isActive = filterScenario === scenario;
              return (
                <TouchableOpacity 
                  key={scenario} style={[styles.filterBtn, isActive && styles.filterBtnActiveRoadmap]}
                  onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFilterScenario(scenario as any); }}
                >
                  <Text style={[styles.filterText, isActive && { color: '#000', fontWeight: '800' }]}>{scenario}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ========================================== */}
      {/* SECTION A: PROJECTS LIST                   */}
      {/* ========================================== */}
      {activeMainView === 'PROJECTS' && (
        filteredProjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}><FolderKanban size={40} color="#3F3F46" /></View>
            <Text style={styles.emptyTitle}>No projects found</Text>
            <Text style={styles.emptySub}>This is your private project directory. Click the + button to create a new project.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAllData(true)} tintColor="#FAFAFA" />}>
            {filteredProjects.map((project) => {
              const statConfig = STATUS_CONFIG[project.status];
              const CatIcon = CATEGORY_ICONS[project.category] || GlobeIcon;
              
              return (
                <TouchableOpacity key={project.id} activeOpacity={0.8} onPress={() => openWorkspace(project)} style={styles.projectCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.catBadge, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                      <CatIcon size={12} color="#A1A1AA" />
                      <Text style={styles.catText}>{project.category}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.statusBadge, { backgroundColor: statConfig.bg, marginRight: 8 }]}>
                        <Text style={[styles.statusText, { color: statConfig.color }]}>{project.status}</Text>
                      </View>
                      <TouchableOpacity onPress={() => openProjectModal(project)} style={styles.editProjIcon}>
                        <Edit3 size={16} color="#71717A" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
                  {project.description ? <Text style={styles.projectDesc} numberOfLines={2}>{project.description}</Text> : null}
                  
                  <View style={styles.progressSection}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>Project Progress</Text>
                      <Text style={styles.progressPercent}>{project.progress}%</Text>
                    </View>
                    <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${project.progress}%`, backgroundColor: statConfig.color }]} /></View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.dateRow}>
                      <Calendar size={14} color="#71717A" />
                      <Text style={styles.dateText}>Due: {project.target_date}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.openWorkspaceText}>Open Workspace</Text>
                      <ChevronRight size={16} color="#6366F1" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )
      )}

      {/* ========================================== */}
      {/* SECTION B: ROADMAPS LIST                  */}
      {/* ========================================== */}
      {activeMainView === 'ROADMAPS' && (
        filteredRoadmaps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}><Map size={40} color="#F59E0B" /></View>
            <Text style={styles.emptyTitle}>No roadmaps found</Text>
            <Text style={styles.emptySub}>Create a macro-level plan to forecast releases and track cross-project dependencies.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAllData(true)} tintColor="#FAFAFA" />}>
            {filteredRoadmaps.map((item) => {
              const scenarioConfig = SCENARIO_CONFIG[item.scenario_type];
              
              return (
                <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => openRoadmapModal(item)} style={styles.roadmapCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.scenarioBadge, { backgroundColor: scenarioConfig.bg, borderColor: scenarioConfig.color }]}>
                      <TrendingUp size={12} color={scenarioConfig.color} />
                      <Text style={[styles.scenarioText, { color: scenarioConfig.color }]}>{item.scenario_type}</Text>
                    </View>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>

                  <Text style={styles.roadmapTitle} numberOfLines={1}>{item.title}</Text>
                  {item.description ? <Text style={styles.roadmapDesc} numberOfLines={2}>{item.description}</Text> : null}
                  
                  {/* Timeline Forecast Track */}
                  <View style={styles.timelineSection}>
                    <View style={styles.dateRowSpace}>
                      <Text style={styles.dateLabel}>Start: {item.start_date}</Text>
                      <Text style={styles.dateLabel}>Target: {item.end_date}</Text>
                    </View>
                    <View style={styles.timelineTrack}>
                      <View style={[styles.timelineBar, { width: `${item.progress}%`, backgroundColor: '#F59E0B' }]} />
                    </View>
                    <Text style={styles.progressPercentRoadmap}>{item.progress}% Capacity Allocated</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <GitMerge size={14} color="#71717A" />
                      <Text style={styles.dependencyText}>Cross-Project Alignment</Text>
                    </View>
                    <ChevronRight size={16} color="#F59E0B" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )
      )}

      {/* Project Form Modal */}
      <Modal visible={projectModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDrag} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProjectId ? 'Edit Project' : 'New Project'}</Text>
              <TouchableOpacity onPress={() => setProjectModalVisible(false)} style={styles.closeBtn}><X color="#A1A1AA" size={20} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} bounces={false}>
              <Text style={styles.inputLabel}>PROJECT NAME</Text>
              <TextInput value={projectForm.title} onChangeText={t => setProjectForm({...projectForm, title: t})} placeholder="e.g., Marketing Redesign" placeholderTextColor="#52525B" style={styles.input} />

              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <TextInput value={projectForm.description} onChangeText={t => setProjectForm({...projectForm, description: t})} placeholder="High-level goals..." placeholderTextColor="#52525B" style={[styles.input, styles.textArea]} multiline textAlignVertical="top" />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CATEGORY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollInput}>
                    {(['Web App', 'Mobile App', 'Marketing', 'Internal'] as ProjectCategory[]).map(cat => (
                      <TouchableOpacity key={cat} onPress={() => setProjectForm({...projectForm, category: cat})} style={[styles.chip, projectForm.category === cat && styles.chipActive]}>
                        <Text style={[styles.chipText, projectForm.category === cat && styles.chipTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <Text style={styles.inputLabel}>TARGET DATE (YYYY-MM-DD)</Text>
              <TextInput value={projectForm.target_date} onChangeText={t => setProjectForm({...projectForm, target_date: t})} style={styles.input} />

              <Text style={styles.inputLabel}>STATUS</Text>
              <View style={styles.statusGrid}>
                {(['Planning', 'Active', 'Paused', 'Completed'] as ProjectStatus[]).map((status) => {
                  const isSel = projectForm.status === status;
                  const color = STATUS_CONFIG[status].color;
                  return (
                    <TouchableOpacity key={status} onPress={() => setProjectForm({...projectForm, status})} style={[styles.statusOptBtn, isSel && { backgroundColor: `${color}15`, borderColor: color }]}>
                      <View style={[styles.statusOptDot, { backgroundColor: isSel ? color : '#3F3F46' }]} />
                      <Text style={[styles.statusOptText, { color: isSel ? color : '#71717A' }]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>OVERALL PROGRESS ({projectForm.progress}%)</Text>
              <View style={styles.progressBtns}>
                {[0, 25, 50, 75, 100].map(val => (
                  <TouchableOpacity key={val} onPress={() => setProjectForm({...projectForm, progress: val})} style={[styles.progBtn, projectForm.progress === val && styles.progBtnActive]}>
                    <Text style={[styles.progBtnText, projectForm.progress === val && styles.progBtnTextActive]}>{val}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.actionRow}>
              {editingProjectId && <TouchableOpacity onPress={() => handleProjectDelete(editingProjectId)} style={styles.deleteBtn}><Trash2 color="#EF4444" size={20} /></TouchableOpacity>}
              <TouchableOpacity onPress={handleProjectSave} disabled={isSubmitting} style={[styles.saveBtn, editingProjectId ? { width: '78%' } : { width: '100%' }]}>
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{editingProjectId ? 'Update Project' : 'Create Project'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Roadmap Form Modal */}
      <Modal visible={roadmapModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDrag} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRoadmapId ? 'Edit Roadmap' : 'New Roadmap'}</Text>
              <TouchableOpacity onPress={() => setRoadmapModalVisible(false)} style={styles.closeBtn}><X color="#A1A1AA" size={20} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} bounces={false}>
              <Text style={styles.inputLabel}>ROADMAP TITLE</Text>
              <TextInput value={roadmapForm.title} onChangeText={t => setRoadmapForm({...roadmapForm, title: t})} placeholder="e.g., Q4 Enterprise Plan" placeholderTextColor="#52525B" style={styles.input} />

              <Text style={styles.inputLabel}>SCENARIO FORECAST</Text>
              <View style={styles.rowInputs}>
                {(['Best Case', 'Likely', 'Worst Case'] as ScenarioType[]).map(scen => {
                  const isSel = roadmapForm.scenario_type === scen;
                  const color = SCENARIO_CONFIG[scen].color;
                  return (
                    <TouchableOpacity key={scen} onPress={() => setRoadmapForm({...roadmapForm, scenario_type: scen})} style={[styles.typeBtn, isSel && { backgroundColor: `${color}15`, borderColor: color }]}>
                      <Text style={[styles.typeBtnText, { color: isSel ? color : '#71717A' }]}>{scen}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>START DATE</Text>
                  <TextInput value={roadmapForm.start_date} onChangeText={t => setRoadmapForm({...roadmapForm, start_date: t})} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>TARGET DATE</Text>
                  <TextInput value={roadmapForm.end_date} onChangeText={t => setRoadmapForm({...roadmapForm, end_date: t})} style={styles.input} />
                </View>
              </View>

              <Text style={styles.inputLabel}>DESCRIPTION / DEPENDENCIES</Text>
              <TextInput value={roadmapForm.description} onChangeText={t => setRoadmapForm({...roadmapForm, description: t})} placeholder="Track resources and risks..." placeholderTextColor="#52525B" style={[styles.input, styles.textArea]} multiline textAlignVertical="top" />

              <Text style={styles.inputLabel}>MACRO PROGRESS ({roadmapForm.progress}%)</Text>
              <View style={styles.progressBtns}>
                {[0, 25, 50, 75, 100].map(val => (
                  <TouchableOpacity key={val} onPress={() => setRoadmapForm({...roadmapForm, progress: val})} style={[styles.progBtn, roadmapForm.progress === val && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]}>
                    <Text style={[styles.progBtnText, roadmapForm.progress === val && { color: '#000' }]}>{val}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.actionRow}>
              {editingRoadmapId && <TouchableOpacity onPress={() => handleRoadmapDelete(editingRoadmapId)} style={styles.deleteBtn}><Trash2 color="#EF4444" size={20} /></TouchableOpacity>}
              <TouchableOpacity onPress={handleRoadmapSave} disabled={isSubmitting} style={[styles.saveBtn, editingRoadmapId ? { width: '78%' } : { width: '100%' }, { backgroundColor: '#F59E0B' }]}>
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{editingRoadmapId ? 'Update Forecast' : 'Create Roadmap'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Contextual FAB Button */}
      <TouchableOpacity 
        style={[styles.fabMain, activeMainView === 'ROADMAPS' && { backgroundColor: '#F59E0B', shadowColor: '#F59E0B' }]} 
        onPress={() => activeMainView === 'PROJECTS' ? openProjectModal() : openRoadmapModal()} 
        activeOpacity={0.8}
      >
        <Plus size={26} color="#09090B" strokeWidth={3} />
      </TouchableOpacity>

      {/* Bottom Navigation */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  loadingText: { color: '#71717A', marginTop: 16, fontSize: 14, fontWeight: '600' },
  
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#000000' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#27272A', marginRight: 12 },
  greetingText: { color: '#71717A', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  userName: { color: '#FAFAFA', fontSize: 20, fontWeight: '900' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  signOutText: { color: '#10B981', fontSize: 11, fontWeight: '800', marginLeft: 6 },
  
  mainViewSwitcher: { flexDirection: 'row', backgroundColor: '#111113', borderRadius: 16, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#27272A' },
  switchTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  switchTabActive: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#3F3F46' },
  switchTabActiveRoadmap: { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  switchTabText: { color: '#71717A', fontSize: 13, fontWeight: '800', marginLeft: 8 },
  switchTabTextActive: { color: '#FAFAFA' },
  switchTabTextActiveRoadmap: { color: '#F59E0B' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111113', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 16, borderWidth: 1, borderColor: '#27272A' },
  statBox: { alignItems: 'center' },
  statValue: { color: '#FAFAFA', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#71717A', fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 26, backgroundColor: '#27272A' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', borderRadius: 16, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: '#27272A' },
  searchInput: { flex: 1, color: '#FAFAFA', fontSize: 14, marginLeft: 10, fontWeight: '500' },
  
  filterWrapper: { borderBottomWidth: 1, borderBottomColor: '#18181B', paddingBottom: 12 },
  filterScroll: { paddingHorizontal: 20, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111113', borderWidth: 1, borderColor: '#27272A' },
  filterBtnActive: { backgroundColor: '#FAFAFA', borderColor: '#FAFAFA' },
  filterBtnActiveRoadmap: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  filterText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#000000', fontWeight: '800' },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 60 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  // Projects Cards
  projectCard: { backgroundColor: '#09090B', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1F1F22' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  catBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#27272A' },
  catText: { color: '#A1A1AA', fontSize: 10, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  editProjIcon: { padding: 4, backgroundColor: '#18181B', borderRadius: 6, borderWidth: 1, borderColor: '#27272A' },
  
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
  openWorkspaceText: { color: '#6366F1', fontSize: 12, fontWeight: '800', marginRight: 4 },

  // Roadmaps Cards
  roadmapCard: { backgroundColor: '#09090B', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1F1F22' },
  scenarioBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  scenarioText: { fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 0.5 },
  roadmapTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  roadmapDesc: { color: '#A1A1AA', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  timelineSection: { backgroundColor: '#111113', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#27272A' },
  dateRowSpace: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dateLabel: { color: '#71717A', fontSize: 11, fontWeight: '700' },
  timelineTrack: { height: 8, backgroundColor: '#18181B', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  timelineBar: { height: '100%', borderRadius: 4 },
  progressPercentRoadmap: { color: '#FAFAFA', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  dependencyText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', marginLeft: 6 },

  // Agile Workspace
  workspaceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#09090B', borderBottomWidth: 1, borderBottomColor: '#18181B' },
  backBtn: { padding: 8, backgroundColor: '#111113', borderRadius: 12, borderWidth: 1, borderColor: '#27272A' },
  workspaceHeaderCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  workspaceTitle: { color: '#FAFAFA', fontSize: 18, fontWeight: '900' },
  editProjBtn: { padding: 8, backgroundColor: '#111113', borderRadius: 12, borderWidth: 1, borderColor: '#27272A' },
  
  agileTabs: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#18181B' },
  agileTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#111113', borderRadius: 12, borderWidth: 1, borderColor: '#27272A', marginHorizontal: 4 },
  agileTabActive: { backgroundColor: '#18181B', borderColor: '#3F3F46' },
  agileTabText: { color: '#71717A', fontSize: 13, fontWeight: '800', marginLeft: 8 },
  agileTabTextActive: { color: '#FAFAFA' },
  countBadge: { marginLeft: 8, backgroundColor: '#27272A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  countText: { color: '#A1A1AA', fontSize: 10, fontWeight: '900' },

  workspaceScroll: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  sprintDashboard: { backgroundColor: '#111113', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#27272A' },
  sprintDashTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sprintDashTitle: { color: '#FAFAFA', fontSize: 14, fontWeight: '900' },
  sprintDashSub: { color: '#A1A1AA', fontSize: 12, marginTop: 2, fontWeight: '600' },
  sprintPercent: { color: '#6366F1', fontSize: 20, fontWeight: '900' },

  taskCard: { backgroundColor: '#09090B', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1F1F22' },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  taskTypeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111113', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#27272A' },
  taskTypeText: { fontSize: 10, fontWeight: '900', marginLeft: 6 },
  storyPointBadge: { backgroundColor: 'rgba(139, 92, 246, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' },
  storyPointText: { color: '#8B5CF6', fontSize: 10, fontWeight: '900' },
  
  taskStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  taskStatusText: { fontSize: 10, fontWeight: '900', marginLeft: 6 },
  
  taskTitle: { color: '#FAFAFA', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  taskDesc: { color: '#A1A1AA', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  
  taskCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#18181B' },
  taskFooterLeft: { flexDirection: 'row', alignItems: 'center' },
  storyPointBadgeMini: { backgroundColor: '#18181B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  storyPointTextMini: { color: '#A1A1AA', fontSize: 10, fontWeight: '800' },
  taskPriority: { color: '#71717A', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  
  moveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' },
  moveBtnText: { color: '#6366F1', fontSize: 11, fontWeight: '900', marginRight: 6 },

  emptyTasks: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTasksTitle: { color: '#FAFAFA', fontSize: 18, fontWeight: '900', marginTop: 16, marginBottom: 8 },
  emptyTasksSub: { color: '#71717A', fontSize: 13, textAlign: 'center', paddingHorizontal: 40, marginBottom: 20 },
  emptyTasksBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  emptyTasksBtnText: { color: '#000', fontSize: 13, fontWeight: '800', marginLeft: 8 },
  
  // Modals & Forms
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#09090B', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '92%', borderWidth: 1, borderColor: '#27272A' },
  modalDrag: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#18181B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  inputLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4, marginTop: 8 },
  input: { backgroundColor: '#111113', color: '#FAFAFA', padding: 16, borderRadius: 16, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#27272A', marginBottom: 16 },
  textArea: { height: 100, paddingTop: 16 },
  rowInputs: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  
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
  
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#111113', borderRadius: 12, borderWidth: 1, borderColor: '#27272A' },
  typeBtnText: { fontSize: 12, fontWeight: '800', marginLeft: 8 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#27272A', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, width: '20%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  saveBtn: { backgroundColor: '#FAFAFA', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#000000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  
  fabMain: { position: 'absolute', bottom: 100, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', shadowColor: '#FAFAFA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  navActiveText: { color: '#6366F1', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});