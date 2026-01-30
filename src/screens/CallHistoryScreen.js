import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import apiService from '../services/api';

const CallHistoryScreen = ({ onCallUser, currentUser }) => {
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, missed, outgoing

  const fetchHistory = useCallback(async () => {
    try {
      const callHistory = await apiService.getCallHistory(50);
      setHistory(callHistory);
    } catch (error) {
      console.error('Fetch history error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const getFilteredHistory = () => {
    switch (filter) {
      case 'missed':
        return history.filter((c) => c.status === 'missed');
      case 'outgoing':
        return history.filter((c) => c.caller === currentUser?.username);
      default:
        return history;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate()) {
      return 'Yesterday';
    }

    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[date.getDay()];
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#ffeaa7', '#dfe6e9', '#fd79a8', '#6c5ce7',
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const getCallIcon = (call) => {
    const isCaller = call.caller === currentUser?.username;

    switch (call.status) {
      case 'completed':
        return {
          icon: isCaller ? '↗' : '↙',
          color: Colors.online,
        };
      case 'missed':
        return {
          icon: '↙',
          color: Colors.callRed,
        };
      case 'rejected':
        return {
          icon: '↙',
          color: Colors.callRed,
        };
      case 'cancelled':
        return {
          icon: '↗',
          color: Colors.textLight,
        };
      default:
        return {
          icon: '↔',
          color: Colors.textLight,
        };
    }
  };

  const handleCallBack = (call, isVideo = false) => {
    const isCaller = call.caller === currentUser?.username;
    const otherUser = isCaller ? call.callee : call.caller;

    if (onCallUser) {
      onCallUser(otherUser, isVideo);
    }
  };

  const renderCall = ({ item }) => {
    const isCaller = item.caller === currentUser?.username;
    const otherUser = isCaller ? item.callee : item.caller;
    const callIcon = getCallIcon(item);
    const isMissed = item.status === 'missed' || item.status === 'rejected';

    return (
      <TouchableOpacity
        style={styles.callItem}
        onPress={() => handleCallBack(item, false)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(otherUser) }]}>
          <Text style={styles.avatarText}>
            {(otherUser || '?').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.callInfo}>
          <Text style={[styles.userName, isMissed && styles.missedText]} numberOfLines={1}>
            {otherUser}
          </Text>
          <View style={styles.statusRow}>
            <Text style={[styles.callArrow, { color: callIcon.color }]}>
              {callIcon.icon}
            </Text>
            <Text style={styles.callType}>
              {item.call_type === 'video' ? 'Video' : 'Voice'}
            </Text>
            {item.duration > 0 && (
              <Text style={styles.duration}> ({formatDuration(item.duration)})</Text>
            )}
          </View>
        </View>

        <View style={styles.rightSection}>
          <Text style={styles.time}>{formatDate(item.started_at)}</Text>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCallBack(item, false)}
          >
            <Text style={styles.callButtonIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No calls yet</Text>
      <Text style={styles.emptyText}>
        Your call history will appear here
      </Text>
    </View>
  );

  const filteredHistory = getFilteredHistory();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent</Text>
        {history.length > 0 && (
          <Text style={styles.callCount}>
            {history.length} calls
          </Text>
        )}
      </View>

      {/* Filter Tabs */}
      {history.length > 0 && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'missed' && styles.filterTabActive]}
            onPress={() => setFilter('missed')}
          >
            <Text style={[styles.filterText, filter === 'missed' && styles.filterTextActive]}>
              Missed ({history.filter((c) => c.status === 'missed').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'outgoing' && styles.filterTabActive]}
            onPress={() => setFilter('outgoing')}
          >
            <Text style={[styles.filterText, filter === 'outgoing' && styles.filterTextActive]}>
              Outgoing
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Call List */}
      <FlatList
        data={filteredHistory}
        keyExtractor={(item, index) => item.id?.toString() || `call-${index}`}
        renderItem={renderCall}
        ListEmptyComponent={!loading ? renderEmpty : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={filteredHistory.length === 0 ? styles.emptyList : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: {
    fontSize: FontSize.header,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  callCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  filterTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    marginRight: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.textWhite,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  callInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  missedText: {
    color: Colors.callRed,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  callArrow: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginRight: Spacing.xs,
  },
  callType: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  duration: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButtonIcon: {
    fontSize: 18,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 76,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default CallHistoryScreen;
