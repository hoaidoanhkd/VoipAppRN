import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import authService from '../services/auth';

const ProfileScreen = ({ user, onLogout, onProfileUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [loading, setLoading] = useState(false);

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const getAvatarColor = (name) => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#ffeaa7', '#dfe6e9', '#fd79a8', '#6c5ce7',
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const updatedUser = await authService.updateProfile(displayName, null);
      if (onProfileUpdate) {
        onProfileUpdate(updatedUser);
      }
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(oldPassword, newPassword);
      Alert.alert('Success', 'Password changed. Please sign in again.', [
        {
          text: 'OK',
          onPress: () => {
            if (onLogout) onLogout();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          if (onLogout) onLogout();
        },
      },
    ]);
  };

  const avatarName = user?.display_name || user?.username || '?';

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Profile Card */}
      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => !editing && setEditing(true)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(avatarName) }]}>
          <Text style={styles.avatarText}>
            {avatarName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              style={styles.editInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor={Colors.textLight}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setEditing(false);
                  setDisplayName(user?.display_name || '');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{user?.display_name || user?.username}</Text>
            <Text style={styles.username}>@{user?.username}</Text>
          </View>
        )}

        {!editing && (
          <Text style={styles.chevron}>›</Text>
        )}
      </TouchableOpacity>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionCard}>
          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>🆔</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>ID</Text>
              <Text style={styles.menuValue}>{user?.id}</Text>
            </View>
          </View>

          <View style={styles.menuDivider} />

          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>👤</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Username</Text>
              <Text style={styles.menuValue}>{user?.username}</Text>
            </View>
          </View>

          <View style={styles.menuDivider} />

          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>📅</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Created</Text>
              <Text style={styles.menuValue}>
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-US')
                  : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.menuDivider} />

          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>🕐</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Last Login</Text>
              <Text style={styles.menuValue}>
                {user?.last_login
                  ? new Date(user.last_login).toLocaleString('en-US')
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowPasswordChange(!showPasswordChange)}
          >
            <Text style={styles.menuIcon}>🔒</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Change Password</Text>
            </View>
            <Text style={[styles.chevron, showPasswordChange && styles.chevronDown]}>›</Text>
          </TouchableOpacity>

          {showPasswordChange && (
            <View style={styles.passwordForm}>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={Colors.textLight}
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={Colors.textLight}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={styles.changePasswordBtn}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                ) : (
                  <Text style={styles.changePasswordText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Logout Button */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>VoIP Messenger v2.1.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: {
    fontSize: FontSize.header,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  displayName: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  username: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: FontSize.xxl,
    color: Colors.textLight,
    fontWeight: '300',
  },
  chevronDown: {
    transform: [{ rotate: '90deg' }],
  },
  editForm: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  editInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  editButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    color: Colors.textWhite,
    fontWeight: '600',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginLeft: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: Colors.background,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  menuIcon: {
    fontSize: 20,
    width: 32,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  menuValue: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 56,
  },
  passwordForm: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  changePasswordBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  changePasswordText: {
    color: Colors.textWhite,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  logoutBtn: {
    backgroundColor: Colors.background,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.callRed,
    fontSize: FontSize.lg,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textLight,
    fontSize: FontSize.sm,
  },
});

export default ProfileScreen;
