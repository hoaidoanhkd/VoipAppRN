import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  Vibration,
  Platform,
  ActivityIndicator,
} from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { Colors, Spacing, FontSize, BorderRadius } from './src/theme/colors';

// Platform-specific imports
let webrtcService, callkeepService;
if (Platform.OS === 'web') {
  webrtcService = require('./src/services/webrtc.web').default;
  callkeepService = require('./src/services/callkeep.web').default;
} else {
  webrtcService = require('./src/services/webrtc').default;
  callkeepService = require('./src/services/callkeep').default;
}
import socketService from './src/services/socket';
import authService from './src/services/auth';
import permissionService from './src/services/permissions';

// Screens
import {
  AuthScreen,
  HomeScreen,
  ContactsScreen,
  CallHistoryScreen,
  ProfileScreen,
  RecordingsScreen,
} from './src/screens';

// Tabs
const TABS = {
  HOME: 'home',
  CONTACTS: 'contacts',
  HISTORY: 'history',
  RECORDINGS: 'recordings',
  PROFILE: 'profile',
};

// Call states
const CALL_STATE = {
  IDLE: 'idle',
  CALLING: 'calling',
  INCOMING: 'incoming',
  CONNECTED: 'connected',
};

export default function App() {
  // Auth state
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Navigation state
  const [activeTab, setActiveTab] = useState(TABS.HOME);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Call state
  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCallerId, setIncomingCallerId] = useState(null);
  const [isVideoCall, setIsVideoCall] = useState(false);

  // Refs
  const targetIdRef = useRef('');
  const incomingOfferRef = useRef(null);
  const callTimerRef = useRef(null);
  const ringtoneRef = useRef(null);

  // Initialize auth
  useEffect(() => {
    initializeApp();
    return () => cleanup();
  }, []);

  // Call timer
  useEffect(() => {
    if (callState === CALL_STATE.CONNECTED) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState]);

  // Initialize app
  const initializeApp = async () => {
    try {
      // Load auth state
      const savedUser = await authService.init();
      if (savedUser) {
        setUser(savedUser);
        // Connect to socket
        await connectToServer(savedUser);
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to signaling server
  const connectToServer = async (userData) => {
    try {
      setConnectionStatus('connecting');

      const token = authService.getAccessToken();
      await socketService.connect(userData.username, token);
      setConnectionStatus('connected');

      // Setup CallKeep
      await callkeepService.setup();

      // Setup socket listeners
      socketService.onIncomingCall(handleIncomingCall);
      socketService.onCallAnswered(handleCallAnswered);
      socketService.onIceCandidate(handleIceCandidate);
      socketService.onCallEnded(handleCallEnded);
      socketService.onCallRejected(handleCallRejected);

      // Setup audio
      await setupAudio();
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus('disconnected');
    }
  };

  // Cleanup resources
  const cleanup = () => {
    stopRingtone();
    socketService.disconnect();
    webrtcService.endCall();
    callkeepService.endAllCalls();
    if (Platform.OS !== 'web') {
      InCallManager.stop();
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
  };

  // Setup audio
  const setupAudio = async () => {
    if (Platform.OS === 'web') return;

    try {
      InCallManager.start({ media: 'audio' });
      InCallManager.setForceSpeakerphoneOn(isSpeaker);
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  // Play ringtone
  const playRingtone = async () => {
    try {
      if (Platform.OS !== 'web') {
        Vibration.vibrate([500, 500, 500], true);
      }
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  };

  // Stop ringtone
  const stopRingtone = () => {
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
    if (ringtoneRef.current) {
      ringtoneRef.current.unloadAsync();
      ringtoneRef.current = null;
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get avatar color
  const getAvatarColor = (name) => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#ffeaa7', '#dfe6e9', '#fd79a8', '#6c5ce7',
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  // === Call Handlers ===

  const handleIncomingCall = useCallback(({ callerId, offer, isVideo }) => {
    console.log('Incoming call from:', callerId);
    setIncomingCallerId(callerId);
    setIsVideoCall(isVideo || false);
    incomingOfferRef.current = offer;
    targetIdRef.current = callerId;
    setCallState(CALL_STATE.INCOMING);
    playRingtone();
    callkeepService.displayIncomingCall(callerId, callerId);
  }, []);

  const handleCallAnswered = useCallback(async ({ answer }) => {
    console.log('Call answered');
    try {
      await webrtcService.handleAnswer(answer);
      setCallState(CALL_STATE.CONNECTED);
      callkeepService.setCallConnected();
    } catch (error) {
      console.error('Error handling answer:', error);
      handleEndCall();
    }
  }, []);

  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      await webrtcService.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  const handleCallEnded = useCallback(() => {
    console.log('Call ended by remote');
    resetCallState();
    Alert.alert('Notice', 'Call ended');
  }, []);

  const handleCallRejected = useCallback(() => {
    console.log('Call rejected');
    resetCallState();
    Alert.alert('Notice', 'Call was declined');
  }, []);

  const resetCallState = () => {
    stopRingtone();
    webrtcService.endCall();
    callkeepService.endAllCalls();
    if (Platform.OS !== 'web') {
      InCallManager.stop();
    }
    setCallState(CALL_STATE.IDLE);
    setIsMuted(false);
    setIsVideoCall(false);
    setIncomingCallerId(null);
    incomingOfferRef.current = null;
  };

  // Start call
  const startCall = async (targetId, isVideo = false) => {
    if (!targetId.trim()) {
      Alert.alert('Error', 'Please enter recipient ID');
      return;
    }

    // Check permissions before calling
    const hasPermission = isVideo
      ? await permissionService.requestVideoCallPermissions()
      : await permissionService.requestVoiceCallPermissions();

    if (!hasPermission) {
      return;
    }

    targetIdRef.current = targetId;
    setIsVideoCall(isVideo);
    setCallState(CALL_STATE.CALLING);

    try {
      await webrtcService.initialize();
      await webrtcService.getLocalStream(isVideo);

      webrtcService.onIceCandidate = (candidate) => {
        socketService.sendIceCandidate(targetIdRef.current, candidate);
      };

      webrtcService.onConnectionStateChange = (state) => {
        console.log('Connection state changed:', state);
        if (state === 'connected') {
          setCallState(CALL_STATE.CONNECTED);
        } else if (state === 'disconnected' || state === 'failed') {
          handleEndCall();
        }
      };

      const offer = await webrtcService.createOffer();
      socketService.call(targetId, offer, isVideo);
      callkeepService.startCall(targetId, targetId);
    } catch (error) {
      console.error('Error starting call:', error);
      resetCallState();
      Alert.alert('Error', 'Could not start call');
    }
  };

  // Accept call
  const acceptCall = async () => {
    stopRingtone();

    // Check permissions before answering
    const hasPermission = await permissionService.requestIncomingCallPermissions(isVideoCall);

    if (!hasPermission) {
      // Reject call if no permission
      rejectCall();
      return;
    }

    try {
      await webrtcService.initialize();
      await webrtcService.getLocalStream(isVideoCall);

      webrtcService.onIceCandidate = (candidate) => {
        socketService.sendIceCandidate(targetIdRef.current, candidate);
      };

      webrtcService.onConnectionStateChange = (state) => {
        console.log('Connection state changed:', state);
        if (state === 'disconnected' || state === 'failed') {
          handleEndCall();
        }
      };

      const answer = await webrtcService.createAnswer(incomingOfferRef.current);
      socketService.answer(incomingCallerId, answer);

      setCallState(CALL_STATE.CONNECTED);
      callkeepService.answerCall();
      callkeepService.setCallConnected();
    } catch (error) {
      console.error('Error accepting call:', error);
      resetCallState();
      Alert.alert('Error', 'Could not answer call');
    }
  };

  // Reject call
  const rejectCall = () => {
    stopRingtone();
    socketService.rejectCall(incomingCallerId);
    resetCallState();
  };

  // End call
  const handleEndCall = () => {
    socketService.endCall(targetIdRef.current);
    resetCallState();
  };

  // Toggle mute
  const toggleMute = () => {
    const muted = webrtcService.toggleMute();
    setIsMuted(muted);
    callkeepService.setMuted(muted);
  };

  // Toggle speaker
  const toggleSpeaker = async () => {
    const newSpeakerState = !isSpeaker;
    setIsSpeaker(newSpeakerState);

    if (Platform.OS === 'web') return;

    try {
      InCallManager.setForceSpeakerphoneOn(newSpeakerState);
    } catch (error) {
      console.error('Error toggling speaker:', error);
    }
  };

  // === Auth Handlers ===

  const handleAuthSuccess = async (userData) => {
    setUser(userData);
    await connectToServer(userData);
  };

  const handleLogout = () => {
    setUser(null);
    cleanup();
    setConnectionStatus('disconnected');
    setActiveTab(TABS.HOME);
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  // === RENDER ===

  // Loading screen
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoIcon}>📞</Text>
          </View>
          <Text style={styles.loadingTitle}>VoIP Messenger</Text>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  // Auth screen
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      </SafeAreaView>
    );
  }

  // Incoming call screen
  if (callState === CALL_STATE.INCOMING) {
    const callerName = incomingCallerId || '?';
    return (
      <SafeAreaView style={styles.callContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
        <View style={styles.callScreen}>
          <View style={styles.callHeader}>
            <Text style={styles.callHeaderText}>
              {isVideoCall ? 'Incoming Video Call' : 'Incoming Call'}
            </Text>
          </View>

          <View style={styles.callerInfo}>
            <View style={[styles.callAvatar, { backgroundColor: getAvatarColor(callerName) }]}>
              <Text style={styles.callAvatarText}>
                {callerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.callerName}>{callerName}</Text>
            <Text style={styles.callStatus}>Ringing...</Text>
          </View>

          <View style={styles.incomingActions}>
            <TouchableOpacity
              style={styles.incomingActionBtn}
              onPress={rejectCall}
            >
              <View style={[styles.actionCircle, styles.rejectCircle]}>
                <Text style={styles.actionCircleIcon}>📞</Text>
              </View>
              <Text style={styles.actionText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.incomingActionBtn}
              onPress={acceptCall}
            >
              <View style={[styles.actionCircle, styles.acceptCircle]}>
                <Text style={styles.actionCircleIcon}>📞</Text>
              </View>
              <Text style={styles.actionText}>Answer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Active call screen
  if (callState === CALL_STATE.CALLING || callState === CALL_STATE.CONNECTED) {
    const targetName = targetIdRef.current || '?';
    return (
      <SafeAreaView style={styles.callContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
        <View style={styles.callScreen}>
          <View style={styles.callHeader}>
            <Text style={styles.callHeaderText}>
              {isVideoCall ? 'Video Call' : 'Voice Call'}
            </Text>
          </View>

          <View style={styles.callerInfo}>
            <View style={[styles.callAvatar, { backgroundColor: getAvatarColor(targetName) }]}>
              <Text style={styles.callAvatarText}>
                {targetName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.callerName}>{targetName}</Text>
            <Text style={styles.callStatus}>
              {callState === CALL_STATE.CALLING
                ? 'Calling...'
                : formatDuration(callDuration)}
            </Text>
          </View>

          <View style={styles.callControls}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={toggleMute}
            >
              <View style={[styles.controlCircle, isMuted && styles.controlCircleActive]}>
                <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
              </View>
              <Text style={styles.controlText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleEndCall}
            >
              <View style={[styles.controlCircle, styles.endCallCircle]}>
                <Text style={styles.controlIcon}>📞</Text>
              </View>
              <Text style={styles.controlText}>End</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={toggleSpeaker}
            >
              <View style={[styles.controlCircle, isSpeaker && styles.controlCircleActive]}>
                <Text style={styles.controlIcon}>{isSpeaker ? '🔊' : '🔈'}</Text>
              </View>
              <Text style={styles.controlText}>{isSpeaker ? 'Earpiece' : 'Speaker'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Main app with tabs
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Main Content */}
      <View style={styles.mainContent}>
        {activeTab === TABS.HOME && (
          <HomeScreen
            user={user}
            onStartCall={startCall}
            connectionStatus={connectionStatus}
          />
        )}
        {activeTab === TABS.CONTACTS && (
          <ContactsScreen
            currentUser={user}
            onCallUser={startCall}
          />
        )}
        {activeTab === TABS.HISTORY && (
          <CallHistoryScreen
            currentUser={user}
            onCallUser={startCall}
          />
        )}
        {activeTab === TABS.RECORDINGS && (
          <RecordingsScreen />
        )}
        {activeTab === TABS.PROFILE && (
          <ProfileScreen
            user={user}
            onLogout={handleLogout}
            onProfileUpdate={handleProfileUpdate}
          />
        )}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab(TABS.HOME)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === TABS.HOME && styles.tabIconActive]}>📞</Text>
          <Text style={[styles.tabLabel, activeTab === TABS.HOME && styles.tabLabelActive]}>
            Calls
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab(TABS.CONTACTS)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === TABS.CONTACTS && styles.tabIconActive]}>👥</Text>
          <Text style={[styles.tabLabel, activeTab === TABS.CONTACTS && styles.tabLabelActive]}>
            Contacts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab(TABS.HISTORY)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === TABS.HISTORY && styles.tabIconActive]}>🕐</Text>
          <Text style={[styles.tabLabel, activeTab === TABS.HISTORY && styles.tabLabelActive]}>
            Recent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab(TABS.RECORDINGS)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === TABS.RECORDINGS && styles.tabIconActive]}>🎵</Text>
          <Text style={[styles.tabLabel, activeTab === TABS.RECORDINGS && styles.tabLabelActive]}>
            Mixer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab(TABS.PROFILE)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === TABS.PROFILE && styles.tabIconActive]}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === TABS.PROFILE && styles.tabLabelActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingLogo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  loadingLogoIcon: {
    fontSize: 48,
  },
  loadingTitle: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Main Content
  mainContent: {
    flex: 1,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.tabBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  tabIconActive: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: FontSize.xs,
    color: Colors.tabInactive,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: Colors.tabActive,
    fontWeight: '600',
  },

  // Call Screen
  callContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  callScreen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  callHeader: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  callHeaderText: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  callerInfo: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: -60,
  },
  callAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  callAvatarText: {
    fontSize: 48,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  callerName: {
    fontSize: FontSize.xxl,
    color: Colors.textWhite,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  callStatus: {
    fontSize: FontSize.lg,
    color: 'rgba(255,255,255,0.6)',
  },

  // Incoming Call Actions
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: 60,
  },
  incomingActionBtn: {
    alignItems: 'center',
  },
  actionCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  rejectCircle: {
    backgroundColor: Colors.callRed,
    transform: [{ rotate: '135deg' }],
  },
  acceptCircle: {
    backgroundColor: Colors.callGreen,
  },
  actionCircleIcon: {
    fontSize: 28,
    color: Colors.textWhite,
  },
  actionText: {
    fontSize: FontSize.sm,
    color: Colors.textWhite,
    fontWeight: '500',
  },

  // Call Controls
  callControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 60,
  },
  controlBtn: {
    alignItems: 'center',
  },
  controlCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  controlCircleActive: {
    backgroundColor: Colors.primary,
  },
  endCallCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.callRed,
    transform: [{ rotate: '135deg' }],
  },
  controlIcon: {
    fontSize: 24,
  },
  controlText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
});
