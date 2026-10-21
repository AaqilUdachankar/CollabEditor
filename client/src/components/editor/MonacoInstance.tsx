import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { bindYjsToMonaco, YjsSession } from '../../services/yjsBinding.js';
import { socketService } from '../../services/socket.js';

interface MonacoInstanceProps {
  isSplit?: boolean;
}

export const MonacoInstance: React.FC<MonacoInstanceProps> = ({ isSplit = false }) => {
  const { currentProject, files, saveFile } = useProjectStore();
  const { tabs, activeTabId, splitTabs, activeSplitTabId, setTabDirty } = useEditorStore();
  const { settings, setCommandPaletteOpen, setQuickOpenOpen } = useSettingsStore();
  const { user } = useAuthStore();

  const currentTabs = isSplit ? splitTabs : tabs;
  const currentActiveId = isSplit ? activeSplitTabId : activeTabId;
  const activeTab = currentTabs.find((t) => t.id === currentActiveId);
  const activeFile = files.find((f) => f.id === activeTab?.fileId);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const yjsSessionRef = useRef<YjsSession | null>(null);

  // Bind and maintain Yjs multiplayer CRDT & live cursor awareness
  useEffect(() => {
    if (!editorInstance || !currentProject || !activeTab) return;

    if (yjsSessionRef.current) {
      yjsSessionRef.current.destroy();
      yjsSessionRef.current = null;
    }

    try {
      const session = bindYjsToMonaco(
        currentProject.id,
        activeTab.fileId,
        editorInstance,
        user
      );
      yjsSessionRef.current = session;
    } catch (err) {
      console.error('[Yjs Monaco Binding Error]', err);
    }

    return () => {
      if (yjsSessionRef.current) {
        yjsSessionRef.current.destroy();
        yjsSessionRef.current = null;
      }
    };
  }, [editorInstance, currentProject?.id, activeTab?.fileId, user?.id, user?.username, user?.avatarColor]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    setEditorInstance(editor);

    // Define custom theme matching VS Code dark charcoal if needed
    monacoInstance.editor.defineTheme('nexus-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: '4ec9b0' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorCursor.foreground': '#38bdf8',
        'editor.lineHighlightBackground': '#282828',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
      },
    });

    monacoInstance.editor.setTheme(settings.theme === 'vs-dark' ? 'nexus-dark' : settings.theme);

    // Track cursor and selection changes to broadcast to room
    editor.onDidChangeCursorPosition((e) => {
      if (currentProject && activeTab) {
        socketService.sendActivity(currentProject.id, {
          fileId: activeTab.fileId,
          filePath: activeTab.path,
          cursorLine: e.position.lineNumber,
          cursorCol: e.position.column,
        });
      }
    });

    // Expose active editor content retrieval & save triggers for top menu & run actions
    (window as any).__collabide_get_active_content = () => {
      try {
        return editor.getValue();
      } catch {
        return undefined;
      }
    };

    (window as any).__collabide_save_active = async () => {
      if (currentProject && activeTab) {
        try {
          const val = editor.getValue();
          await saveFile(activeTab.fileId, val);
          setTabDirty(activeTab.fileId, false);
        } catch (err) {
          console.error('[Save Active Error]', err);
        }
      }
    };

    // Content change listener for dirty indicator & debounced auto-save (800ms)
    let autoSaveTimer: any = null;
    editor.onDidChangeModelContent(() => {
      if (activeTab) {
        setTabDirty(activeTab.fileId, true);
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
          if (currentProject && activeTab) {
            try {
              const val = editor.getValue();
              await saveFile(activeTab.fileId, val);
              setTabDirty(activeTab.fileId, false);
            } catch (err) {
              console.error('[AutoSave Error]', err);
            }
          }
        }, 800);
      }
    });

    // Add Save command (Ctrl+S / Cmd+S)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, async () => {
      if (currentProject && activeTab) {
        const val = editor.getValue();
        await saveFile(activeTab.fileId, val);
        setTabDirty(activeTab.fileId, false);
      }
    });

    // Add Command Palette shortcut (Ctrl+Shift+P)
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyP,
      () => setCommandPaletteOpen(true)
    );

    // Add Quick Open shortcut (Ctrl+P)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyP, () =>
      setQuickOpenOpen(true)
    );
  };

  const isReadOnly = currentProject?.role === 'viewer' && !currentProject?.isPublic;

  if (!activeTab || !activeFile) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#858585',
          backgroundColor: '#1e1e1e',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.2 }}>⚡ CollabIDE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <div>Show All Commands: <kbd style={{ background: '#2d2d2d', padding: '2px 6px', borderRadius: 3 }}>Ctrl+Shift+P</kbd></div>
          <div>Go to File: <kbd style={{ background: '#2d2d2d', padding: '2px 6px', borderRadius: 3 }}>Ctrl+P</kbd></div>
          <div>Toggle Integrated Terminal: <kbd style={{ background: '#2d2d2d', padding: '2px 6px', borderRadius: 3 }}>Ctrl+`</kbd></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <Editor
        key={activeTab.id}
        height="100%"
        path={activeTab.path}
        language={activeTab.language}
        defaultValue={activeFile.content || ''}
        theme={settings.theme === 'vs-dark' ? 'nexus-dark' : settings.theme}
        onMount={handleEditorMount}
        options={{
          fontSize: settings.fontSize,
          tabSize: settings.tabSize,
          wordWrap: settings.wordWrap ? 'on' : 'off',
          minimap: { enabled: settings.minimap },
          readOnly: isReadOnly,
          automaticLayout: true,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'all',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
        }}
      />
    </div>
  );
};
