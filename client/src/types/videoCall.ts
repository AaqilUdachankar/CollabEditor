export type CallState =
  | 'idle'
  | 'calling'
  | 'incoming'
  | 'connected'
  | 'ended'
  | 'rejected'
  | 'error';

export interface ICallPeer {
  userId: string;
  username: string;
  avatarColor?: string;
}

export interface IMediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface IVideoCallSession {
  callId: string;
  peer: ICallPeer;
  isCaller: boolean;
  status: CallState;
  startTime: number | null;
  durationSeconds: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isFullscreen: boolean;
  isMinimized: boolean;
  audioInputDevices: IMediaDeviceOption[];
  videoInputDevices: IMediaDeviceOption[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  errorMessage?: string;
}
