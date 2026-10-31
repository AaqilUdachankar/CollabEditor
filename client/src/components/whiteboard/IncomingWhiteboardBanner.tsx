import React from 'react';
import { PenTool, Check, X } from 'lucide-react';
import { useWhiteboardStore } from '../../stores/whiteboardStore.js';

export const IncomingWhiteboardBanner: React.FC = () => {
  const { incomingInvite, acceptInvite, rejectInvite } = useWhiteboardStore();

  if (!incomingInvite) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 10001,
        backgroundColor: '#18181b',
        border: '1px solid #a855f7',
        boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(168, 85, 247, 0.3)',
        borderRadius: 14,
        padding: '16px 20px',
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: incomingInvite.avatarColor || '#a855f7',
            color: 'white',
            fontSize: 16,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)',
          }}
        >
          {incomingInvite.callerName.substring(0, 2).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f4f4f5' }}>
            {incomingInvite.callerName}
          </div>
          <div style={{ fontSize: 12, color: '#d8b4fe', display: 'flex', alignItems: 'center', gap: 4 }}>
            <PenTool size={13} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Private Whiteboard Invite
            </span>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#a1a1aa' }}>
        Board: <span style={{ color: '#e4e4e7', fontWeight: 500 }}>{incomingInvite.title}</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={rejectInvite}
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
          }}
        >
          <X size={15} />
          Decline
        </button>

        <button
          onClick={acceptInvite}
          style={{
            flex: 1,
            padding: '9px 12px',
            backgroundColor: '#a855f7',
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
            boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
          }}
        >
          <Check size={15} />
          Join Board
        </button>
      </div>
    </div>
  );
};
