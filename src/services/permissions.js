import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

class PermissionService {
  constructor() {
    this.microphoneGranted = false;
    this.cameraGranted = false;
  }

  // Get platform-specific permission constants
  getMicrophonePermission() {
    return Platform.OS === 'ios'
      ? PERMISSIONS.IOS.MICROPHONE
      : PERMISSIONS.ANDROID.RECORD_AUDIO;
  }

  getCameraPermission() {
    return Platform.OS === 'ios'
      ? PERMISSIONS.IOS.CAMERA
      : PERMISSIONS.ANDROID.CAMERA;
  }

  // Check microphone permission
  async checkMicrophonePermission() {
    try {
      const result = await check(this.getMicrophonePermission());
      this.microphoneGranted = result === RESULTS.GRANTED;
      return this.convertResult(result);
    } catch (error) {
      console.error('Check microphone permission error:', error);
      return 'undetermined';
    }
  }

  // Check camera permission
  async checkCameraPermission() {
    try {
      const result = await check(this.getCameraPermission());
      this.cameraGranted = result === RESULTS.GRANTED;
      return this.convertResult(result);
    } catch (error) {
      console.error('Check camera permission error:', error);
      return 'undetermined';
    }
  }

  // Convert react-native-permissions result to status
  convertResult(result) {
    switch (result) {
      case RESULTS.GRANTED:
        return 'granted';
      case RESULTS.DENIED:
        return 'denied'; // Can still ask on Android
      case RESULTS.BLOCKED:
        return 'blocked'; // Need to go to settings
      case RESULTS.UNAVAILABLE:
        return 'unavailable';
      default:
        return 'denied';
    }
  }

  // Request microphone permission
  async requestMicrophonePermission() {
    try {
      const result = await request(this.getMicrophonePermission());
      this.microphoneGranted = result === RESULTS.GRANTED;
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Request microphone permission error:', error);
      return false;
    }
  }

  // Request camera permission
  async requestCameraPermission() {
    try {
      const result = await request(this.getCameraPermission());
      this.cameraGranted = result === RESULTS.GRANTED;
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Request camera permission error:', error);
      return false;
    }
  }

  // Open app settings directly
  async openAppSettings() {
    try {
      if (Platform.OS === 'android') {
        // Android: Use native module to open permissions page directly
        const { NativeModules } = require('react-native');
        const { PermissionSettings } = NativeModules;

        if (PermissionSettings) {
          await PermissionSettings.openAppPermissions();
        } else {
          // Fallback if native module not available
          await Linking.openSettings();
        }
      } else {
        // iOS: use react-native-permissions
        await openSettings();
      }
    } catch (error) {
      console.error('Failed to open settings:', error);
      // Fallback to standard method
      try {
        await Linking.openSettings();
      } catch (e) {
        Alert.alert(
          'Open Settings Manually',
          Platform.OS === 'android'
            ? 'Go to Settings > Apps > VoipAppRN > Permissions'
            : 'Go to Settings > VoIP App',
          [{ text: 'OK' }]
        );
      }
    }
  }

  // Show permission denied alert
  showPermissionDeniedAlert(permissionType) {
    const permissionName = permissionType === 'microphone' ? 'Microphone' : 'Camera';

    const message = Platform.OS === 'android'
      ? `This app needs ${permissionName.toLowerCase()} access to make calls.\n\nAfter opening, tap "Permissions" → enable ${permissionName}.`
      : `This app needs ${permissionName.toLowerCase()} access to make calls. Please enable it in Settings.`;

    Alert.alert(
      `${permissionName} Access Required`,
      message,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => this.openAppSettings()
        },
      ]
    );
  }

  // Check and request voice call permissions (same flow for iOS and Android)
  async requestVoiceCallPermissions() {
    const micStatus = await this.checkMicrophonePermission();

    if (micStatus === 'granted') {
      return true;
    }

    // Permission not granted - show custom dialog with Open Settings (like iOS)
    this.showPermissionDeniedAlert('microphone');
    return false;
  }

  // Check and request video call permissions (same flow for iOS and Android)
  async requestVideoCallPermissions() {
    const micStatus = await this.checkMicrophonePermission();
    const camStatus = await this.checkCameraPermission();

    if (micStatus === 'granted' && camStatus === 'granted') {
      return true;
    }

    // Permission not granted - show custom dialog with Open Settings
    const missingPermissions = [];
    if (micStatus !== 'granted') missingPermissions.push('microphone');
    if (camStatus !== 'granted') missingPermissions.push('camera');

    const permissionNames = missingPermissions.join(' and ');
    const message = `This app needs ${permissionNames} access for video calls. Please enable it in Settings.`;

    Alert.alert(
      'Permission Required',
      message,
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Open Settings', onPress: () => this.openAppSettings() },
      ]
    );
    return false;
  }

  // Check permissions for incoming calls
  async requestIncomingCallPermissions(isVideo = false) {
    if (isVideo) {
      return await this.requestVideoCallPermissions();
    } else {
      return await this.requestVoiceCallPermissions();
    }
  }
}

export default new PermissionService();
