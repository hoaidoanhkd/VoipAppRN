import { io } from 'socket.io-client';
import { Platform } from 'react-native';

// Tự động chọn URL phù hợp
// - Web: sử dụng localhost
// - Mobile: sử dụng IP máy tính (thay đổi IP bên dưới)
const getServerUrl = () => {
  if (Platform.OS === 'web') {
    // Web browser có thể dùng localhost
    return 'http://localhost:3000';
  }
  // Mobile cần IP thật của máy tính
  // Thay đổi IP này thành IP máy tính của bạn
  return 'http://192.168.11.4:3000';
};

const SIGNALING_SERVER = getServerUrl();

class SocketService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.token = null;
    this.isConnected = false;
  }

  connect(userId, token = null) {
    return new Promise((resolve, reject) => {
      this.userId = userId;
      this.token = token;

      this.socket = io(SIGNALING_SERVER, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: {
          token: token,
        },
      });

      this.socket.on('connect', () => {
        console.log('Connected to signaling server');
        this.isConnected = true;
        this.socket.emit('register', userId);
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        this.isConnected = false;
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        this.isConnected = true;
        this.socket.emit('register', userId);
      });
    });
  }

  // Gọi đi
  call(calleeId, offer, isVideo = false) {
    if (this.socket && this.isConnected) {
      this.socket.emit('call', {
        callerId: this.userId,
        calleeId,
        offer,
        isVideo,
      });
    }
  }

  // Trả lời cuộc gọi
  answer(callerId, answer) {
    if (this.socket && this.isConnected) {
      this.socket.emit('answer', {
        callerId,
        calleeId: this.userId,
        answer,
      });
    }
  }

  // Gửi ICE candidate
  sendIceCandidate(targetId, candidate) {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice-candidate', {
        senderId: this.userId,
        targetId,
        candidate,
      });
    }
  }

  // Kết thúc cuộc gọi
  endCall(targetId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('end-call', {
        senderId: this.userId,
        targetId,
      });
    }
  }

  // Từ chối cuộc gọi
  rejectCall(callerId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('reject-call', {
        callerId,
        calleeId: this.userId,
      });
    }
  }

  // Lắng nghe cuộc gọi đến
  onIncomingCall(callback) {
    if (this.socket) {
      this.socket.on('incoming-call', callback);
    }
  }

  // Lắng nghe answer
  onCallAnswered(callback) {
    if (this.socket) {
      this.socket.on('call-answered', callback);
    }
  }

  // Lắng nghe ICE candidate
  onIceCandidate(callback) {
    if (this.socket) {
      this.socket.on('ice-candidate', callback);
    }
  }

  // Lắng nghe kết thúc cuộc gọi
  onCallEnded(callback) {
    if (this.socket) {
      this.socket.on('call-ended', callback);
    }
  }

  // Lắng nghe từ chối cuộc gọi
  onCallRejected(callback) {
    if (this.socket) {
      this.socket.on('call-rejected', callback);
    }
  }

  // Lắng nghe user online/offline
  onUserStatusChange(callback) {
    if (this.socket) {
      this.socket.on('user-status', callback);
    }
  }

  // Xóa tất cả listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.off('incoming-call');
      this.socket.off('call-answered');
      this.socket.off('ice-candidate');
      this.socket.off('call-ended');
      this.socket.off('call-rejected');
      this.socket.off('user-status');
    }
  }

  // Ngắt kết nối
  disconnect() {
    if (this.socket) {
      this.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Kiểm tra trạng thái kết nối
  getConnectionStatus() {
    return this.isConnected;
  }

  // Lấy user ID hiện tại
  getCurrentUserId() {
    return this.userId;
  }
}

export default new SocketService();
