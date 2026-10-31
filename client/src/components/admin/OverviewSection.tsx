import React from 'react';
import {
  Users,
  Radio,
  FolderGit2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { IAdminOverview } from '../../types/ide.js';

interface OverviewSectionProps {
  overview: IAdminOverview | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigateSection: (section: string) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  overview,
  isLoading,
  error,
  onRefresh,
  onNavigateSection,
}) => {
  if (isLoading && !overview) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#858585' }}>
        <RefreshCw size={24} className="spin" style={{ marginBottom: 12 }} />
        <div>Loading platform overview metrics...</div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div style={{ padding: 24, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, margin: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontWeight: 600 }}>
          <AlertTriangle size={18} />
          <span>Error loading admin overview</span>
        </div>
        <div style={{ color: '#d1d5db', marginTop: 8, fontSize: 13 }}>{error}</div>
        <button
          onClick={onRefresh}
          style={{
            marginTop: 12,
            padding: '6px 12px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const data = overview || {
    registeredUsers: 0,
    activeUsers: 0,
    activeSessions: 0,
    activeWorkspaces: 0,
    totalWorkspaces: 0,
    recentActivities: [],
    healthCounts: {
      totalErrors: 0,
      executionErrors: 0,
      saveFailures: 0,
      apiErrors: 0,
      websocketErrors: 0,
      timeoutCount: 0,
      systemStatus: 'healthy' as const,
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top 4 KPI Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {/* Registered Users */}
        <div
          onClick={() => onNavigateSection('users')}
          style={{
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            borderRadius: 8,
            padding: 16,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#007acc')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3c3c3c')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>REGISTERED USERS</span>
            <Users size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginTop: 8 }}>
            {data.registeredUsers}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Manage accounts</span>
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Live Active Sessions */}
        <div
          onClick={() => onNavigateSection('sessions')}
          style={{
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            borderRadius: 8,
            padding: 16,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#22c55e')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3c3c3c')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>ACTIVE SESSIONS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 6px #22c55e',
                }}
              />
              <Radio size={18} color="#22c55e" />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginTop: 8 }}>
            {data.activeSessions}
          </div>
          <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>
            {data.activeUsers} active user{data.activeUsers === 1 ? '' : 's'} online
          </div>
        </div>

        {/* Active Workspaces */}
        <div
          onClick={() => onNavigateSection('workspaces')}
          style={{
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            borderRadius: 8,
            padding: 16,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a855f7')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3c3c3c')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>ACTIVE WORKSPACES</span>
            <FolderGit2 size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginTop: 8 }}>
            {data.activeWorkspaces} <span style={{ fontSize: 14, color: '#64748b' }}>/ {data.totalWorkspaces}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>View all projects</span>
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Health / Error Status */}
        <div
          onClick={() => onNavigateSection('performance')}
          style={{
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            borderRadius: 8,
            padding: 16,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f59e0b')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3c3c3c')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>SYSTEM HEALTH</span>
            {data.healthCounts.systemStatus === 'healthy' ? (
              <CheckCircle2 size={18} color="#22c55e" />
            ) : (
              <AlertTriangle size={18} color="#f59e0b" />
            )}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginTop: 8 }}>
            {data.healthCounts.totalErrors} <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>Errors</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {data.healthCounts.executionErrors} exec • {data.healthCounts.saveFailures} save • {data.healthCounts.timeoutCount} timeouts
          </div>
        </div>
      </div>

      {/* Recent Platform Activity */}
      <div
        style={{
          backgroundColor: '#252526',
          border: '1px solid #3c3c3c',
          borderRadius: 8,
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#007acc" />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'white' }}>Recent Platform Activity</span>
          </div>
          <button
            onClick={() => onNavigateSection('timeline')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#007acc',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>View Full Timeline</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {data.recentActivities.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#858585', fontSize: 13 }}>
            No recent activity recorded yet. Platform actions will stream here live.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.recentActivities.map((act) => {
              const isErr = act.eventType.includes('error');
              const isExec = act.eventType.includes('execution');
              const isFile = act.eventType.includes('file');
              const isGit = act.eventType.includes('git');
              const isMember = act.eventType.includes('member');
              const isAdmin = act.eventType.includes('admin');

              let badgeColor = '#3b82f6';
              if (isErr) badgeColor = '#ef4444';
              else if (isAdmin) badgeColor = '#ec4899';
              else if (isExec) badgeColor = '#10b981';
              else if (isGit) badgeColor = '#f59e0b';
              else if (isMember) badgeColor = '#8b5cf6';

              return (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #333',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        backgroundColor: `${badgeColor}22`,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}44`,
                        flexShrink: 0,
                      }}
                    >
                      {act.eventType}
                    </span>
                    <span style={{ color: 'white', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {act.action}
                    </span>
                    <span style={{ color: '#858585', fontSize: 11, flexShrink: 0 }}>
                      by <strong style={{ color: '#ccc' }}>{act.username}</strong>
                    </span>
                  </div>

                  <span style={{ color: '#64748b', fontSize: 11, flexShrink: 0, marginLeft: 12 }}>
                    {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

