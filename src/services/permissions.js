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

  // Convert react-native-permissions result to expo-like status
  convertResult(result) {
    switch (result) {
      case RESULTS.GRANTED:
        return 'granted';
      case RESULTS.DENIED:
        return 'undetermined'; // Can still ask
      case RESULTS.BLOCKED:
        return 'denied'; // Need to go to settings
      case RESULTS.UNAVAILABLE:
        return 'denied';
      default:
        return 'undetermined';
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
      await openSettings();
    } catch (error) {
      console.error('Failed to open settings:', error);
      Alert.alert(
        'Open Settings Manually',
        'Please go to Settings > VoIP App to enable permissions.',
        [{ text: 'OK' }]
      );
    }
  }

  // Show permission denied alert
  showPermissionDeniedAlert(permissionType) {
    const permissionName = permissionType === 'microphone' ? 'Microphone' : 'Camera';

    Alert.alert(
      `${permissionName} Access Required`,
      `This app needs ${permissionName.toLowerCase()} access to make calls. Please enable it in Settings.`,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => this.openAppSettings()
        },
      ]
    );
  }

  // Check and request voice call permissions
  async requestVoiceCallPermissions() {
    const micStatus = await this.checkMicrophonePermission();

    if (micStatus === 'granted') {
      return true;
    }

    if (micStatus === 'denied') {
      this.showPermissionDeniedAlert('microphone');
      return false;
    }

    // First time asking
    const granted = await this.requestMicrophonePermission();

    if (!granted) {
      Alert.alert(
        'Cannot Make Call',
        'Microphone access is required to make voice calls.',
        [{ text: 'OK' }]
      );
    }

    return granted;
  }

  // Check and request video call permissions
  async requestVideoCallPermissions() {
    const micStatus = await this.checkMicrophonePermission();
    const camStatus = await this.checkCameraPermission();

    if (micStatus === 'granted' && camStatus === 'granted') {
      return true;
    }

    // Check if any permission is denied
    const deniedPermissions = [];
    if (micStatus === 'denied') deniedPermissions.push('microphone');
    if (camStatus === 'denied') deniedPermissions.push('camera');

    if (deniedPermissions.length > 0) {
      const permissionNames = deniedPermissions.join(' and ');
      Alert.alert(
        'Permission Required',
        `This app needs ${permissionNames} access for video calls. Please enable it in Settings.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: () => this.openAppSettings() },
        ]
      );
      return false;
    }

    // Request permissions that haven't been asked
    let allGranted = true;

    if (micStatus !== 'granted') {
      const micGranted = await this.requestMicrophonePermission();
      if (!micGranted) allGranted = false;
    }

    if (camStatus !== 'granted') {
      const camGranted = await this.requestCameraPermission();
      if (!camGranted) allGranted = false;
    }

    if (!allGranted) {
      Alert.alert(
        'Cannot Make Video Call',
        'Microphone and camera access are required for video calls.',
        [{ text: 'OK' }]
      );
    }

    return allGranted;
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
