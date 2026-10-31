import { create } from 'zustand';
import { CallState, ICallPeer, IMediaDeviceOption } from '../types/videoCall.js';
import { webrtcService } from '../services/webrtcService.js';
import { getSocket } from '../services/socket.js';

interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  avatarColor?: string;
  projectId: string;
}

interface VideoCallStoreState {
  callId: string | null;
  status: CallState;
  peer: ICallPeer | null;
  peers: ICallPeer[];
  remoteStreams: Record<string, MediaStream>;
  isCaller: boolean;
  startTime: number | null;
  durationSeconds: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isFullscreen: boolean;
  isMinimized: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  incomingCall: IncomingCallData | null;
  audioInputDevices: IMediaDeviceOption[];
  videoInputDevices: IMediaDeviceOption[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  errorMessage: string | null;

  // Actions
  initiateCall: (targetUser: { id: string; username: string; avatarColor?: string }, projectId: string) => Promise<void>;
  invitePeerToCall: (targetUser: { id: string; username: string; avatarColor?: string }, projectId: string) => Promise<void>;
  addPeer: (peer: ICallPeer) => void;
  removePeer: (userId: string) => void;
  handleIncomingCall: (data: IncomingCallData) => void;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  switchAudioDevice: (deviceId: string) => Promise<void>;
  switchVideoDevice: (deviceId: string) => Promise<void>;
  setIsMinimized: (isMinimized: boolean) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  clearCall: () => void;
  refreshDevices: () => Promise<void>;
}

let timerInterval: any = null;
let ringtoneOscillator: OscillatorNode | null = null;
let audioCtx: AudioContext | null = null;

function playRingtone() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
    ringtoneOscillator = osc;
  } catch {
    // Ignore audio autoplay restrictions
  }
}

function stopRingtone() {
  try {
    if (ringtoneOscillator) {
      ringtoneOscillator.stop();
      ringtoneOscillator = null;
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close();
      audioCtx = null;
    }
  } catch {
    // Ignore
  }
}

export const useVideoCallStore = create<VideoCallStoreState>((set, get) => ({
  callId: null,
  status: 'idle',
  peer: null,
  peers: [],
  remoteStreams: {},
  isCaller: false,
  startTime: null,
  durationSeconds: 0,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  isFullscreen: false,
  isMinimized: false,
  localStream: null,
  remoteStream: null,
  incomingCall: null,
  audioInputDevices: [],
  videoInputDevices: [],
  selectedAudioDeviceId: '',
  selectedVideoDeviceId: '',
  errorMessage: null,

  refreshDevices: async () => {
    const { audioInputs, videoInputs } = await webrtcService.getDevices();
    set({
      audioInputDevices: audioInputs,
      videoInputDevices: videoInputs,
      selectedAudioDeviceId: audioInputs[0]?.deviceId || '',
      selectedVideoDeviceId: videoInputs[0]?.deviceId || '',
    });
  },

  addPeer: (newPeer) => {
    set((state) => {
      const exists = state.peers.some((p) => p.userId === newPeer.userId);
      const nextPeers = exists ? state.peers : [...state.peers, newPeer];
      return {
        peers: nextPeers,
        peer: state.peer || newPeer,
      };
    });
  },

  removePeer: (userId) => {
    webrtcService.closePeer(userId);
    set((state) => {
      const nextPeers = state.peers.filter((p) => p.userId !== userId);
      const nextStreams = { ...state.remoteStreams };
      delete nextStreams[userId];
      return {
        peers: nextPeers,
        peer: nextPeers[0] || null,
        remoteStreams: nextStreams,
        remoteStream: Object.values(nextStreams)[0] || null,
      };
    });
  },

  invitePeerToCall: async (targetUser, projectId) => {
    const { callId } = get();
    if (!callId) return;

    const socket = getSocket();
    const newPeer: ICallPeer = {
      userId: targetUser.id,
      username: targetUser.username,
      avatarColor: targetUser.avatarColor || '#38bdf8',
    };

    get().addPeer(newPeer);

    // Send invitation with active callId
    socket?.emit('call:invite', {
      targetUserId: targetUser.id,
      projectId,
      callId,
      callerName: targetUser.username,
      avatarColor: targetUser.avatarColor,
    });

    // Initialize WebRTC peer connection
    webrtcService.initPeerConnection(callId, targetUser.id);
    await webrtcService.createOffer(callId, targetUser.id);
  },

  initiateCall: async (targetUser, projectId) => {
    const socket = getSocket();
    if (!socket) return;

    const primaryPeer: ICallPeer = {
      userId: targetUser.id,
      username: targetUser.username,
      avatarColor: targetUser.avatarColor,
    };

    set({
      status: 'calling',
      peer: primaryPeer,
      peers: [primaryPeer],
      remoteStreams: {},
      isCaller: true,
      errorMessage: null,
      durationSeconds: 0,
      isMinimized: false,
    });

    try {
      // 1. Start local camera/mic
      const localStream = await webrtcService.startLocalMedia();
      set({ localStream });
      await get().refreshDevices();

      // Configure multi-stream callbacks
      webrtcService.onRemoteStream = (stream, peerId) => {
        set((state) => {
          const nextStreams = { ...state.remoteStreams, [peerId]: stream };
          return {
            remoteStreams: nextStreams,
            remoteStream: stream,
            status: 'connected',
          };
        });
      };

      webrtcService.onPeerLeft = (peerId) => {
        get().removePeer(peerId);
      };

      webrtcService.onConnectionStateChange = (state, peerId) => {
        if (state === 'connected') {
          if (!get().startTime) {
            const now = Date.now();
            set({ startTime: now, status: 'connected' });
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
              set((s) => ({ durationSeconds: s.durationSeconds + 1 }));
            }, 1000);
          }
        }
      };

      // 2. Emit private call:invite through socket
      socket.emit(
        'call:invite',
        {
          targetUserId: targetUser.id,
          projectId,
          callerName: targetUser.username,
          avatarColor: targetUser.avatarColor,
        },
        async (res: { success: boolean; callId?: string; error?: string }) => {
          if (!res?.success || !res?.callId) {
            get().endCall();
            set({ errorMessage: res?.error || 'Failed to connect call' });
            return;
          }

          set({ callId: res.callId });

          // 3. Init WebRTC PeerConnection for target user
          webrtcService.initPeerConnection(res.callId, targetUser.id);
          await webrtcService.createOffer(res.callId, targetUser.id);
        }
      );
    } catch (err: any) {
      set({ status: 'error', errorMessage: err.message });
      webrtcService.endSession();
    }
  },

  handleIncomingCall: (data) => {
    // Only accept incoming if currently idle
    if (get().status !== 'idle') {
      const socket = getSocket();
      socket?.emit('call:reject', {
        callId: data.callId,
        targetUserId: data.callerId,
        reason: 'User is busy on another call',
      });
      return;
    }

    const callerPeer: ICallPeer = {
      userId: data.callerId,
      username: data.callerName,
      avatarColor: data.avatarColor,
    };

    set({
      incomingCall: data,
      status: 'incoming',
      peer: callerPeer,
      peers: [callerPeer],
      remoteStreams: {},
      callId: data.callId,
    });

    playRingtone();
  },

  acceptCall: async () => {
    stopRingtone();
    const { incomingCall } = get();
    if (!incomingCall) return;

    const socket = getSocket();
    const callerPeer: ICallPeer = {
      userId: incomingCall.callerId,
      username: incomingCall.callerName,
      avatarColor: incomingCall.avatarColor,
    };

    set({
      status: 'calling',
      isCaller: false,
      incomingCall: null,
      peer: callerPeer,
      peers: [callerPeer],
      remoteStreams: {},
      errorMessage: null,
    });

    try {
      const localStream = await webrtcService.startLocalMedia();
      set({ localStream });
      await get().refreshDevices();

      webrtcService.onRemoteStream = (stream, peerId) => {
        set((state) => {
          const nextStreams = { ...state.remoteStreams, [peerId]: stream };
          return {
            remoteStreams: nextStreams,
            remoteStream: stream,
            status: 'connected',
          };
        });
      };

      webrtcService.onPeerLeft = (peerId) => {
        get().removePeer(peerId);
      };

      webrtcService.onConnectionStateChange = (state) => {
        if (state === 'connected') {
          if (!get().startTime) {
            set({ startTime: Date.now(), status: 'connected' });
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
              set((s) => ({ durationSeconds: s.durationSeconds + 1 }));
            }, 1000);
          }
        }
      };

      webrtcService.initPeerConnection(incomingCall.callId, incomingCall.callerId);

      // Emit accept signal to caller
      socket?.emit('call:accept', {
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId,
      });
    } catch (err: any) {
      set({ status: 'error', errorMessage: err.message });
      webrtcService.endSession();
    }
  },

  rejectCall: (reason = 'Call declined') => {
    stopRingtone();
    const { incomingCall } = get();
    if (incomingCall) {
      const socket = getSocket();
      socket?.emit('call:reject', {
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId,
        reason,
      });
    }
    get().clearCall();
  },

  endCall: () => {
    stopRingtone();
    clearInterval(timerInterval);
    const { callId, peers, durationSeconds } = get();
    const socket = getSocket();

    if (callId && socket) {
      peers.forEach((p) => {
        socket.emit('call:end', {
          callId,
          targetUserId: p.userId,
          durationSeconds,
        });
      });
    }

    webrtcService.endSession();
    set({
      status: 'ended',
      localStream: null,
      remoteStream: null,
      remoteStreams: {},
      isScreenSharing: false,
    });

    setTimeout(() => {
      get().clearCall();
    }, 1500);
  },

  toggleMute: () => {
    const next = !get().isMuted;
    webrtcService.toggleMicrophone(!next);
    set({ isMuted: next });
  },

  toggleVideo: async () => {
    const next = !get().isVideoOff;
    await webrtcService.toggleCamera(!next);
    const stream = webrtcService.getLocalStream();
    set({ isVideoOff: next, localStream: stream || get().localStream });
  },

  toggleScreenShare: async () => {
    const next = !get().isScreenSharing;
    const isSharing = await webrtcService.toggleScreenShare(next);
    set({ isScreenSharing: isSharing });
  },

  switchAudioDevice: async (deviceId) => {
    await webrtcService.switchAudioDevice(deviceId);
    set({ selectedAudioDeviceId: deviceId });
  },

  switchVideoDevice: async (deviceId) => {
    await webrtcService.switchVideoDevice(deviceId);
    set({ selectedVideoDeviceId: deviceId });
  },

  setIsMinimized: (isMinimized) => set({ isMinimized }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),

  clearCall: () => {
    stopRingtone();
    clearInterval(timerInterval);
    webrtcService.endSession();
    set({
      callId: null,
      status: 'idle',
      peer: null,
      peers: [],
      remoteStreams: {},
      isCaller: false,
      startTime: null,
      durationSeconds: 0,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isFullscreen: false,
      isMinimized: false,
      localStream: null,
      remoteStream: null,
      incomingCall: null,
      errorMessage: null,
    });
  },
}));
