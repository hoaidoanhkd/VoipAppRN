import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getServerUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }
  return 'http://192.168.11.4:3000';
};

const SERVER_URL = getServerUrl();

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@voip_access_token',
  REFRESH_TOKEN: '@voip_refresh_token',
  USER: '@voip_user',
};

class AuthService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.onAuthStateChange = null;
  }

  // Khởi tạo - load tokens từ storage
  async init() {
    try {
      const [accessToken, refreshToken, userStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
      ]);

      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.user = userStr ? JSON.parse(userStr) : null;

      // Verify token còn hợp lệ
      if (this.accessToken) {
        const isValid = await this.verifyToken();
        if (!isValid) {
          // Thử refresh token
          const refreshed = await this.refreshAccessToken();
          if (!refreshed) {
            await this.clearStorage();
            return null;
          }
        }
      }

      return this.user;
    } catch (error) {
      console.error('Auth init error:', error);
      return null;
    }
  }

  // Đăng ký
  async register(username, password, displayName = null) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, displayName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đăng ký thất bại');
      }

      await this.saveAuthData(data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Đăng nhập
  async login(username, password) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại');
      }

      await this.saveAuthData(data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Đăng xuất
  async logout() {
    try {
      if (this.accessToken) {
        await fetch(`${SERVER_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await this.clearStorage();
      if (this.onAuthStateChange) {
        this.onAuthStateChange(null);
      }
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${SERVER_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        return false;
      }

      this.accessToken = data.accessToken;
      this.user = data.user;

      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));

      return true;
    } catch (error) {
      console.error('Refresh token error:', error);
      return false;
    }
  }

  // Verify token
  async verifyToken() {
    if (!this.accessToken) return false;

    try {
      const response = await fetch(`${SERVER_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.user = data.user;
      return true;
    } catch (error) {
      return false;
    }
  }

  // Lưu auth data
  async saveAuthData(data) {
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.user = data.user;

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken),
      AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken),
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
    ]);

    if (this.onAuthStateChange) {
      this.onAuthStateChange(data.user);
    }
  }

  // Xóa storage
  async clearStorage() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER),
    ]);
  }

  // Cập nhật profile
  async updateProfile(displayName, avatarUrl) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({ displayName, avatarUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Cập nhật thất bại');
      }

      this.user = data.user;
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));

      return data.user;
    } catch (error) {
      throw error;
    }
  }

  // Đổi password
  async changePassword(oldPassword, newPassword) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đổi mật khẩu thất bại');
      }

      // Force re-login sau khi đổi password
      await this.clearStorage();

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Getters
  getAccessToken() {
    return this.accessToken;
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return !!this.accessToken && !!this.user;
  }

  // Authorized fetch wrapper
  async authorizedFetch(url, options = {}) {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.accessToken}`,
    };

    let response = await fetch(url, { ...options, headers });

    // Nếu 401, thử refresh token
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    return response;
  }
}

export default new AuthService();
