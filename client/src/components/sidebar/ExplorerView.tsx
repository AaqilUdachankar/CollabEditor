import React, { useState, useRef, useEffect } from 'react';
import {
  FilePlus,
  FolderPlus,
  RefreshCw,
  Download,
  FolderTree,
  Trash2,
  Copy,
  Edit2,
  FileCode,
  Folder
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { FileTreeNode } from './FileTreeNode.js';
import { IFileNode } from '../../types/ide.js';
import { api } from '../../services/api.js';

export const ExplorerView: React.FC = () => {
  const {
    currentProject,
    files,
    isLoadingFiles,
    createFile,
    createFolder,
    deleteNode,
    duplicateNode,
    renameNode,
    loadFiles,
  } = useProjectStore();
  const { setNewProjectModalOpen } = useSettingsStore();

  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: IFileNode | null;
  }>({ visible: false, x: 0, y: 0, node: null });

  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, node: null });
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenContextMenu = (e: React.MouseEvent, node: IFileNode) => {
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 200),
      node,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !currentProject) return;

    try {
      if (isCreatingFile) {
        await createFile(targetParentId, newItemName.trim());
      } else if (isCreatingFolder) {
        await createFolder(targetParentId, newItemName.trim());
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      setNewItemName('');
      setTargetParentId(null);
    }
  };

  const rootNodes = files.filter((f) => f.parentId === null);

  if (!currentProject) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#858585' }}>
        <FolderTree size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
        <p style={{ fontSize: 13, marginBottom: 12 }}>No project currently open.</p>
        <button
          onClick={() => setNewProjectModalOpen(true)}
          style={{
            background: '#007acc',
            color: 'white',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Create or Open Project
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Explorer Top Toolbar */}
      <div className="sidebar-header">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentProject.name}
        </span>
        <div className="sidebar-actions">
          <button
            className="sidebar-icon-btn"
            title="New File"
            onClick={() => {
              setTargetParentId(null);
              setIsCreatingFile(true);
              setIsCreatingFolder(false);
              setNewItemName('');
            }}
          >
            <FilePlus size={14} />
          </button>
          <button
            className="sidebar-icon-btn"
            title="New Folder"
            onClick={() => {
              setTargetParentId(null);
              setIsCreatingFolder(true);
              setIsCreatingFile(false);
              setNewItemName('');
            }}
          >
            <FolderPlus size={14} />
          </button>
          <button
            className="sidebar-icon-btn"
            title="Refresh Explorer"
            onClick={() => loadFiles(currentProject.id)}
          >
            <RefreshCw size={13} className={isLoadingFiles ? 'animate-spin' : ''} />
          </button>
          <a
            href={api.projects.exportUrl(currentProject.id)}
            download
            className="sidebar-icon-btn"
            title="Export as ZIP"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Download size={13} />
          </a>
        </div>
      </div>

      {/* Explorer Tree Content */}
      <div
        className="sidebar-content"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({
            visible: true,
            x: Math.min(e.clientX, window.innerWidth - 180),
            y: Math.min(e.clientY, window.innerHeight - 200),
            node: null,
          });
        }}
      >
        {/* Inline file/folder creation form */}
        {(isCreatingFile || isCreatingFolder) && (
          <div style={{ padding: '4px 8px 4px 24px' }}>
            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isCreatingFolder ? (
                  <Folder size={15} color="#eab308" />
                ) : (
                  <FileCode size={15} color="#3b82f6" />
                )}
                <input
                  autoFocus
                  type="text"
                  placeholder={isCreatingFolder ? 'folder name' : 'file.ext'}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={() => {
                    setIsCreatingFile(false);
                    setIsCreatingFolder(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsCreatingFile(false);
                      setIsCreatingFolder(false);
                    }
                  }}
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #007fd4',
                    color: 'white',
                    fontSize: 12,
                    padding: '2px 6px',
                    width: '100%',
                    outline: 'none',
                    borderRadius: 2,
                  }}
                />
              </div>
            </form>
          </div>
        )}

        {/* Tree Nodes */}
        {rootNodes.map((node) => (
          <FileTreeNode
            key={node.id}
            node={node}
            level={0}
            onContextMenu={handleOpenContextMenu}
          />
        ))}

        {rootNodes.length === 0 && !isCreatingFile && !isCreatingFolder && (
          <div style={{ padding: 16, color: '#858585', fontSize: 12, textAlign: 'center' }}>
            No files in project yet.
          </div>
        )}
      </div>

      {/* Context Menu Modal */}
      {contextMenu.visible && (
        <div
          ref={contextRef}
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#1f1f1f',
            border: '1px solid #3c3c3c',
            borderRadius: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 9999,
            minWidth: 170,
            padding: '4px 0',
          }}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              setTargetParentId(contextMenu.node?.type === 'directory' ? contextMenu.node.id : contextMenu.node?.parentId || null);
              setIsCreatingFile(true);
              setContextMenu({ visible: false, x: 0, y: 0, node: null });
            }}
          >
            <FilePlus size={13} />
            <span>New File</span>
          </div>

          <div
            className="context-menu-item"
            onClick={() => {
              setTargetParentId(contextMenu.node?.type === 'directory' ? contextMenu.node.id : contextMenu.node?.parentId || null);
              setIsCreatingFolder(true);
              setContextMenu({ visible: false, x: 0, y: 0, node: null });
            }}
          >
            <FolderPlus size={13} />
            <span>New Folder</span>
          </div>

          {contextMenu.node && (
            <>
              <div className="menu-separator" />
              {contextMenu.node.type === 'file' && (
                <div
                  className="context-menu-item"
                  onClick={() => {
                    duplicateNode(contextMenu.node!.id);
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}
                >
                  <Copy size={13} />
                  <span>Duplicate</span>
                </div>
              )}

              <div
                className="context-menu-item"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node!.path);
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}
              >
                <Copy size={13} />
                <span>Copy Path</span>
              </div>

              <div className="menu-separator" />
              <div
                className="context-menu-item"
                style={{ color: '#f87171' }}
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${contextMenu.node!.name}?`)) {
                    deleteNode(contextMenu.node!.id);
                  }
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          font-size: 12px;
          color: #cccccc;
          cursor: pointer;
        }
        .context-menu-item:hover {
          background-color: #04395e;
          color: white;
        }
      `}</style>
    </div>
  );
};
