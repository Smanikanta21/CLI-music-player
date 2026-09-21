import fetch from 'node-fetch';
import Configstore from 'configstore';
import { v4 as uuidv4 } from 'uuid';

const config = new Configstore('syncbeats-terminal');
import { SERVER_URL } from './config.js';

class AuthService {
  constructor() {
    this.deviceKey = config.get('deviceKey');
    if (!this.deviceKey) {
      this.deviceKey = uuidv4();
      config.set('deviceKey', this.deviceKey);
    }
  }

  getToken() {
    return config.get('token');
  }

  setToken(token) {
    config.set('token', token);
  }

  getUser() {
    return config.get('user');
  }

  setUser(user) {
    config.set('user', user);
  }

  logout() {
    config.delete('token');
    config.delete('user');
  }

  async _request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      'user-agent': 'syncbeats-terminal/1.0.0',
      'x-device-id': this.deviceKey,
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'API Request failed');
      }
      return data;
    } catch (err) {
      throw new Error(err.message || 'Network error');
    }
  }

  async login(email, password) {
    const data = await this._request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  }

  async register(name, email, password) {
    const data = await this._request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  }

  async forgotPassword(email) {
    return await this._request('/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyResetOtp(email, otp) {
    return await this._request('/auth/password/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resetPasswordWithOtp(email, otp, password) {
    return await this._request('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password }),
    });
  }

  async getMe() {
    if (!this.getToken()) return null;
    try {
      const data = await this._request('/auth/me');
      this.setUser(data.user);
      return data;
    } catch (err) {
      this.logout();
      return null;
    }
  }

  async renameDevice(name) {
    return this._request(`/devices/${this.deviceKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }
}

export const authService = new AuthService();
