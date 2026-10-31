import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Monitor,
  Maximize2,
  Minimize2,
  Settings,
  UserPlus,
  Users,
  X,
  Check,
} from 'lucide-react';
import { useVideoCallStore } from '../../stores/videoCallStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { api } from '../../services/api.js';
import { ICallPeer } from '../../types/videoCall.js';

// Individual remote peer video item
const RemotePeerTile: React.FC<{
  peer: ICallPeer;
  stream?: MediaStream;
}> = ({ peer, stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '1px solid #27272a',
        borderRadius: 8,
      }}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#a1a1aa' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: peer.avatarColor || '#3b82f6',
              color: 'white',
              fontSize: 18,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            {peer.username.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{peer.username}</div>
          <div style={{ fontSize: 10, color: '#eab308' }}>Connecting audio/video...</div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: stream ? '#22c55e' : '#eab308' }} />
        <span>{peer.username}</span>
      </div>
    </div>
  );
};

export const VideoCallModal: React.FC = () => {
  const {
    callId,
    status,
    peer,
    peers,
    remoteStreams,
    durationSeconds,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isFullscreen,
    isMinimized,
    localStream,
    remoteStream,
    audioInputDevices,
    videoInputDevices,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    switchAudioDevice,
    switchVideoDevice,
    setIsFullscreen,
    setIsMinimized,
    endCall,
    invitePeerToCall,
    errorMessage,
  } = useVideoCallStore();

  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const singleRemoteVideoRef = useRef<HTMLVideoElement>(null);
  const minimizedVideoRef = useRef<HTMLVideoElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [invitedMembers, setInvitedMembers] = useState<Set<string>>(new Set());

  // Window coordinates for draggable floating window
  const [pos, setPos] = useState({ x: window.innerWidth - 480, y: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Attach and play local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      if (!isVideoOff) {
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream, status, isVideoOff]);

  // Single remote stream effect (when only 1 remote peer)
  useEffect(() => {
    if (singleRemoteVideoRef.current && remoteStream) {
      if (singleRemoteVideoRef.current.srcObject !== remoteStream) {
        singleRemoteVideoRef.current.srcObject = remoteStream;
      }
      singleRemoteVideoRef.current.play().catch(() => {});
    }
    if (minimizedVideoRef.current && remoteStream) {
      if (minimizedVideoRef.current.srcObject !== remoteStream) {
        minimizedVideoRef.current.srcObject = remoteStream;
      }
      minimizedVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, status, isMinimized]);

  // Load project members for adding teammates to call
  useEffect(() => {
    if (showAddMember && currentProject) {
      api.collaboration
        .getMembers(currentProject.id)
        .then((res) => {
          const list = (res.members || []).filter((m: any) => {
            const uid = m.userId || m.id;
            return uid !== user?.id && !peers.some((p) => p.userId === uid);
          });
          setAvailableMembers(list);
        })
        .catch(() => setAvailableMembers([]));
    }
  }, [showAddMember, currentProject?.id, peers, user?.id]);

  // Format call duration: mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 440, e.clientX - dragStart.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 300, e.clientY - dragStart.current.y));
      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Only render when call is active
  if (status === 'idle' || status === 'incoming' || (!peer && peers.length === 0)) {
    return null;
  }

  const primaryPeer = peer || peers[0];

  // Minimized PiP View
  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 40,
          right: 20,
          width: 230,
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 12,
          boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
          zIndex: 9999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            background: 'linear-gradient(90deg, #1e1e24, #121214)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: status === 'connected' ? '#22c55e' : '#eab308',
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {peers.length > 1 ? `Group (${peers.length} peers)` : primaryPeer?.username}
            </span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: 2,
            }}
            title="Expand Call"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        <div style={{ position: 'relative', height: 115, backgroundColor: '#09090b' }}>
          {remoteStream ? (
            <video
              ref={minimizedVideoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#71717a',
                fontSize: 11,
              }}
            >
              {status === 'calling' ? 'Calling...' : primaryPeer?.username}
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 6,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {formatTime(durationSeconds)}
          </div>
        </div>

        <div
          style={{
            padding: '6px 8px',
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#18181b',
          }}
        >
          <button
            onClick={toggleMute}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: isMuted ? '#ef4444' : '#27272a',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
          <button
            onClick={endCall}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#dc2626',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            <PhoneOff size={13} />
          </button>
        </div>
      </div>
    );
  }

  const isMultiPeer = peers.length > 1;
  const modalWidth = isFullscreen ? '100vw' : isMultiPeer ? 540 : 450;
  const modalHeight = isFullscreen ? '100vh' : isMultiPeer ? 430 : 380;

  return (
    <div
      style={{
        position: 'fixed',
        ...(isFullscreen
          ? { top: 0, left: 0, width: '100vw', height: '100vh', borderRadius: 0 }
          : {
              left: pos.x,
              top: pos.y,
              width: modalWidth,
              height: modalHeight,
              borderRadius: 14,
            }),
        backgroundColor: '#121215',
        border: isFullscreen ? 'none' : '1px solid #27272a',
        boxShadow: '0 20px 50px rgba(0,0,0,0.75)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header bar (Draggable) */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: '10px 14px',
          background: 'rgba(24, 24, 27, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isFullscreen ? 'default' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Avatar stack */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {peers.slice(0, 3).map((p, idx) => (
              <div
                key={p.userId}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  backgroundColor: p.avatarColor || '#3b82f6',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: idx > 0 ? -8 : 0,
                  border: '2px solid #18181b',
                  zIndex: 3 - idx,
                }}
                title={p.username}
              >
                {p.username.substring(0, 2).toUpperCase()}
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>
              {peers.length > 1
                ? `Team Video Call (${peers.length} peers)`
                : primaryPeer?.username}
            </div>
            <div style={{ fontSize: 11, color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: status === 'connected' ? '#22c55e' : '#eab308',
                }}
              />
              {status === 'connected' ? `Connected HD (${formatTime(durationSeconds)})` : 'Ringing / Connecting...'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Invite teammate to call button */}
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            style={{
              background: showAddMember ? '#3b82f6' : 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#38bdf8',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
            }}
            title="Invite Teammate to Call"
          >
            <UserPlus size={13} />
            <span>Add Member</span>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: showSettings ? '#3f3f46' : 'transparent',
              border: 'none',
              color: '#d4d4d8',
              borderRadius: 6,
              padding: '6px',
              cursor: 'pointer',
            }}
            title="Audio / Video Settings"
          >
            <Settings size={15} />
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d4d4d8',
              borderRadius: 6,
              padding: '6px',
              cursor: 'pointer',
            }}
            title="Minimize to PiP"
          >
            <Minimize2 size={15} />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d4d4d8',
              borderRadius: 6,
              padding: '6px',
              cursor: 'pointer',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#09090b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* If multiple peers, show grid view */}
        {isMultiPeer ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              gridTemplateColumns: peers.length === 2 ? '1fr 1fr' : '1fr 1fr',
              gridTemplateRows: peers.length > 2 ? '1fr 1fr' : '1fr',
              gap: 6,
              padding: 6,
            }}
          >
            {peers.map((p) => (
              <RemotePeerTile
                key={p.userId}
                peer={p}
                stream={remoteStreams[p.userId]}
              />
            ))}
          </div>
        ) : (
          /* Single remote peer view */
          <>
            {remoteStream && (
              <video
                ref={singleRemoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: isFullscreen ? 'contain' : 'cover',
                }}
              />
            )}

            {!remoteStream && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  color: '#a1a1aa',
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    backgroundColor: primaryPeer?.avatarColor || '#3b82f6',
                    color: 'white',
                    fontSize: 26,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {primaryPeer?.username.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {status === 'calling'
                    ? `Ringing ${primaryPeer?.username}...`
                    : 'Waiting for video stream...'}
                </div>
                {errorMessage && (
                  <div style={{ color: '#f87171', fontSize: 12, maxWidth: 300, textAlign: 'center' }}>
                    {errorMessage}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Local Camera PiP in corner */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            width: isFullscreen ? 180 : 115,
            height: isFullscreen ? 120 : 78,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#18181b',
            border: '2px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
            zIndex: 10,
          }}
        >
          {localStream && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: isVideoOff ? 'none' : 'block',
              }}
            />
          )}

          {(!localStream || isVideoOff) && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#27272a',
                color: '#71717a',
                fontSize: 10,
              }}
            >
              Camera Off
            </div>
          )}
        </div>

        {/* Add Member Popover */}
        {showAddMember && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 280,
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              padding: 12,
              zIndex: 30,
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
              fontSize: 12,
              color: '#e4e4e7',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} color="#38bdf8" />
                <span>Invite Teammates to Call</span>
              </div>
              <button
                onClick={() => setShowAddMember(false)}
                style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>

            {availableMembers.length === 0 ? (
              <div style={{ color: '#71717a', fontSize: 11, padding: '8px 0', textAlign: 'center' }}>
                All workspace members are already in this call.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {availableMembers.map((m) => {
                  const uid = m.userId || m.id;
                  const isInvited = invitedMembers.has(uid);
                  return (
                    <div
                      key={uid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        backgroundColor: '#27272a',
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: m.avatarColor || '#10b981',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {m.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12 }}>{m.username}</span>
                      </div>

                      <button
                        onClick={async () => {
                          if (currentProject) {
                            await invitePeerToCall(
                              { id: uid, username: m.username, avatarColor: m.avatarColor },
                              currentProject.id
                            );
                            setInvitedMembers((prev) => new Set([...prev, uid]));
                          }
                        }}
                        disabled={isInvited}
                        style={{
                          backgroundColor: isInvited ? 'rgba(34, 197, 94, 0.2)' : '#3b82f6',
                          color: isInvited ? '#4ade80' : 'white',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: isInvited ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        {isInvited ? (
                          <>
                            <Check size={11} />
                            <span>Calling</span>
                          </>
                        ) : (
                          <span>Call</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Device Settings Popover */}
        {showSettings && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 260,
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              padding: 12,
              zIndex: 20,
              boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
              fontSize: 12,
              color: '#e4e4e7',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#f4f4f5' }}>Device Settings</div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>
                Microphone
              </label>
              <select
                value={selectedAudioDeviceId}
                onChange={(e) => switchAudioDevice(e.target.value)}
                style={{
                  width: '100%',
                  background: '#27272a',
                  color: 'white',
                  border: '1px solid #3f3f46',
                  borderRadius: 4,
                  padding: '4px 6px',
                  fontSize: 11,
                }}
              >
                {audioInputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>
                Camera
              </label>
              <select
                value={selectedVideoDeviceId}
                onChange={(e) => switchVideoDevice(e.target.value)}
                style={{
                  width: '100%',
                  background: '#27272a',
                  color: 'white',
                  border: '1px solid #3f3f46',
                  borderRadius: 4,
                  padding: '4px 6px',
                  fontSize: 11,
                }}
              >
                {videoInputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(24, 24, 27, 0.95)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        {/* Toggle Microphone */}
        <button
          onClick={toggleMute}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isMuted ? '#ef4444' : '#27272a',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Toggle Video */}
        <button
          onClick={toggleVideo}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isVideoOff ? '#ef4444' : '#27272a',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
          title={isVideoOff ? 'Start Camera' : 'Stop Camera'}
        >
          {isVideoOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isScreenSharing ? '#0284c7' : '#27272a',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
        >
          <Monitor size={18} />
        </button>

        {/* End Call */}
        <button
          onClick={endCall}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#dc2626',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
          title="End Call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};
