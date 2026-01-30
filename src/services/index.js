import { Platform } from 'react-native';

// Platform-specific imports
let webrtcService;
let callkeepService;

if (Platform.OS === 'web') {
  webrtcService = require('./webrtc.web').default;
  callkeepService = require('./callkeep.web').default;
} else {
  webrtcService = require('./webrtc').default;
  callkeepService = require('./callkeep').default;
}

export { webrtcService, callkeepService };
export { default as socketService } from './socket';
