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
});

export default HomeScreen;
