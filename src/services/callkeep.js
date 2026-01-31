import { Platform } from 'react-native';

// Simple UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Only import RNCallKeep on iOS (Android has TurboModule issues)
let RNCallKeep = null;
if (Platform.OS === 'ios') {
  RNCallKeep = require('react-native-callkeep').default;
}

const options = {
  ios: {
    appName: 'VoIP App',
    supportsVideo: true,
    maximumCallGroups: '1',
    maximumCallsPerCallGroup: '1',
  },
  android: {
    alertTitle: 'Permissions Required',
    alertDescription: 'This app needs permission to manage calls',
    cancelButton: 'Cancel',
    okButton: 'OK',
    additionalPermissions: [],
    selfManaged: false,
  },
};

class CallKeepService {
  constructor() {
    this.currentCallId = null;
    this.isSetup = false;
    this.handlers = {};
  }

  async setup() {
    if (this.isSetup) return;

    // Only setup on iOS
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: Skipping setup on Android');
      this.isSetup = true;
      return;
    }

    try {
      await RNCallKeep.setup(options);
      RNCallKeep.setAvailable(true);
      this.isSetup = true;
      console.log('CallKeep setup successful');
    } catch (error) {
      console.error('CallKeep setup error:', error);
    }
  }

  displayIncomingCall(callerId, callerName = 'Unknown') {
    const callUUID = generateUUID();
    this.currentCallId = callUUID;

    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: displayIncomingCall (stub)', callerId);
      return callUUID;
    }

    try {
      RNCallKeep.displayIncomingCall(
        callUUID,
        callerId,
        callerName,
        'generic',
        false
      );
    } catch (error) {
      console.error('Error displaying incoming call:', error);
    }

    return callUUID;
  }

  startCall(handle, callerName = 'Unknown') {
    const callUUID = generateUUID();
    this.currentCallId = callUUID;

    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: startCall (stub)', handle);
      return callUUID;
    }

    try {
      RNCallKeep.startCall(callUUID, handle, callerName);
    } catch (error) {
      console.error('Error starting call:', error);
    }

    return callUUID;
  }

  answerCall() {
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: answerCall (stub)');
      return;
    }

    if (this.currentCallId) {
      try {
        RNCallKeep.answerIncomingCall(this.currentCallId);
      } catch (error) {
        console.error('Error answering call:', error);
      }
    }
  }

  endCall(callUUID = null) {
    const uuid = callUUID || this.currentCallId;

    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: endCall (stub)');
      this.currentCallId = null;
      return;
    }

    if (uuid) {
      try {
        RNCallKeep.endCall(uuid);
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
    this.currentCallId = null;
  }

  endAllCalls() {
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: endAllCalls (stub)');
      this.currentCallId = null;
      return;
    }

    try {
      RNCallKeep.endAllCalls();
    } catch (error) {
      console.error('Error ending all calls:', error);
    }
    this.currentCallId = null;
  }

  setCallConnected() {
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: setCallConnected (stub)');
      return;
    }

    if (this.currentCallId) {
      try {
        RNCallKeep.setCurrentCallActive(this.currentCallId);
      } catch (error) {
        console.error('Error setting call connected:', error);
      }
    }
  }

  setMuted(muted) {
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: setMuted (stub)', muted);
      return;
    }

    if (this.currentCallId) {
      try {
        RNCallKeep.setMutedCall(this.currentCallId, muted);
      } catch (error) {
        console.error('Error setting muted:', error);
      }
    }
  }

  setOnHold(hold) {
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: setOnHold (stub)', hold);
      return;
    }

    if (this.currentCallId) {
      try {
        RNCallKeep.setOnHold(this.currentCallId, hold);
      } catch (error) {
        console.error('Error setting on hold:', error);
      }
    }
  }

  registerEvents(handlers) {
    this.handlers = handlers;

    if (Platform.OS !== 'ios' || !RNCallKeep) {
      console.log('CallKeep: registerEvents (stub)');
      return;
    }

    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      console.log('CallKeep: answerCall', callUUID);
      if (handlers.onAnswer) {
        handlers.onAnswer(callUUID);
      }
    });

    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      console.log('CallKeep: endCall', callUUID);
      this.currentCallId = null;
      if (handlers.onEnd) {
        handlers.onEnd(callUUID);
      }
    });

    RNCallKeep.addEventListener(
      'didPerformSetMutedCallAction',
      ({ muted, callUUID }) => {
        console.log('CallKeep: didPerformSetMutedCallAction', muted);
        if (handlers.onMute) {
          handlers.onMute(muted, callUUID);
        }
      }
    );

    RNCallKeep.addEventListener(
      'didToggleHoldCallAction',
      ({ hold, callUUID }) => {
        console.log('CallKeep: didToggleHoldCallAction', hold);
        if (handlers.onHold) {
          handlers.onHold(hold, callUUID);
        }
      }
    );

    RNCallKeep.addEventListener(
      'didPerformDTMFAction',
      ({ digits, callUUID }) => {
        console.log('CallKeep: DTMF', digits);
        if (handlers.onDTMF) {
          handlers.onDTMF(digits, callUUID);
        }
      }
    );
  }

  removeAllListeners() {
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      this.handlers = {};
      return;
    }

    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
    RNCallKeep.removeEventListener('didToggleHoldCallAction');
    RNCallKeep.removeEventListener('didPerformDTMFAction');
    this.handlers = {};
  }

  async checkPhoneAccountEnabled() {
    if (Platform.OS !== 'ios' || !RNCallKeep) {
      return true;
    }
    return true;
  }

  getCurrentCallId() {
    return this.currentCallId;
  }
}

export default new CallKeepService();
