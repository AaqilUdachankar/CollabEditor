import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Cpu,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { IPerformanceData } from '../../types/ide.js';

export const PerformanceSection: React.FC = () => {
  const [data, setData] = useState<IPerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPerformance();
    const interval = setInterval(loadPerformance, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const loadPerformance = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.getPerformance();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load performance metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#252526',
          border: '1px solid #3c3c3c',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeartPulse size={20} color={data?.system.status === 'healthy' ? '#22c55e' : '#f59e0b'} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'white' }}>
            System Health & Performance Metrics
          </span>
          {data && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor:
                  data.system.status === 'healthy'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
                color: data.system.status === 'healthy' ? '#4ade80' : '#fbbf24',
                border: `1px solid ${data.system.status === 'healthy' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              }}
            >
              {data.system.status.toUpperCase()}
            </span>
          )}
        </div>

        <button
          onClick={loadPerformance}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            backgroundColor: '#1e1e1e',
            color: '#cccccc',
            border: '1px solid #3c3c3c',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Metric Panels */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Execution Engine Health */}
          <div
            style={{
              backgroundColor: '#252526',
              border: '1px solid #3c3c3c',
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Zap size={16} color="#3b82f6" />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>Code Execution Health</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Total Executions</span>
                <strong style={{ color: 'white' }}>{data.executions.total}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Success Rate</span>
                <strong style={{ color: data.executions.successRate >= 90 ? '#22c55e' : '#f59e0b' }}>
                  {data.executions.successRate}%
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Successful / Failed</span>
                <span style={{ color: '#ccc' }}>
                  <span style={{ color: '#22c55e' }}>{data.executions.successful}</span> /{' '}
                  <span style={{ color: '#ef4444' }}>{data.executions.failed}</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Average Duration</span>
                <strong style={{ color: 'white' }}>{data.executions.avgDurationMs} ms</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Process Timeouts</span>
                <strong style={{ color: data.executions.timeoutCount > 0 ? '#f59e0b' : '#22c55e' }}>
                  {data.executions.timeoutCount}
                </strong>
              </div>
            </div>
          </div>

          {/* Reliability & Errors */}
          <div
            style={{
              backgroundColor: '#252526',
              border: '1px solid #3c3c3c',
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>Error & Fault Tracking</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Save Failures</span>
                <strong style={{ color: data.errors.saveFailures > 0 ? '#ef4444' : '#22c55e' }}>
                  {data.errors.saveFailures}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>API Server Errors (5xx)</span>
                <strong style={{ color: data.errors.apiErrors > 0 ? '#ef4444' : '#22c55e' }}>
                  {data.errors.apiErrors}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>WebSocket / Disconnect Errors</span>
                <strong style={{ color: data.errors.websocketErrors > 0 ? '#f59e0b' : '#22c55e' }}>
                  {data.errors.websocketErrors}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Reconnect Attempts</span>
                <strong style={{ color: 'white' }}>{data.errors.reconnects}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Total Fault Count</span>
                <strong style={{ color: data.errors.totalErrors > 0 ? '#f87171' : '#22c55e' }}>
                  {data.errors.totalErrors}
                </strong>
              </div>
            </div>
          </div>

          {/* System Environment */}
          <div
            style={{
              backgroundColor: '#252526',
              border: '1px solid #3c3c3c',
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Server size={16} color="#a855f7" />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>Host Runtime & Memory</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Process Uptime</span>
                <strong style={{ color: 'white' }}>{formatUptime(data.system.uptimeSeconds)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Memory RSS</span>
                <strong style={{ color: 'white' }}>{data.system.memoryUsageMb} MB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Node.js Version</span>
                <code style={{ color: '#38bdf8' }}>{data.system.nodeVersion}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Host Platform</span>
                <span style={{ color: '#e2e8f0', textTransform: 'capitalize' }}>{data.system.platform}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

