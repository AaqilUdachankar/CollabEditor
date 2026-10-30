import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, RotateCw, X, Terminal as TerminalIcon } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { createTerminalSession, TerminalInstance } from '../../services/terminalSession.js';

interface SessionData {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
}

export const TerminalTab: React.FC = () => {
  const { currentProject } = useProjectStore();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const sessionInstancesRef = useRef<Map<string, TerminalInstance>>(new Map());
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const nextSessionNum = useRef(1);

  // Initialize first session if none exists
  useEffect(() => {
    if (!currentProject) return;

    if (sessions.length === 0) {
      const initialId = `term-${Date.now()}`;
      setSessions([{ id: initialId, name: 'Terminal 1', status: 'connecting' }]);
      setActiveSessionId(initialId);
      nextSessionNum.current = 2;
    }
  }, [currentProject?.id]);

  // Clean up all sessions on unmount or project change
  useEffect(() => {
    return () => {
      sessionInstancesRef.current.forEach((instance) => {
        instance.destroy();
      });
      sessionInstancesRef.current.clear();
      containerRefs.current.clear();
      setSessions([]);
      setActiveSessionId('');
    };
  }, [currentProject?.id]);

  // Mount/bind sessions to containers
  useEffect(() => {
    if (!currentProject) return;

    sessions.forEach((s) => {
      const container = containerRefs.current.get(s.id);
      if (container && !sessionInstancesRef.current.has(s.id)) {
        const instance = createTerminalSession(
          container,
          currentProject.id,
          (_exitCode) => {
            setSessions((prev) =>
              prev.map((item) => (item.id === s.id ? { ...item, status: 'disconnected' } : item))
            );
          },
          (status) => {
            setSessions((prev) =>
              prev.map((item) => (item.id === s.id ? { ...item, status } : item))
            );
          }
        );
        sessionInstancesRef.current.set(s.id, instance);
      }
    });

    // Resize active instance
    const activeInstance = sessionInstancesRef.current.get(activeSessionId);
    if (activeInstance) {
      requestAnimationFrame(() => {
        try {
          activeInstance.fitAddon.fit();
        } catch {}
      });
    }
  }, [sessions, activeSessionId, currentProject?.id]);

  const addSession = () => {
    if (!currentProject) return;
    const newId = `term-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newName = `Terminal ${nextSessionNum.current++}`;
    setSessions((prev) => [...prev, { id: newId, name: newName, status: 'connecting' }]);
    setActiveSessionId(newId);
  };

  const closeSession = (e: React.MouseEvent, idToClose: string) => {
    e.stopPropagation();
    const instance = sessionInstancesRef.current.get(idToClose);
    if (instance) {
      instance.destroy();
      sessionInstancesRef.current.delete(idToClose);
    }
    containerRefs.current.delete(idToClose);

    setSessions((prev) => {
      const nextSessions = prev.filter((s) => s.id !== idToClose);
      if (activeSessionId === idToClose && nextSessions.length > 0) {
        setActiveSessionId(nextSessions[nextSessions.length - 1].id);
      } else if (nextSessions.length === 0) {
        setActiveSessionId('');
      }
      return nextSessions;
    });
  };

  const handleClear = () => {
    const activeInstance = sessionInstancesRef.current.get(activeSessionId);
    if (activeInstance) {
      activeInstance.clear();
    }
  };

  const handleRestart = () => {
    const activeInstance = sessionInstancesRef.current.get(activeSessionId);
    if (activeInstance) {
      activeInstance.restart();
      setSessions((prev) =>
        prev.map((item) => (item.id === activeSessionId ? { ...item, status: 'connected' } : item))
      );
    }
  };

  if (!currentProject) {
    return (
      <div style={{ padding: 16, color: '#858585', fontSize: 12 }}>
        Select a project to open an interactive terminal session.
      </div>
    );
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#181818' }}>
      {/* Sub-header toolbar for Terminal sessions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#1e1e1e',
          borderBottom: '1px solid #2b2b2b',
          padding: '2px 8px',
          minHeight: '28px',
          fontSize: '11px',
        }}
      >
        {/* Left: Session Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                background: s.id === activeSessionId ? '#2d2d2d' : 'transparent',
                color: s.id === activeSessionId ? '#ffffff' : '#999999',
                border: s.id === activeSessionId ? '1px solid #3d3d3d' : '1px solid transparent',
              }}
            >
              <TerminalIcon size={12} style={{ color: s.status === 'connected' ? '#10b981' : '#f59e0b' }} />
              <span>{s.name}</span>
              {sessions.length > 1 && (
                <button
                  onClick={(e) => closeSession(e, s.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Close Terminal"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addSession}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaaaaa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px 6px',
              borderRadius: '3px',
            }}
            title="New Terminal"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Right: Actions and Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeSession && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeSession.status === 'connected' ? '#064e3b' : '#78350f',
                color: activeSession.status === 'connected' ? '#6ee7b7' : '#fcd34d',
              }}
            >
              {activeSession.status === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          )}

          <button
            onClick={handleRestart}
            style={{
              background: 'none',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
            }}
            title="Restart Active Terminal"
          >
            <RotateCw size={12} />
          </button>

          <button
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
            }}
            title="Clear Terminal Screen"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal Viewports Container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            ref={(el) => {
              if (el) containerRefs.current.set(s.id, el);
              else containerRefs.current.delete(s.id);
            }}
            style={{
              display: s.id === activeSessionId ? 'block' : 'none',
              width: '100%',
              height: '100%',
              padding: '4px 8px',
              boxSizing: 'border-box',
            }}
          />
        ))}

        {sessions.length === 0 && (
          <div style={{ padding: 16, color: '#858585', fontSize: 12 }}>
            No terminal session open.{' '}
            <button
              onClick={addSession}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                marginLeft: 8,
              }}
            >
              Open Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
