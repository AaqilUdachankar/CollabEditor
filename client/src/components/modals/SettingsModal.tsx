import React from 'react';
import { X, Settings, Moon, Sun, Type, Sliders } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';

export const SettingsModal: React.FC = () => {
  const { settingsModalOpen, setSettingsModalOpen, settings, updateSettings } = useSettingsStore();

  if (!settingsModalOpen) return null;

  return (
    <div className="palette-overlay" onClick={() => setSettingsModalOpen(false)}>
      <div
        className="palette-box"
        style={{ width: '540px', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #3c3c3c',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'white' }}>
            <Settings size={18} color="#007acc" />
            <span>Workbench Preferences & Settings</span>
          </div>
          <button
            onClick={() => setSettingsModalOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Theme */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cccccc', marginBottom: 4 }}>
              Color Theme:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'vs-dark', label: 'Dark Charcoal (VS Code+)' },
                { id: 'vs-light', label: 'Light' },
                { id: 'hc-black', label: 'High Contrast' },
              ].map((th) => (
                <button
                  key={th.id}
                  onClick={() => updateSettings({ theme: th.id as any })}
                  style={{
                    flex: 1,
                    background: settings.theme === th.id ? '#007acc' : '#2a2a2a',
                    border: '1px solid #3c3c3c',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {th.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cccccc', marginBottom: 4 }}>
              Editor Font Size: {settings.fontSize}px
            </label>
            <input
              type="range"
              min={11}
              max={22}
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: '#007acc' }}
            />
          </div>

          {/* Tab Size */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cccccc', marginBottom: 4 }}>
              Tab Size:
            </label>
            <select
              value={settings.tabSize}
              onChange={(e) => updateSettings({ tabSize: parseInt(e.target.value, 10) })}
              style={{
                width: '100%',
                background: '#2a2a2a',
                border: '1px solid #3c3c3c',
                color: 'white',
                padding: '6px 10px',
                borderRadius: 4,
                fontSize: 12,
                outline: 'none',
              }}
            >
              <option value={2}>2 Spaces</option>
              <option value={4}>4 Spaces</option>
              <option value={8}>8 Spaces</option>
            </select>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'white', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.wordWrap}
                onChange={(e) => updateSettings({ wordWrap: e.target.checked })}
                style={{ accentColor: '#007acc' }}
              />
              <span>Editor Word Wrap</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'white', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.minimap}
                onChange={(e) => updateSettings({ minimap: e.target.checked })}
                style={{ accentColor: '#007acc' }}
              />
              <span>Show Code Minimap</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'white', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                style={{ accentColor: '#007acc' }}
              />
              <span>Auto-Save (Background CRDT Sync)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
