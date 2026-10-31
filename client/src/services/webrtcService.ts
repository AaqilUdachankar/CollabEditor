import { getSocket } from './socket.js';
import { IMediaDeviceOption } from '../types/videoCall.js';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private cameraTrack: MediaStreamTrack | null = null;

  public onRemoteStream?: (stream: MediaStream, peerId: string) => void;
  public onPeerLeft?: (peerId: string) => void;
  public onConnectionStateChange?: (state: RTCPeerConnectionState, peerId: string) => void;
  public onError?: (error: string) => void;

  async getDevices(): Promise<{ audioInputs: IMediaDeviceOption[]; videoInputs: IMediaDeviceOption[] }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs: IMediaDeviceOption[] = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));

      const videoInputs: IMediaDeviceOption[] = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));

      return { audioInputs, videoInputs };
    } catch {
      return { audioInputs: [], videoInputs: [] };
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(peerId?: string): MediaStream | null {
    if (peerId) return this.remoteStreams.get(peerId) || null;
    const first = this.remoteStreams.values().next();
    return first.done ? null : first.value;
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  async startLocalMedia(audioDeviceId?: string, videoDeviceId?: string): Promise<MediaStream> {
    if (this.localStream && this.localStream.active) {
      return this.localStream;
    }

    this.stopLocalMedia();

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
    };

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: 'user',
      ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

      this.localStream = stream;
      this.cameraTrack = stream.getVideoTracks()[0] || null;
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
          this.localStream = audioOnly;
          return audioOnly;
        } catch {
          throw new Error('Camera and Microphone access was denied. Please allow permissions in browser.');
        }
      }
      throw new Error(`Media error: ${err.message || 'Could not start camera'}`);
    }
  }

  initPeerConnection(callId: string, targetUserId: string): RTCPeerConnection {
    // If an existing connection for this peer exists, close it
    if (this.peerConnections.has(targetUserId)) {
      this.peerConnections.get(targetUserId)?.close();
      this.peerConnections.delete(targetUserId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(targetUserId, pc);

    // Attach local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote tracks received
    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(targetUserId);
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else {
        if (!stream) {
          stream = new MediaStream();
        }
        stream.addTrack(event.track);
      }
      this.remoteStreams.set(targetUserId, stream);
      this.onRemoteStream?.(stream, targetUserId);
    };

    // Forward ICE candidates to target user
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('call:ice-candidate', {
          callId,
          targetUserId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state listeners
    pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(pc.connectionState, targetUserId);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.closePeer(targetUserId);
      }
    };

    return pc;
  }

  async createOffer(callId: string, targetUserId: string): Promise<RTCSessionDescriptionInit> {
    let pc = this.peerConnections.get(targetUserId);
    if (!pc) {
      pc = this.initPeerConnection(callId, targetUserId);
    }

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await pc.setLocalDescription(offer);

    const socket = getSocket();
    socket?.emit('call:offer', {
      callId,
      targetUserId,
      sdp: offer,
    });

    return offer;
  }

  async handleOffer(
    callId: string,
    callerId: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    let pc = this.peerConnections.get(callerId);
    if (!pc) {
      pc = this.initPeerConnection(callId, callerId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const socket = getSocket();
    socket?.emit('call:answer', {
      callId,
      targetUserId: callerId,
      sdp: answer,
    });

    return answer;
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit, responderId?: string): Promise<void> {
    let pc: RTCPeerConnection | undefined;
    if (responderId) {
      pc = this.peerConnections.get(responderId);
    }
    if (!pc) {
      // Fallback to first available peer
      pc = this.peerConnections.values().next().value;
    }
    if (!pc) return;

    if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit, senderId?: string): Promise<void> {
    let pc: RTCPeerConnection | undefined;
    if (senderId) {
      pc = this.peerConnections.get(senderId);
    }
    if (!pc) {
      pc = this.peerConnections.values().next().value;
    }
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err: any) {
      console.warn('[WebRTC Candidate Error]', err.message);
    }
  }

  toggleMicrophone(enabled: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  async toggleCamera(enabled: boolean): Promise<boolean> {
    if (!this.localStream) return false;
    let videoTrack = this.localStream.getVideoTracks()[0];

    // If enabling camera, ensure track is alive
    if (enabled && (!videoTrack || videoTrack.readyState === 'ended')) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: 'user',
          },
        });
        const newTrack = stream.getVideoTracks()[0];
        if (newTrack) {
          if (videoTrack) {
            this.localStream.removeTrack(videoTrack);
            videoTrack.stop();
          }
          this.localStream.addTrack(newTrack);
          this.cameraTrack = newTrack;
          videoTrack = newTrack;

          // Replace track in all active peer connections
          for (const pc of this.peerConnections.values()) {
            const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(newTrack);
            }
          }
        }
      } catch (err: any) {
        console.warn('[Re-acquiring camera track failed]', err.message);
      }
    }

    if (videoTrack) {
      videoTrack.enabled = enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  async toggleScreenShare(enable: boolean): Promise<boolean> {
    if (this.peerConnections.size === 0) return false;

    if (enable) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        this.screenStream = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in all active peer connections
        for (const pc of this.peerConnections.values()) {
          const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          }
        }

        screenTrack.onended = () => {
          this.toggleScreenShare(false);
        };

        return true;
      } catch (err: any) {
        console.warn('[Screen Share Cancelled/Error]', err.message);
        return false;
      }
    } else {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((t) => t.stop());
        this.screenStream = null;
      }

      if (this.cameraTrack) {
        for (const pc of this.peerConnections.values()) {
          const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(this.cameraTrack);
          }
        }
      }

      return false;
    }
  }

  async switchAudioDevice(deviceId: string): Promise<void> {
    if (!deviceId) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const newAudioTrack = newStream.getAudioTracks()[0];

      if (this.localStream) {
        const oldTrack = this.localStream.getAudioTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        this.localStream.addTrack(newAudioTrack);
      }

      for (const pc of this.peerConnections.values()) {
        const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(newAudioTrack);
        }
      }
    } catch (err: any) {
      console.warn('[Switch Audio Device Error]', err.message);
    }
  }

  async switchVideoDevice(deviceId: string): Promise<void> {
    if (!deviceId) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        this.localStream.addTrack(newVideoTrack);
        this.cameraTrack = newVideoTrack;
      }

      for (const pc of this.peerConnections.values()) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }
    } catch (err: any) {
      console.warn('[Switch Video Device Error]', err.message);
    }
  }

  closePeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.remoteStreams.delete(peerId);
    this.onPeerLeft?.(peerId);
  }

  stopLocalMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
    this.cameraTrack = null;
  }

  closePeerConnections(): void {
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.remoteStreams.clear();
  }

  endSession(): void {
    this.stopLocalMedia();
    this.closePeerConnections();
  }
}

export const webrtcService = new WebRTCService();
