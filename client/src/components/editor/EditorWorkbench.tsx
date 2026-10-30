import React, { useState } from 'react';
import { useEditorStore } from '../../stores/editorStore.js';
import { EditorTabs } from './EditorTabs.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { MonacoInstance } from './MonacoInstance.js';
import { DiffEditorModal } from './DiffEditorModal.js';
import { FileHistoryModal } from '../history/FileHistoryModal.js';

export const EditorWorkbench: React.FC = () => {
  const { splitMode } = useEditorStore();
  const [splitRatio, setSplitRatio] = useState(50); // percentage

  const isSplit = splitMode !== 'none';

  return (
    <div className="nexus-editor-area">
      <DiffEditorModal />
      <FileHistoryModal />

      {isSplit ? (
        <div
          style={{
            display: 'flex',
            flexDirection: splitMode === 'vertical' ? 'row' : 'column',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* First Editor Group */}
          <div
            style={{
              flex: splitRatio,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 150,
              minHeight: 150,
              overflow: 'hidden',
            }}
          >
            <EditorTabs isSplit={false} />
            <Breadcrumbs isSplit={false} />
            <MonacoInstance isSplit={false} />
          </div>

          {/* Split Resizer */}
          <div
            className={splitMode === 'vertical' ? 'resizer-horizontal' : 'resizer-vertical'}
            style={{ background: '#282828' }}
          />

          {/* Second Editor Group */}
          <div
            style={{
              flex: 100 - splitRatio,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 150,
              minHeight: 150,
              overflow: 'hidden',
            }}
          >
            <EditorTabs isSplit={true} />
            <Breadcrumbs isSplit={true} />
            <MonacoInstance isSplit={true} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
          <EditorTabs isSplit={false} />
          <Breadcrumbs isSplit={false} />
          <MonacoInstance isSplit={false} />
        </div>
      )}
    </div>
  );
};
