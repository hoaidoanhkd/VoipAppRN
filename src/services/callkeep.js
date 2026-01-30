import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';

// Simple UUID generator (không cần crypto)
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const options = {
  ios: {
    appName: 'VoIP App',
    supportsVideo: false,
    maximumCallGroups: '1',
    maximumCallsPerCallGroup: '1',
  },
  android: {
    alertTitle: 'Cấp quyền',
    alertDescription: 'Ứng dụng cần quyền để quản lý cuộc gọi',
    cancelButton: 'Hủy',
    okButton: 'Đồng ý',
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

    try {
      await RNCallKeep.setup(options);
      RNCallKeep.setAvailable(true);
      this.isSetup = true;
      console.log('CallKeep setup successful');
    } catch (error) {
      console.error('CallKeep setup error:', error);
      // Không throw error vì CallKeep không bắt buộc phải hoạt động
    }
  }

  // Hiển thị cuộc gọi đến (native UI)
  displayIncomingCall(callerId, callerName = 'Unknown') {
    const callUUID = generateUUID();
    this.currentCallId = callUUID;

    try {
      RNCallKeep.displayIncomingCall(
        callUUID,
        callerId,
        callerName,
        'generic',
        false // hasVideo
      );
    } catch (error) {
      console.error('Error displaying incoming call:', error);
    }

    return callUUID;
  }

  // Bắt đầu cuộc gọi đi
  startCall(handle, callerName = 'Unknown') {
    const callUUID = generateUUID();
    this.currentCallId = callUUID;

    try {
      RNCallKeep.startCall(callUUID, handle, callerName);
    } catch (error) {
      console.error('Error starting call:', error);
    }

    return callUUID;
  }

  // Báo cuộc gọi được trả lời
  answerCall() {
    if (this.currentCallId) {
      try {
        RNCallKeep.answerIncomingCall(this.currentCallId);
      } catch (error) {
        console.error('Error answering call:', error);
      }
    }
  }

  // Kết thúc cuộc gọi
  endCall(callUUID = null) {
    const uuid = callUUID || this.currentCallId;
    if (uuid) {
      try {
        RNCallKeep.endCall(uuid);
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
    this.currentCallId = null;
  }

  // Kết thúc tất cả cuộc gọi
  endAllCalls() {
    try {
      RNCallKeep.endAllCalls();
    } catch (error) {
      console.error('Error ending all calls:', error);
    }
    this.currentCallId = null;
  }

  // Cập nhật trạng thái cuộc gọi đã kết nối
  setCallConnected() {
    if (this.currentCallId) {
      try {
        RNCallKeep.setCurrentCallActive(this.currentCallId);
      } catch (error) {
        console.error('Error setting call connected:', error);
      }
    }
  }

  // Toggle mute
  setMuted(muted) {
    if (this.currentCallId) {
      try {
        RNCallKeep.setMutedCall(this.currentCallId, muted);
      } catch (error) {
        console.error('Error setting muted:', error);
      }
    }
  }

  // Toggle hold
  setOnHold(hold) {
    if (this.currentCallId) {
      try {
        RNCallKeep.setOnHold(this.currentCallId, hold);
      } catch (error) {
        console.error('Error setting on hold:', error);
      }
    }
  }

  // Đăng ký event handlers
  registerEvents(handlers) {
    this.handlers = handlers;

    // Khi user trả lời từ native UI
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      console.log('CallKeep: answerCall', callUUID);
      if (handlers.onAnswer) {
        handlers.onAnswer(callUUID);
      }
    });

    // Khi user kết thúc từ native UI
    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      console.log('CallKeep: endCall', callUUID);
      this.currentCallId = null;
      if (handlers.onEnd) {
        handlers.onEnd(callUUID);
      }
    });

    // Khi user toggle mute từ native UI
    RNCallKeep.addEventListener(
      'didPerformSetMutedCallAction',
      ({ muted, callUUID }) => {
        console.log('CallKeep: didPerformSetMutedCallAction', muted);
        if (handlers.onMute) {
          handlers.onMute(muted, callUUID);
        }
      }
    );

    // Khi user toggle hold từ native UI
    RNCallKeep.addEventListener(
      'didToggleHoldCallAction',
      ({ hold, callUUID }) => {
        console.log('CallKeep: didToggleHoldCallAction', hold);
        if (handlers.onHold) {
          handlers.onHold(hold, callUUID);
        }
      }
    );

    // Khi audio route thay đổi (speaker/earpiece)
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

  // Xóa tất cả listeners
  removeAllListeners() {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
    RNCallKeep.removeEventListener('didToggleHoldCallAction');
    RNCallKeep.removeEventListener('didPerformDTMFAction');
    this.handlers = {};
  }

  // Kiểm tra xem thiết bị có hỗ trợ CallKeep không
  async checkPhoneAccountEnabled() {
    if (Platform.OS === 'android') {
      return await RNCallKeep.checkPhoneAccountEnabled();
    }
    return true;
  }

  // Lấy call ID hiện tại
  getCurrentCallId() {
    return this.currentCallId;
  }
}

export default new CallKeepService();
