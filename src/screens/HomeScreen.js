import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';

const HomeScreen = ({ user, onNavigateToCallDetail, connectionStatus }) => {
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
        <Text style={styles.headerTitle}>Home</Text>
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

      {/* Main Action Section */}
      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>通話履歴</Text>
        <Text style={styles.sectionSubtitle}>Call History Details</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onNavigateToCallDetail()}
          activeOpacity={0.8}
        >
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>📋</Text>
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>通話履歴詳細</Text>
            <Text style={styles.actionDesc}>View call history detail</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📞</Text>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Total Calls</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⏱️</Text>
          <Text style={styles.statValue}>45m</Text>
          <Text style={styles.statLabel}>Talk Time</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📥</Text>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Incoming</Text>
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
  actionSection: {
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#e8f5f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
  },
  actionContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  actionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 28,
    color: Colors.textSecondary,
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});

export default HomeScreen;
