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
  const token = localStorage.getItem('nexus_token') || '';

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
  if (user) {
    provider.awareness.setLocalStateField('user', {
      name: user.username,
      color: user.avatarColor || '#38bdf8',
      colorLight: `${user.avatarColor || '#38bdf8'}40`,
    });
  }

  let destroyed = false;
  const onAwarenessChange = () => {
    // remote awareness updates
  };
  provider.awareness.on('change', onAwarenessChange);

  const binding = new MonacoBinding(
    ytext,
    model,
    new Set([editor]),
    provider.awareness
  );

  return {
    doc,
    provider,
    binding,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      try {
        provider.awareness.off('change', onAwarenessChange);
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
