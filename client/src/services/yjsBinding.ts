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

  // Track cursor and selection changes to broadcast across the room
  const broadcastSelection = () => {
    if (!model) return;
    const sel = editor.getSelection();
    if (sel) {
      let anchor = model.getOffsetAt(sel.getStartPosition());
      let head = model.getOffsetAt(sel.getEndPosition());
      if (sel.getDirection() === 1) {
        // RTL selection
        const tmp = anchor;
        anchor = head;
        head = tmp;
      }
      provider.awareness.setLocalStateField('selection', {
        anchor: Y.createRelativePositionFromTypeIndex(ytext, anchor),
        head: Y.createRelativePositionFromTypeIndex(ytext, head),
      });
    }
  };

  const cursorListener = editor.onDidChangeCursorPosition(broadcastSelection);
  const selectionListener = editor.onDidChangeCursorSelection(broadcastSelection);
  const focusListener = editor.onDidFocusEditorText(broadcastSelection);

  // Dynamic CSS injection for real-time remote user cursors with name badges
  const styleTagId = `yjs-cursor-styles-${projectId.replace(/[^a-zA-Z0-9]/g, '_')}-${fileId.replace(/[^a-zA-Z0-9]/g, '_')}`;

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
          position: absolute !important;
          border-left: 2px solid ${color} !important;
          height: 100% !important;
          box-sizing: border-box !important;
          overflow: visible !important;
        }
        .yRemoteSelectionHead-${clientID}::before {
          content: "${name}" !important;
          position: absolute !important;
          top: -18px !important;
          left: -2px !important;
          font-size: 10px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-weight: 600 !important;
          color: #ffffff !important;
          background-color: ${color} !important;
          padding: 1px 5px !important;
          border-radius: 3px !important;
          white-space: nowrap !important;
          pointer-events: none !important;
          user-select: none !important;
          z-index: 1000 !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
          line-height: 1.2 !important;
          display: block !important;
        }
        .yRemoteSelectionHead-${clientID}::after {
          content: "${name}" !important;
          position: absolute !important;
          top: -18px !important;
          left: -2px !important;
          font-size: 10px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-weight: 600 !important;
          color: #ffffff !important;
          background-color: ${color} !important;
          padding: 1px 5px !important;
          border-radius: 3px !important;
          white-space: nowrap !important;
          pointer-events: none !important;
          user-select: none !important;
          z-index: 1000 !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
          line-height: 1.2 !important;
          display: block !important;
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
  provider.awareness.on('update', updateCursorStyles);
  updateCursorStyles();

  let binding: MonacoBinding | null = null;
  let destroyed = false;
  let bound = false;

  const doBind = () => {
    if (destroyed || bound) return;
    bound = true;

    // If ytext has no text yet from server but editor has initial content, seed it
    if (ytext.length === 0 && model.getValue().length > 0) {
      doc.transact(() => {
        ytext.insert(0, model.getValue());
      });
    }

    binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness
    );

    broadcastSelection();
    updateCursorStyles();
  };

  if (provider.synced) {
    doBind();
  } else {
    // Wait for server sync, or fallback after 250ms
    const timer = setTimeout(() => {
      doBind();
    }, 250);

    provider.once('sync', () => {
      clearTimeout(timer);
      doBind();
    });
  }

  return {
    doc,
    provider,
    get binding() {
      return binding!;
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      try {
        cursorListener.dispose();
      } catch {}
      try {
        selectionListener.dispose();
      } catch {}
      try {
        focusListener.dispose();
      } catch {}
      try {
        provider.awareness.off('change', updateCursorStyles);
      } catch {}
      try {
        provider.awareness.off('update', updateCursorStyles);
      } catch {}
      try {
        const styleEl = document.getElementById(styleTagId);
        if (styleEl) styleEl.remove();
      } catch {}
      try {
        if (binding) binding.destroy();
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
