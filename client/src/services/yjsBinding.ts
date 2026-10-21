import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import type * as monaco from 'monaco-editor';
import { IUser } from '../types/ide.js';

export interface YjsSession {
  doc: Y.Doc;
  provider: WebsocketProvider;
  binding: MonacoBinding;
  destroy: () => void;
}

export function bindYjsToMonaco(
  projectId: string,
  fileId: string,
  editor: monaco.editor.IStandaloneCodeEditor,
  user: IUser | null
): YjsSession {
  const roomName = `${projectId}::${fileId}`;
  const doc = new Y.Doc();
  const token = localStorage.getItem('collabide_token') || localStorage.getItem('nexus_token') || '';

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/yjs`;

  const provider = new WebsocketProvider(wsUrl, roomName, doc, {
    params: { token, room: roomName },
  });

  const ytext = doc.getText('monaco');
  const model = editor.getModel();

  if (!model) {
    throw new Error('Monaco editor model not initialized');
  }

  // Configure remote presence & cursor awareness
  const userName = user?.username || 'Collaborator';
  const userColor = user?.avatarColor || '#38bdf8';

  provider.awareness.setLocalStateField('user', {
    name: userName,
    color: userColor,
    colorLight: `${userColor}40`,
  });

  // Track initial cursor selection in awareness
  const initialSel = editor.getSelection();
  if (initialSel) {
    const anchor = model.getOffsetAt(initialSel.getStartPosition());
    const head = model.getOffsetAt(initialSel.getEndPosition());
    provider.awareness.setLocalStateField('selection', {
      anchor: Y.createRelativePositionFromTypeIndex(ytext, anchor),
      head: Y.createRelativePositionFromTypeIndex(ytext, head),
    });
  }

  // Track cursor movements and broadcast in real-time
  const cursorListener = editor.onDidChangeCursorPosition(() => {
    const sel = editor.getSelection();
    if (sel && model) {
      const anchor = model.getOffsetAt(sel.getStartPosition());
      const head = model.getOffsetAt(sel.getEndPosition());
      provider.awareness.setLocalStateField('selection', {
        anchor: Y.createRelativePositionFromTypeIndex(ytext, anchor),
        head: Y.createRelativePositionFromTypeIndex(ytext, head),
      });
    }
  });

  // Dynamic CSS injection for real-time remote user cursors with name badges
  const styleTagId = `yjs-cursor-styles-${projectId.slice(0, 8)}-${fileId.slice(0, 8)}`;

  const updateCursorStyles = () => {
    let css = '';
    provider.awareness.getStates().forEach((state: any, clientID: number) => {
      if (clientID === doc.clientID || !state.user) return;
      const u = state.user;
      const color = u.color || '#38bdf8';
      const name = (u.name || 'User').replace(/['"\\]/g, '');

      css += `
        .yRemoteSelection-${clientID} {
          background-color: ${color}33 !important;
        }
        .yRemoteSelectionHead-${clientID} {
          position: absolute;
          border-left: 2px solid ${color} !important;
          height: 100% !important;
          box-sizing: border-box;
          overflow: visible !important;
        }
        .yRemoteSelectionHead-${clientID}::after {
          content: "${name}" !important;
          position: absolute;
          top: -18px;
          left: -2px;
          font-size: 10px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 600;
          color: #ffffff !important;
          background-color: ${color} !important;
          padding: 1px 5px;
          border-radius: 3px;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
          z-index: 1000;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          line-height: 1.2;
        }
      `;
    });

    let styleEl = document.getElementById(styleTagId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleTagId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  };

  provider.awareness.on('change', updateCursorStyles);
  updateCursorStyles();

  const binding = new MonacoBinding(
    ytext,
    model,
    new Set([editor]),
    provider.awareness
  );

  let destroyed = false;

  return {
    doc,
    provider,
    binding,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      try {
        cursorListener.dispose();
      } catch {}
      try {
        provider.awareness.off('change', updateCursorStyles);
      } catch {}
      try {
        const styleEl = document.getElementById(styleTagId);
        if (styleEl) styleEl.remove();
      } catch {}
      try {
        binding.destroy();
      } catch {}
      try {
        provider.disconnect();
        provider.destroy();
      } catch {}
      try {
        doc.destroy();
      } catch {}
    },
  };
}
