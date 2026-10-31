import React, { useState } from 'react';
import { X, Code2, Globe, Server, FileCode, Cpu, Coffee, Layers } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useProjectStore } from '../../stores/projectStore.js';

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  desc: string;
  conventions: string;
  icon: React.ReactNode;
}

const TEMPLATES: TemplateItem[] = [
  {
    id: 'python',
    name: 'Python Application',
    category: 'Python',
    desc: 'Python 3 workspace with modular src/ structure and dependency manifests.',
    conventions: 'src/main.py • requirements.txt • pyproject.toml',
    icon: <FileCode size={20} color="#10b981" />,
  },
  {
    id: 'java',
    name: 'Java Application',
    category: 'Java',
    desc: 'Maven-compliant structure with public class Main in Main.java.',
    conventions: 'src/main/java/Main.java • pom.xml',
    icon: <Coffee size={20} color="#ea580c" />,
  },
  {
    id: 'cpp',
    name: 'C++ Workspace',
    category: 'C/C++',
    desc: 'C++17 modular project with GCC/G++ build runner and include paths.',
    conventions: 'src/main.cpp • src/include • include/ • Makefile',
    icon: <Cpu size={20} color="#818cf8" />,
  },
  {
    id: 'c',
    name: 'C Workspace',
    category: 'C/C++',
    desc: 'C11 modular project with GCC build runner and include conventions.',
    conventions: 'src/main.c • src/include • include/ • Makefile',
    icon: <Cpu size={20} color="#38bdf8" />,
  },
  {
    id: 'typescript',
    name: 'TypeScript Workspace',
    category: 'JS/TS',
    desc: 'ES-module TypeScript project with tsconfig and native runtime execution.',
    conventions: 'package.json • tsconfig.json • src/index.ts',
    icon: <FileCode size={20} color="#3b82f6" />,
  },
  {
    id: 'javascript',
    name: 'JavaScript / Node',
    category: 'JS/TS',
    desc: 'Modern Node.js ES module workspace with src/ conventions.',
    conventions: 'package.json • src/index.js',
    icon: <FileCode size={20} color="#facc15" />,
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    category: 'Web',
    desc: 'Modern React 18 single-page app with Vite setup.',
    conventions: 'src/App.jsx • package.json',
    icon: <Code2 size={20} color="#38bdf8" />,
  },
  {
    id: 'node-express',
    name: 'Node & Express API',
    category: 'Web',
    desc: 'REST API backend server with Express routes.',
    conventions: 'src/index.js • package.json',
    icon: <Server size={20} color="#22c55e" />,
  },
  {
    id: 'vanilla',
    name: 'Vanilla Web',
    category: 'Web',
    desc: 'HTML5, CSS3, and JavaScript with live preview.',
    conventions: 'index.html • style.css • main.js',
    icon: <Globe size={20} color="#f97316" />,
  },
  {
    id: 'empty',
    name: 'Empty Workspace',
    category: 'Custom',
    desc: 'Blank canvas for custom folder conventions and custom tools.',
    conventions: 'Unrestricted arbitrary custom files & folders',
    icon: <Layers size={20} color="#94a3b8" />,
  },
];

export const NewProjectModal: React.FC = () => {
  const { newProjectModalOpen, setNewProjectModalOpen } = useSettingsStore();
  const { createProject, projects, selectProject } = useProjectStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('python');
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
        style={{ width: '640px', maxWidth: '90vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0 }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
              Create Language-Aware Workspace
            </span>
          </div>
          <button
            onClick={() => setNewProjectModalOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          {/* Project Name */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 4 }}>
              Project Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. collaborative-data-processor"
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
              placeholder="Brief summary of workspace goals..."
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: '#cccccc' }}>
                Language Template & Folder Conventions
              </label>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Custom folders can be added freely anytime
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                maxHeight: '260px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
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
                      backgroundColor: isSelected ? 'rgba(0, 122, 204, 0.18)' : '#252526',
                      border: `1px solid ${isSelected ? '#007acc' : '#3c3c3c'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ marginTop: 2 }}>{tmpl.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{tmpl.name}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.2 }}>
                        {tmpl.desc}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: '#38bdf8',
                          backgroundColor: '#1e293b',
                          padding: '2px 6px',
                          borderRadius: 3,
                          marginTop: 5,
                          fontFamily: 'monospace',
                          display: 'inline-block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tmpl.conventions}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
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
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>

        {/* Existing Projects section */}
        {projects.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid #3c3c3c', backgroundColor: '#181818' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8 }}>
              OR OPEN RECENT WORKSPACE
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: '65px', overflowY: 'auto' }}>
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
                  {p.name} ({p.template})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
