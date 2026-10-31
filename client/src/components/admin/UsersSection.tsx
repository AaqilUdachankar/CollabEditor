import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Shield,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { IAdminUser } from '../../types/ide.js';

export const UsersSection: React.FC = () => {
  const [users, setUsers] = useState<IAdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.getUsers({
        search: search.trim(),
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleToggleRole = async (user: IAdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change ${user.username}'s role to "${newRole}"?`)) return;

    setActionUserId(user.id);
    try {
      await api.admin.updateUserRole(user.id, newRole);
      await loadUsers();
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`);
    } finally {
      setActionUserId(null);
    }
  };

  const handleToggleStatus = async (user: IAdminUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const actionLabel = newStatus === 'suspended' ? 'suspend' : 'reactivate';
    if (!confirm(`Are you sure you want to ${actionLabel} ${user.username}'s account?`)) return;

    setActionUserId(user.id);
    try {
      await api.admin.updateUserStatus(user.id, newStatus);
      await loadUsers();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setActionUserId(null);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls Bar */}
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
              placeholder="Search by username or email..."
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
            <span>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
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
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
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
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <button
            onClick={loadUsers}
            title="Refresh Users"
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

      {/* Error Banner */}
      {error && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
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
              <th style={{ padding: '10px 14px' }}>USER</th>
              <th style={{ padding: '10px 14px' }}>ROLE</th>
              <th style={{ padding: '10px 14px' }}>STATUS</th>
              <th style={{ padding: '10px 14px' }}>WORKSPACES</th>
              <th style={{ padding: '10px 14px' }}>LAST ACTIVE</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#858585' }}>
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#858585' }}>
                  No users matched your query.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isAdmin = u.role === 'admin';
                const isSuspended = u.status === 'suspended';
                const isProcessing = actionUserId === u.id;

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #2d2d2d' }}>
                    {/* User Identity */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor: u.avatarColor || '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'white' }}>{u.username}</div>
                          <div style={{ color: '#858585', fontSize: 11 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: isAdmin ? 'rgba(168, 85, 247, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: isAdmin ? '#c084fc' : '#94a3b8',
                          border: `1px solid ${isAdmin ? 'rgba(168, 85, 247, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isAdmin && <Shield size={11} />}
                        {u.role.toUpperCase()}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: isSuspended ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: isSuspended ? '#f87171' : '#4ade80',
                          border: `1px solid ${isSuspended ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                        }}
                      >
                        {u.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Workspaces */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: 'white', fontWeight: 500 }}>
                        {u.workspaceCount} workspace{u.workspaceCount === 1 ? '' : 's'}
                      </div>
                      <div style={{ color: '#858585', fontSize: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.workspaces.map((w) => w.name).join(', ') || 'No workspaces'}
                      </div>
                    </td>

                    {/* Last Active */}
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>
                      {u.lastActive ? new Date(u.lastActive).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleToggleRole(u)}
                          title={isAdmin ? 'Demote to regular user' : 'Promote to platform admin'}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#2a2a2a',
                            border: '1px solid #3c3c3c',
                            borderRadius: 4,
                            color: isAdmin ? '#f59e0b' : '#38bdf8',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          {isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        </button>

                        <button
                          disabled={isProcessing}
                          onClick={() => handleToggleStatus(u)}
                          title={isSuspended ? 'Reactivate account' : 'Suspend account access'}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#2a2a2a',
                            border: '1px solid #3c3c3c',
                            borderRadius: 4,
                            color: isSuspended ? '#22c55e' : '#f87171',
                            fontSize: 11,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {isSuspended ? <UserCheck size={12} /> : <UserX size={12} />}
                          <span>{isSuspended ? 'Activate' : 'Suspend'}</span>
                        </button>
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
            Showing {users.length} of {total} registered users
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

