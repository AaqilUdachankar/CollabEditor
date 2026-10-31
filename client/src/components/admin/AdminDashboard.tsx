import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Radio,
  FolderGit2,
  History,
  HeartPulse,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { api } from '../../services/api.js';
import { IAdminOverview } from '../../types/ide.js';

import { OverviewSection } from './OverviewSection.js';
import { UsersSection } from './UsersSection.js';
import { LiveSessionsSection } from './LiveSessionsSection.js';
import { WorkspacesSection } from './WorkspacesSection.js';
import { ActivityTimelineSection } from './ActivityTimelineSection.js';
import { PerformanceSection } from './PerformanceSection.js';
import { AuditLogSection } from './AuditLogSection.js';

type AdminSection =
  | 'overview'
  | 'users'
  | 'sessions'
  | 'workspaces'
  | 'timeline'
  | 'performance'
  | 'audit';

export const AdminDashboard: React.FC = () => {
  const { setActiveActivity } = useProjectStore();
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<IAdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.getOverview();
      setOverview(res.overview);
    } catch (err: any) {
      setError(err.message || 'Failed to load overview');
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: <LayoutDashboard size={15} /> },
    { id: 'users' as const, label: 'Users', icon: <Users size={15} /> },
    { id: 'sessions' as const, label: 'Live Sessions', icon: <Radio size={15} /> },
    { id: 'workspaces' as const, label: 'Workspaces', icon: <FolderGit2 size={15} /> },
    { id: 'timeline' as const, label: 'Activity Timeline', icon: <History size={15} /> },
    { id: 'performance' as const, label: 'Performance & Health', icon: <HeartPulse size={15} /> },
    { id: 'audit' as const, label: 'Audit Log', icon: <ShieldAlert size={15} /> },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#181818',
        color: '#cccccc',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          backgroundColor: '#1e1e1e',
          borderBottom: '1px solid #2d2d2d',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => setActiveActivity('explorer')}
            title="Return to code editor"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              backgroundColor: '#252526',
              border: '1px solid #3c3c3c',
              borderRadius: 4,
              color: '#cccccc',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Editor</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171',
              }}
            >
              <Shield size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Admin & Team Activity Dashboard</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.5px',
                  }}
                >
                  ADMIN
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#858585' }}>
                Signed in as <strong style={{ color: '#ccc' }}>{user?.username}</strong> ({user?.email})
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {overview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 12,
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#4ade80',
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                {overview.activeSessions} online session{overview.activeSessions === 1 ? '' : 's'}
              </span>

              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 12,
                  backgroundColor: '#252526',
                  color: '#94a3b8',
                  border: '1px solid #3c3c3c',
                }}
              >
                {overview.registeredUsers} users
              </span>
            </div>
          )}

          <button
            onClick={loadOverview}
            title="Refresh dashboard"
            style={{
              padding: '6px 10px',
              backgroundColor: '#252526',
              border: '1px solid #3c3c3c',
              borderRadius: 4,
              color: '#cccccc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* Main Body with Section Navigation */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Navigation Sidebar */}
        <nav
          style={{
            width: 220,
            backgroundColor: '#1e1e1e',
            borderRight: '1px solid #2d2d2d',
            padding: '16px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', padding: '0 8px 8px', letterSpacing: '0.8px' }}>
            SECTIONS
          </div>

          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: isActive ? '#094771' : 'transparent',
                  color: isActive ? 'white' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#252526';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            padding: 24,
            overflowY: 'auto',
            minWidth: 0,
          }}
        >
          {activeSection === 'overview' && (
            <OverviewSection
              overview={overview}
              isLoading={isLoading}
              error={error}
              onRefresh={loadOverview}
              onNavigateSection={(sec) => setActiveSection(sec as AdminSection)}
            />
          )}

          {activeSection === 'users' && <UsersSection />}

          {activeSection === 'sessions' && <LiveSessionsSection />}

          {activeSection === 'workspaces' && <WorkspacesSection />}

          {activeSection === 'timeline' && <ActivityTimelineSection />}

          {activeSection === 'performance' && <PerformanceSection />}

          {activeSection === 'audit' && <AuditLogSection />}
        </main>
      </div>
    </div>
  );
};

