// CallKeep Mock cho Web Browser
// Web không hỗ trợ CallKeep nên tạo mock

class CallKeepService {
  constructor() {
    this.currentCallId = null;
    this.isSetup = false;
    this.handlers = {};
  }

  async setup() {
    this.isSetup = true;
    console.log('CallKeep (Web Mock): Setup complete');
    return true;
  }

  displayIncomingCall(callerId, callerName = 'Unknown') {
    const callUUID = `web-${Date.now()}`;
    this.currentCallId = callUUID;
    console.log('CallKeep (Web Mock): Incoming call from', callerName);

    // Trên web, có thể sử dụng Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Cuộc gọi đến', {
        body: `Từ: ${callerName}`,
        icon: '/assets/icon.png',
        requireInteraction: true,
      });
    }

    return callUUID;
  }

  startCall(handle, callerName = 'Unknown') {
    const callUUID = `web-${Date.now()}`;
    this.currentCallId = callUUID;
    console.log('CallKeep (Web Mock): Starting call to', handle);
    return callUUID;
  }

  answerCall() {
    console.log('CallKeep (Web Mock): Call answered');
  }

  endCall(callUUID = null) {
    console.log('CallKeep (Web Mock): Call ended');
    this.currentCallId = null;
  }

  endAllCalls() {
    console.log('CallKeep (Web Mock): All calls ended');
    this.currentCallId = null;
  }

  setCallConnected() {
    console.log('CallKeep (Web Mock): Call connected');
  }

  setMuted(muted) {
    console.log('CallKeep (Web Mock): Muted =', muted);
  }

  setOnHold(hold) {
    console.log('CallKeep (Web Mock): On hold =', hold);
  }

  registerEvents(handlers) {
    this.handlers = handlers;
    console.log('CallKeep (Web Mock): Events registered');
  }

  removeAllListeners() {
    this.handlers = {};
  }

  async checkPhoneAccountEnabled() {
    return true;
  }

  getCurrentCallId() {
    return this.currentCallId;
  }
}

export default new CallKeepService();
