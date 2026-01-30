import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const HomeScreen = ({ user, onStartCall, connectionStatus }) => {
  const [targetUserId, setTargetUserId] = useState('');

  const handleCall = (isVideo = false) => {
    if (!targetUserId.trim()) return;
    if (onStartCall) {
      onStartCall(targetUserId.trim(), isVideo);
    }
  };

  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: Colors.online, text: 'Connected' };
      case 'connecting':
        return { color: '#ff9500', text: 'Connecting...' };
      case 'disconnected':
        return { color: Colors.callRed, text: 'Disconnected' };
      default:
        return { color: Colors.textLight, text: 'Unknown' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calls</Text>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={styles.statusText}>{statusInfo.text}</Text>
        </View>
      </View>

      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(user?.display_name || user?.username || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.display_name || user?.username}</Text>
          <Text style={styles.userId}>@{user?.username}</Text>
        </View>
      </View>

      {/* Quick Call Section */}
      <View style={styles.callSection}>
        <Text style={styles.sectionTitle}>Quick Call</Text>
        <Text style={styles.sectionSubtitle}>Enter user ID to call directly</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter recipient ID..."
            placeholderTextColor={Colors.textLight}
            value={targetUserId}
            onChangeText={setTargetUserId}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.callButtons}>
          <TouchableOpacity
            style={[styles.callButton, styles.voiceButton]}
            onPress={() => handleCall(false)}
            disabled={!targetUserId.trim() || connectionStatus !== 'connected'}
            activeOpacity={0.8}
          >
            <Text style={styles.callButtonIcon}>📞</Text>
            <Text style={styles.callButtonText}>Voice Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.callButton, styles.videoButton]}
            onPress={() => handleCall(true)}
            disabled={!targetUserId.trim() || connectionStatus !== 'connected'}
            activeOpacity={0.8}
          >
            <Text style={styles.callButtonIcon}>📹</Text>
            <Text style={styles.callButtonText}>Video Call</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tips Section */}
      <View style={styles.tipsSection}>
        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            Go to Contacts tab to see online users
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>📋</Text>
          <Text style={styles.tipText}>
            Check Recent tab for call history
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: {
    fontSize: FontSize.header,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  userInfo: {
    marginLeft: Spacing.lg,
    flex: 1,
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  userId: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  callSection: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  callButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  voiceButton: {
    backgroundColor: Colors.callGreen,
  },
  videoButton: {
    backgroundColor: Colors.primary,
  },
  callButtonIcon: {
    fontSize: 20,
  },
  callButtonText: {
    color: Colors.textWhite,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  tipsSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  tipIcon: {
    fontSize: 16,
    marginRight: Spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

export default HomeScreen;
