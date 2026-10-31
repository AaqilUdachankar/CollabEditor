import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  FolderGit2,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { IAuditRecord } from '../../types/ide.js';

export const AuditLogSection: React.FC = () => {
  const [logs, setLogs] = useState<IAuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, [page, targetTypeFilter, actionFilter]);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.getAuditLogs({
        search: search.trim() || undefined,
        targetType: targetTypeFilter || undefined,
        action: actionFilter || undefined,
        page,
        limit,
      });
      setLogs(res.auditLogs);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAuditLogs();
  };

  const totalPages = Math.ceil(total / limit) || 1;

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
              placeholder="Search audit actions, admin actor or target..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <Filter size={14} />
            <span>Target:</span>
            <select
              value={targetTypeFilter}
              onChange={(e) => {
                setTargetTypeFilter(e.target.value);
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
              <option value="">All Targets</option>
              <option value="user">User</option>
              <option value="project">Project</option>
              <option value="member">Member</option>
              <option value="system">System</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <span>Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
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
              <option value="">All Actions</option>
              <option value="user:change_role">Change User Role</option>
              <option value="user:change_status">Change User Status</option>
              <option value="member:change_role">Change Member Role</option>
            </select>
          </div>

          <button
            onClick={loadAuditLogs}
            title="Refresh Audit Logs"
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

      {/* Audit Log Table */}
      <div
        style={{
          backgroundColor: '#252526',
          border: '1px solid #3c3c3c',
          borderRadius: 8,
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #3c3c3c', backgroundColor: '#1e1e1e', color: '#94a3b8' }}>
              <th style={{ padding: '10px 14px' }}>TIMESTAMP</th>
              <th style={{ padding: '10px 14px' }}>ACTOR</th>
              <th style={{ padding: '10px 14px' }}>ACTION</th>
              <th style={{ padding: '10px 14px' }}>TARGET</th>
              <th style={{ padding: '10px 14px' }}>MODIFICATIONS & DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#858585' }}>
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#858585' }}>
                  No administrative actions recorded in audit log yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const details = log.details || {};

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #2d2d2d' }}>
                    {/* Timestamp */}
                    <td style={{ padding: '10px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Actor */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: 'white' }}>{log.actorUsername}</span>
                        {log.actorEmail && (
                          <span style={{ color: '#858585', fontSize: 11 }}>({log.actorEmail})</span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: 'rgba(236, 72, 153, 0.15)',
                          color: '#f472b6',
                          border: '1px solid rgba(236, 72, 153, 0.3)',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Target */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {log.targetType === 'user' ? (
                          <User size={13} color="#3b82f6" />
                        ) : (
                          <FolderGit2 size={13} color="#a855f7" />
                        )}
                        <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                          {log.targetName || log.targetId}
                        </span>
                        <span style={{ color: '#64748b', fontSize: 10 }}>({log.targetType})</span>
                      </div>
                    </td>

                    {/* Details */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                        {details.previousRole && details.newRole && (
                          <span style={{ color: '#ccc' }}>
                            Role: <span style={{ color: '#f87171' }}>{details.previousRole}</span> →{' '}
                            <span style={{ color: '#4ade80' }}>{details.newRole}</span>
                          </span>
                        )}
                        {details.previousStatus && details.newStatus && (
                          <span style={{ color: '#ccc' }}>
                            Status: <span style={{ color: '#f87171' }}>{details.previousStatus}</span> →{' '}
                            <span style={{ color: '#4ade80' }}>{details.newStatus}</span>
                          </span>
                        )}
                        {!details.previousRole && !details.previousStatus && (
                          <span style={{ color: '#858585' }}>
                            {JSON.stringify(details)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

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
            Showing {logs.length} of {total} audit records
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

