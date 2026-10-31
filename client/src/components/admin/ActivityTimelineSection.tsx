import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Play,
  GitCommit,
  UserPlus,
  ShieldAlert,
  Code,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { IActivityRecord } from '../../types/ide.js';

export const ActivityTimelineSection: React.FC = () => {
  const [activities, setActivities] = useState<IActivityRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, [page, eventTypeFilter, startDate, endDate]);

  const loadActivities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.getActivities({
        search: search.trim() || undefined,
        eventType: eventTypeFilter || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        page,
        limit,
      });
      setActivities(res.activities);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadActivities();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('execution')) return <Play size={13} color="#10b981" />;
    if (eventType.includes('git')) return <GitCommit size={13} color="#f59e0b" />;
    if (eventType.includes('file')) return <FileText size={13} color="#38bdf8" />;
    if (eventType.includes('member')) return <UserPlus size={13} color="#8b5cf6" />;
    if (eventType.includes('admin')) return <ShieldAlert size={13} color="#ec4899" />;
    if (eventType.includes('error')) return <AlertTriangle size={13} color="#ef4444" />;
    return <Code size={13} color="#94a3b8" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search & Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#252526',
          border: '1px solid #3c3c3c',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#1e1e1e',
              border: '1px solid #3c3c3c',
              borderRadius: 6,
              padding: '6px 10px',
              flex: 1,
            }}
          >
            <Search size={15} color="#858585" />
            <input
              type="text"
              placeholder="Search activity description, user or file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: 13,
                outline: 'none',
                width: '100%',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '6px 12px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <Filter size={14} />
            <span>Event:</span>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              style={{
                backgroundColor: '#1e1e1e',
                color: '#cccccc',
                border: '1px solid #3c3c3c',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 12,
              }}
            >
              <option value="">All Events</option>
              <option value="project:create">Project Created</option>
              <option value="file:create">File Created</option>
              <option value="file:save">File Saved</option>
              <option value="file:rename">File Renamed</option>
              <option value="file:delete">File Deleted</option>
              <option value="execution:complete">Execution Completed</option>
              <option value="execution:error">Execution Error</option>
              <option value="git:commit">Git Commit</option>
              <option value="member:join">Member Joined</option>
              <option value="member:role_change">Role Changed</option>
              <option value="admin:role_change">Admin Role Change</option>
              <option value="admin:status_change">Admin Status Change</option>
              <option value="session:connect">Session Connect</option>
              <option value="session:disconnect">Session Disconnect</option>
              <option value="error:save">Save Error</option>
            </select>
          </div>

          <button
            onClick={loadActivities}
            title="Refresh Activities"
            style={{
              backgroundColor: '#1e1e1e',
              border: '1px solid #3c3c3c',
              borderRadius: 4,
              padding: '6px 8px',
              color: '#cccccc',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Activity Timeline List */}
      <div
        style={{
          backgroundColor: '#252526',
          border: '1px solid #3c3c3c',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {isLoading && activities.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#858585' }}>
            Loading activity timeline...
          </div>
        ) : activities.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#858585' }}>
            <History size={32} color="#555" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#ccc' }}>No activities found</div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
              Try adjusting your search terms or filters.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activities.map((item, idx) => {
              const meta = item.metadata || {};
              const hasMeta = Object.keys(meta).length > 0;

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: idx === activities.length - 1 ? 'none' : '1px solid #2d2d2d',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                  }}
                >
                  <div
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      backgroundColor: '#1e1e1e',
                      border: '1px solid #3c3c3c',
                      marginTop: 2,
                    }}
                  >
                    {getEventIcon(item.eventType)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>{item.action}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor: '#1e1e1e',
                          color: '#94a3b8',
                          border: '1px solid #3c3c3c',
                        }}
                      >
                        {item.eventType}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 11, color: '#858585' }}>
                      <span>
                        Actor: <strong style={{ color: '#ccc' }}>{item.username}</strong>
                      </span>
                      {item.projectId && (
                        <span>
                          Workspace: <code style={{ color: '#60a5fa' }}>{item.projectId.substring(0, 8)}</code>
                        </span>
                      )}
                      <span>
                        {new Date(item.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Sanitized metadata chips */}
                    {hasMeta && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {meta.fileName && (
                          <span style={{ padding: '2px 6px', backgroundColor: '#1e1e1e', borderRadius: 4, fontSize: 10, color: '#38bdf8' }}>
                            File: {meta.fileName}
                          </span>
                        )}
                        {meta.durationMs !== undefined && (
                          <span style={{ padding: '2px 6px', backgroundColor: '#1e1e1e', borderRadius: 4, fontSize: 10, color: '#4ade80' }}>
                            {meta.durationMs}ms
                          </span>
                        )}
                        {meta.exitCode !== undefined && (
                          <span style={{ padding: '2px 6px', backgroundColor: '#1e1e1e', borderRadius: 4, fontSize: 10, color: meta.exitCode === 0 ? '#4ade80' : '#f87171' }}>
                            Exit: {meta.exitCode}
                          </span>
                        )}
                        {meta.commitMessage && (
                          <span style={{ padding: '2px 6px', backgroundColor: '#1e1e1e', borderRadius: 4, fontSize: 10, color: '#fbbf24' }}>
                            Commit: "{meta.commitMessage.substring(0, 40)}"
                          </span>
                        )}
                        {meta.newRole && (
                          <span style={{ padding: '2px 6px', backgroundColor: '#1e1e1e', borderRadius: 4, fontSize: 10, color: '#c084fc' }}>
                            Role: {meta.newRole}
                          </span>
                        )}
                        {meta.newStatus && (
                          <span style={{ padding: '2px 6px', backgroundColor: '#1e1e1e', borderRadius: 4, fontSize: 10, color: '#f87171' }}>
                            Status: {meta.newStatus}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderTop: '1px solid #3c3c3c',
            backgroundColor: '#1e1e1e',
            fontSize: 12,
            color: '#94a3b8',
          }}
        >
          <div>
            Showing {activities.length} of {total} activities
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                backgroundColor: '#252526',
                border: '1px solid #3c3c3c',
                borderRadius: 4,
                padding: '4px 8px',
                color: page <= 1 ? '#555' : '#ccc',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
              style={{
                backgroundColor: '#252526',
                border: '1px solid #3c3c3c',
                borderRadius: 4,
                padding: '4px 8px',
                color: page >= totalPages ? '#555' : '#ccc',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

