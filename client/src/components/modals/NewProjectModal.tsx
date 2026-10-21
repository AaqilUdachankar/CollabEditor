import React, { useState } from 'react';
import { X, Code2, Globe, Server, FileCode, Cpu, Check } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useProjectStore } from '../../stores/projectStore.js';

const TEMPLATES = [
  {
    id: 'vanilla',
    name: 'Vanilla Web',
    desc: 'HTML5, CSS3, and JavaScript with live preview.',
    icon: <Globe size={20} color="#f97316" />,
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    desc: 'Modern React 18 single-page app with Vite setup.',
    icon: <Code2 size={20} color="#38bdf8" />,
  },
  {
    id: 'node-express',
    name: 'Node & Express API',
    desc: 'REST API backend server with Express routes.',
    icon: <Server size={20} color="#22c55e" />,
  },
  {
    id: 'python',
    name: 'Python Application',
    desc: 'Python 3 script workspace with math and utility modules.',
    icon: <FileCode size={20} color="#eab308" />,
  },
  {
    id: 'cpp',
    name: 'C/C++ Workspace',
    desc: 'C++17 source files and GCC build runner.',
    icon: <Cpu size={20} color="#818cf8" />,
  },
];

export const NewProjectModal: React.FC = () => {
  const { newProjectModalOpen, setNewProjectModalOpen } = useSettingsStore();
  const { createProject, projects, selectProject } = useProjectStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('vanilla');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!newProjectModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim(),
        template: selectedTemplate,
        isPublic,
      });
      setNewProjectModalOpen(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      alert(`Failed to create project: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="palette-overlay" onClick={() => setNewProjectModalOpen(false)}>
      <div
        className="palette-box"
        style={{ width: '560px', padding: 0 }}
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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
            Create New Project
          </span>
          <button
            onClick={() => setNewProjectModalOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 18px' }}>
          {/* Project Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 4 }}>
              Project Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. my-awesome-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                background: '#2a2a2a',
                border: '1px solid #3c3c3c',
                borderRadius: 4,
                padding: '6px 10px',
                color: 'white',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 4 }}>
              Description
            </label>
            <input
              type="text"
              placeholder="Brief summary of the workspace..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                background: '#2a2a2a',
                border: '1px solid #3c3c3c',
                borderRadius: 4,
                padding: '6px 10px',
                color: 'white',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Template Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 6 }}>
              Starter Template
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px',
                      backgroundColor: isSelected ? 'rgba(0, 122, 204, 0.15)' : '#252526',
                      border: `1px solid ${isSelected ? '#007acc' : '#3c3c3c'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <div>{tmpl.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{tmpl.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.2 }}>
                        {tmpl.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button
              type="button"
              onClick={() => setNewProjectModalOpen(false)}
              style={{
                background: 'transparent',
                border: '1px solid #3c3c3c',
                color: '#cccccc',
                padding: '6px 14px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              style={{
                background: '#007acc',
                border: 'none',
                color: 'white',
                padding: '6px 16px',
                borderRadius: 4,
                cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>

        {/* Existing Projects section */}
        {projects.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid #3c3c3c', backgroundColor: '#181818' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8 }}>
              OR OPEN RECENT PROJECT
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={async () => {
                    await selectProject(p.id);
                    setNewProjectModalOpen(false);
                  }}
                  style={{
                    background: '#252526',
                    border: '1px solid #3c3c3c',
                    color: '#38bdf8',
                    padding: '4px 10px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
