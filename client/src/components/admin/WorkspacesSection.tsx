import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Search,
  Filter,
  Globe,
  Lock,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { IAdminWorkspace } from '../../types/ide.js';

export const WorkspacesSection: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<IAdminWorkspace[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, [page, visibilityFilter, templateFilter]);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.getWorkspaces({
        search: search.trim(),
        visibility: visibilityFilter || undefined,
        template: templateFilter || undefined,
        page,
        limit,
      });
      setWorkspaces(res.workspaces);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadWorkspaces();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search & Filters Bar */}
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
              placeholder="Search workspaces by name or description..."
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
            <span>Visibility:</span>
            <select
              value={visibilityFilter}
              onChange={(e) => {
                setVisibilityFilter(e.target.value);
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
              <option value="">All</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <span>Template:</span>
            <select
              value={templateFilter}
              onChange={(e) => {
                setTemplateFilter(e.target.value);
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
              <option value="">All Templates</option>
              <option value="vanilla">Vanilla</option>
              <option value="react">React</option>
              <option value="python">Python</option>
              <option value="node">Node.js</option>
            </select>
          </div>

          <button
            onClick={loadWorkspaces}
            title="Refresh Workspaces"
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

      {/* Workspaces Table */}
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
              <th style={{ padding: '10px 14px' }}>WORKSPACE</th>
              <th style={{ padding: '10px 14px' }}>OWNER</th>
              <th style={{ padding: '10px 14px' }}>VISIBILITY</th>
              <th style={{ padding: '10px 14px' }}>TEMPLATE / STACK</th>
              <th style={{ padding: '10px 14px' }}>MEMBERS</th>
              <th style={{ padding: '10px 14px' }}>LAST ACTIVITY</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && workspaces.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#858585' }}>
                  Loading workspaces...
                </td>
              </tr>
            ) : workspaces.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#858585' }}>
                  No workspaces matched your query.
                </td>
              </tr>
            ) : (
              workspaces.map((ws) => (
                <tr key={ws.id} style={{ borderBottom: '1px solid #2d2d2d' }}>
                  {/* Workspace info */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FolderGit2 size={16} color="#007acc" />
                      <div>
                        <div style={{ fontWeight: 600, color: 'white' }}>{ws.name}</div>
                        {ws.description && (
                          <div style={{ color: '#858585', fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ws.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ color: 'white', fontWeight: 500 }}>{ws.owner.username}</div>
                    <div style={{ color: '#858585', fontSize: 11 }}>{ws.owner.email}</div>
                  </td>

                  {/* Visibility */}
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: ws.isPublic ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: ws.isPublic ? '#60a5fa' : '#94a3b8',
                        border: `1px solid ${ws.isPublic ? 'rgba(59, 130, 246, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {ws.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                      {ws.isPublic ? 'PUBLIC' : 'PRIVATE'}
                    </span>
                  </td>

                  {/* Template */}
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: '#1e1e1e',
                        border: '1px solid #3c3c3c',
                        color: '#f8fafc',
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: 'capitalize',
                      }}
                    >
                      {ws.template}
                    </span>
                  </td>

                  {/* Members */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'white' }}>
                      <Users size={13} color="#94a3b8" />
                      <span>{ws.membersCount} member{ws.membersCount === 1 ? '' : 's'}</span>
                    </div>
                  </td>

                  {/* Last Activity */}
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>
                    {ws.lastActivity
                      ? new Date(ws.lastActivity).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'N/A'}
                  </td>
                </tr>
              ))
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
            Showing {workspaces.length} of {total} workspaces
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

