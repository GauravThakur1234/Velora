import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, SafeAreaView, 
  ActivityIndicator, TextInput, Alert, StatusBar, 
  StyleSheet, KeyboardAvoidingView, Platform, Image 
} from 'react-native';
import { useUser, useAuth } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { 
  LogOut, Camera, User as UserIcon, Mail, Shield, 
  Bell, Moon, ChevronRight, CheckCircle2, ShieldCheck,
  LayoutGrid, ProjectorIcon, Calendar, Users, HomeIcon
} from 'lucide-react-native';
import { Link, useRouter, Redirect } from 'expo-router';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut, isSignedIn } = useAuth();
  const router = useRouter();

  // Local State for Forms
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  
  // Loading States
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // Sync state if user data loads slightly after component mounts
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    }
  }, [user]);

  // --- FEATURE: Upload Profile Picture ---
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to allow camera roll permissions to change your avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Force square crop
        quality: 0.2,   // Compress for fast upload
        base64: true,   // Required for Clerk
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsUploadingImg(true);
        await user?.setProfileImage({
          file: `data:image/jpeg;base64,${result.assets[0].base64}`
        });
        Alert.alert('Looking good!', 'Profile picture updated successfully.');
      }
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Something went wrong while uploading.');
    } finally {
      setIsUploadingImg(false);
    }
  };

  // --- FEATURE: Update Name ---
  const handleUpdateProfile = async () => {
    if (!firstName.trim()) {
      return Alert.alert('Validation Error', 'First name cannot be empty.');
    }

    try {
      setIsUpdating(true);
      await user?.update({
        firstName,
        lastName,
      });
      Alert.alert('Success', 'Your profile details have been securely updated.');
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Could not update profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- FEATURE: Secure Sign Out & Redirect ---
  const handleSignOut = () => {
    Alert.alert('Secure Sign Out', 'Are you sure you want to securely log out of your workspace?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Log Out', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await signOut();
            // Force route to authentication page immediately after clearing session
            router.replace('/(auth)/authentication');
          } catch (error) {
            console.error('Error signing out:', error);
          }
        } 
      }
    ]);
  };

  // --- Security Fallback: If page mounts but user is logged out, redirect immediately ---
  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/authentication" />;
  }

  if (!isLoaded) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.flex1}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
        >
          
          {/* Header Section */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Account Settings</Text>
              <View style={styles.securedBadge}>
                <ShieldCheck size={12} color="#10B981" />
                <Text style={styles.securedText}>Managed by Clerk Auth</Text>
              </View>
            </View>
          </View>

          {/* --- Profile Image Upload Section --- */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarWrapper}>
              <Image 
                source={{ uri: user?.imageUrl }} 
                style={styles.avatarImage} 
              />
              {isUploadingImg ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#FAFAFA" />
                </View>
              ) : (
                <View style={styles.cameraIconBadge}>
                  <Camera size={16} color="#FAFAFA" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.avatarEmail}>{user?.primaryEmailAddress?.emailAddress}</Text>
          </View>

          {/* --- Personal Information Form --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
            <View style={styles.card}>
              
              {/* First Name */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <UserIcon size={14} color="#71717A" />
                  <Text style={styles.inputLabel}>FIRST NAME</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor="#52525B"
                />
              </View>

              {/* Last Name */}
              <View style={[styles.inputGroup, styles.noMargin]}>
                <View style={styles.inputLabelRow}>
                  <UserIcon size={14} color="#71717A" />
                  <Text style={styles.inputLabel}>LAST NAME</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                  placeholderTextColor="#52525B"
                />
              </View>

              <TouchableOpacity 
                style={styles.updateBtn} 
                onPress={handleUpdateProfile}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.updateBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Read Only Contact Details --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
            <View style={styles.card}>
              <View style={styles.readOnlyRow}>
                <View style={styles.readOnlyLeft}>
                  <Mail size={20} color="#6366F1" />
                  <View style={styles.readOnlyTextWrap}>
                    <Text style={styles.readOnlyLabel}>Primary Email</Text>
                    <Text style={styles.readOnlyValue}>{user?.primaryEmailAddress?.emailAddress}</Text>
                  </View>
                </View>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>VERIFIED</Text>
                </View>
              </View>
            </View>
          </View>

          {/* --- App Preferences --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>APP PREFERENCES</Text>
            <View style={styles.card}>
              
              <TouchableOpacity style={styles.menuRow}>
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Bell size={18} color="#F59E0B" />
                  </View>
                  <Text style={styles.menuText}>Push Notifications</Text>
                </View>
                <ChevronRight size={20} color="#3F3F46" />
              </TouchableOpacity>
              
              <View style={styles.divider} />

              <TouchableOpacity style={styles.menuRow}>
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Moon size={18} color="#10B981" />
                  </View>
                  <Text style={styles.menuText}>Dark Mode</Text>
                </View>
                <View style={styles.activeLabelBadge}><Text style={styles.activeLabelText}>ENABLED</Text></View>
              </TouchableOpacity>
              
              <View style={styles.divider} />

              <TouchableOpacity style={styles.menuRow}>
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                    <Shield size={18} color="#6366F1" />
                  </View>
                  <Text style={styles.menuText}>Security & Privacy</Text>
                </View>
                <ChevronRight size={20} color="#3F3F46" />
              </TouchableOpacity>

            </View>
          </View>

          {/* --- Danger Zone --- */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
              <LogOut size={20} color="#EF4444" />
              <Text style={styles.logoutBtnText}>Secure Sign Out</Text>
            </TouchableOpacity>
            <Text style={styles.versionText}>Projecter App v2.4.0 (Enterprise)</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

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
         
         {/* ACTIVE STATE: Settings/Profile */}
         <View style={styles.navActiveItem}>
            <UserIcon size={20} color="#6366F1" />
            <Text style={styles.navActiveText}>Profile</Text>
         </View>
      </View>
    </SafeAreaView>
  );
}

// --- Ultra-Premium Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex1: { flex: 1 },
  centerContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  
  // Header
  header: { marginBottom: 32 },
  headerTitle: { color: '#FAFAFA', fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  securedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  securedText: { color: '#10B981', fontSize: 11, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  
  // Avatar Section
  avatarSection: { alignItems: 'center', marginBottom: 40 },
  avatarWrapper: { position: 'relative', marginBottom: 16, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10 },
  avatarImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: '#27272A', backgroundColor: '#111113' },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, backgroundColor: '#6366F1', borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#000000' },
  avatarName: { color: '#FAFAFA', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  avatarEmail: { color: '#71717A', fontSize: 14, fontWeight: '500' },
  
  // Sections
  section: { marginBottom: 32 },
  sectionTitle: { color: '#71717A', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginLeft: 8 },
  card: { backgroundColor: '#111113', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#1F1F22' },
  
  // Forms
  inputGroup: { marginBottom: 20 },
  noMargin: { marginBottom: 0 },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 4 },
  inputLabel: { color: '#A1A1AA', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginLeft: 6 },
  input: { backgroundColor: '#09090B', color: '#FAFAFA', padding: 16, borderRadius: 16, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#27272A' },
  
  updateBtn: { flexDirection: 'row', backgroundColor: '#FAFAFA', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  updateBtnText: { color: '#000000', fontWeight: '900', fontSize: 16 },

  // Read-only Row
  readOnlyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readOnlyLeft: { flexDirection: 'row', alignItems: 'center' },
  readOnlyTextWrap: { marginLeft: 16 },
  readOnlyLabel: { color: '#71717A', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  readOnlyValue: { color: '#FAFAFA', fontSize: 15, fontWeight: '600' },
  verifiedBadge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  verifiedText: { color: '#10B981', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  // Menus
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  menuText: { color: '#FAFAFA', fontSize: 15, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1F1F22', marginVertical: 12 },
  activeLabelBadge: { backgroundColor: '#27272A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  activeLabelText: { color: '#A1A1AA', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Danger Zone
  logoutBtn: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', marginBottom: 24 },
  logoutBtnText: { color: '#EF4444', fontWeight: '900', fontSize: 16, marginLeft: 10 },
  versionText: { color: '#52525B', fontSize: 11, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272A', paddingVertical: Platform.OS === 'ios' ? 20 : 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomTab: { alignItems: 'center', width: 60 },
  bottomTabText: { color: '#71717A', fontSize: 10, marginTop: 6, fontWeight: '600' },
  navActiveItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  navActiveText: { color: '#6366F1', fontSize: 12, fontWeight: '800', marginLeft: 8 }
});