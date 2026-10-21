import React, { useState } from 'react';
import { Search, Boxes, Check, Sparkles } from 'lucide-react';

interface ExtensionItem {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  category: string;
  enabled: boolean;
}

const EXTENSIONS: ExtensionItem[] = [
  {
    id: 'ts-js-features',
    name: 'TypeScript & JavaScript Features',
    author: 'CollabIDE Built-in',
    description: 'Rich Monaco IntelliSense, syntax validation, diagnostics, and completions.',
    version: 'v5.7.0',
    category: 'Programming Languages',
    enabled: true,
  },
  {
    id: 'python-support',
    name: 'Python Language Tools',
    author: 'CollabIDE Built-in',
    description: 'Python syntax highlighting, formatting, indentation, and live runner.',
    version: 'v3.14.0',
    category: 'Programming Languages',
    enabled: true,
  },
  {
    id: 'cpp-clang-tools',
    name: 'C/C++ Tools',
    author: 'CollabIDE Built-in',
    description: 'C/C++ syntax support, MinGW GCC compilation and debugging.',
    version: 'v16.2.0',
    category: 'Programming Languages',
    enabled: true,
  },
  {
    id: 'html-css-tools',
    name: 'HTML & CSS Language Support',
    author: 'CollabIDE Built-in',
    description: 'Emmet completion, CSS color decorators, HTML entity suggestions.',
    version: 'v1.4.2',
    category: 'Web',
    enabled: true,
  },
  {
    id: 'yjs-collaboration',
    name: 'Yjs Real-Time CRDT Engine',
    author: 'CollabIDE Team',
    description: 'Peer-to-peer conflict-free document synchronization and remote cursor awareness.',
    version: 'v13.6.0',
    category: 'Collaboration',
    enabled: true,
  },
  {
    id: 'xterm-terminal',
    name: 'Interactive Xterm.js Shell',
    author: 'CollabIDE Team',
    description: 'Full-featured terminal emulation with FitAddon and WebLinks.',
    version: 'v5.5.0',
    category: 'Terminal',
    enabled: true,
  },
];

export const ExtensionsView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [extensionList, setExtensionList] = useState(EXTENSIONS);

  const filtered = extensionList.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.description.toLowerCase().includes(query.toLowerCase())
  );

  const toggleExtension = (id: string) => {
    setExtensionList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span>EXTENSIONS</span>
      </div>

      <div style={{ padding: '8px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#2a2a2a',
            border: '1px solid #3c3c3c',
            borderRadius: 3,
            padding: '3px 8px',
            gap: 6,
          }}
        >
          <Search size={13} color="#858585" />
          <input
            type="text"
            placeholder="Search extensions in marketplace..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: 12,
            }}
          />
        </div>
      </div>

      <div className="sidebar-content" style={{ padding: '0 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', padding: '4px 6px' }}>
          INSTALLED ({filtered.length})
        </div>

        {filtered.map((ext) => (
          <div
            key={ext.id}
            style={{
              padding: '8px',
              borderBottom: '1px solid #282828',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: '#2a2a2a',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
              }}
            >
              <Boxes size={18} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'white' }}>{ext.name}</span>
                <button
                  onClick={() => toggleExtension(ext.id)}
                  style={{
                    background: ext.enabled ? '#1e293b' : '#334155',
                    color: ext.enabled ? '#38bdf8' : '#94a3b8',
                    border: '1px solid #475569',
                    borderRadius: 3,
                    padding: '2px 6px',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  {ext.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.3 }}>
                {ext.description}
              </div>

              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, display: 'flex', gap: 8 }}>
                <span>{ext.author}</span>
                <span>{ext.version}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
