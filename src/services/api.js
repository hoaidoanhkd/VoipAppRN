import { Platform } from 'react-native';
import authService from './auth';

const getServerUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }
  return 'http://192.168.11.4:3000';
};

const SERVER_URL = getServerUrl();

class ApiService {
  // Lấy danh sách users online
  async getOnlineUsers() {
    try {
      const response = await fetch(`${SERVER_URL}/users`);
      const data = await response.json();
      return data.users || [];
    } catch (error) {
      console.error('Get online users error:', error);
      return [];
    }
  }

  // Kiểm tra user có online không
  async checkUserStatus(userId) {
    try {
      const response = await fetch(`${SERVER_URL}/users/${userId}/status`);
      const data = await response.json();
      return data.online;
    } catch (error) {
      console.error('Check user status error:', error);
      return false;
    }
  }

  // Lấy lịch sử cuộc gọi
  async getCallHistory(limit = 50) {
    try {
      const response = await authService.authorizedFetch(
        `${SERVER_URL}/calls/history?limit=${limit}`
      );

      if (!response.ok) {
        throw new Error('Không thể lấy lịch sử cuộc gọi');
      }

      const data = await response.json();
      return data.history || [];
    } catch (error) {
      console.error('Get call history error:', error);
      return [];
    }
  }

  // Lấy thống kê cuộc gọi
  async getCallStats() {
    try {
      const response = await authService.authorizedFetch(`${SERVER_URL}/calls/stats`);

      if (!response.ok) {
        throw new Error('Không thể lấy thống kê');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Get call stats error:', error);
      return null;
    }
  }

  // Lấy thông tin server
  async getServerInfo() {
    try {
      const response = await fetch(`${SERVER_URL}/`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Get server info error:', error);
      return null;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${SERVER_URL}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export default new ApiService();
