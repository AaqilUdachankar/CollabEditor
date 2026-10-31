import { LanguageIcon } from '../common/LanguageIcon.js';
import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  Code,
  Copy,
  Trash2,
  Edit2,
  Plus
} from 'lucide-react';
import { IFileNode } from '../../types/ide.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useProjectStore } from '../../stores/projectStore.js';

interface FileTreeNodeProps {
  node: IFileNode;
  level: number;
  onContextMenu: (e: React.MouseEvent, node: IFileNode) => void;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level, onContextMenu }) => {
  const { files, renameNode } = useProjectStore();
  const { openTab, activeTabId, tabs } = useEditorStore();

  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);

  const isDirectory = node.type === 'directory';
  const childNodes = files.filter((f) => f.parentId === node.id);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isSelected = activeTab?.fileId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      setIsOpen(!isOpen);
    } else {
      openTab(node);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renameValue.trim() && renameValue !== node.name) {
      await renameNode(node.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  

  return (
    <div>
      <div
        className={`file-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, node);
        }}
        draggable={!isDirectory}
      >
        {isDirectory ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {isOpen ? <FolderOpen size={15} color="#eab308" /> : <Folder size={15} color="#eab308" />}
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', marginLeft: 16 }}>
            <LanguageIcon filename={node.name} size={15} />
          </span>
        )}

        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} style={{ flex: 1 }}>
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => setIsRenaming(false)}
              onKeyDown={(e) => e.key === 'Escape' && setIsRenaming(false)}
              style={{
                background: '#2a2a2a',
                border: '1px solid #007fd4',
                color: 'white',
                fontSize: 12,
                padding: '1px 4px',
                width: '90%',
                outline: 'none',
              }}
            />
          </form>
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        )}
      </div>

      {isDirectory && isOpen && (
        <div>
          {childNodes.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};
