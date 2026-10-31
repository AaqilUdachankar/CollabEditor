import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useVideoCallStore } from '../../stores/videoCallStore.js';

export const IncomingCallBanner: React.FC = () => {
  const { incomingCall, acceptCall, rejectCall } = useVideoCallStore();

  if (!incomingCall) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 10001,
        backgroundColor: '#18181b',
        border: '1px solid #3b82f6',
        boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(59, 130, 246, 0.3)',
        borderRadius: 14,
        padding: '16px 20px',
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: 'Inter, system-ui, sans-serif',
        animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            position: 'relative',
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: incomingCall.avatarColor || '#3b82f6',
            color: 'white',
            fontSize: 16,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          }}
        >
          {incomingCall.callerName.substring(0, 2).toUpperCase()}
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              border: '2px solid #18181b',
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f4f4f5' }}>
            {incomingCall.callerName}
          </div>
          <div style={{ fontSize: 12, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Video size={13} />
            <span>Private Video Call...</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => rejectCall('Declined')}
          style={{
            flex: 1,
            padding: '9px 12px',
            backgroundColor: '#27272a',
            color: '#ef4444',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background 0.15s ease',
          }}
        >
          <PhoneOff size={15} />
          Decline
        </button>

        <button
          onClick={acceptCall}
          style={{
            flex: 1,
            padding: '9px 12px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
            transition: 'background 0.15s ease',
          }}
        >
          <Phone size={15} />
          Accept
        </button>
      </div>
    </div>
  );
};
