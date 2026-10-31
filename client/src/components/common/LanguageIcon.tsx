import React from 'react';
import {
  FileCode,
  FileJson,
  FileText,
  Code,
  Code2,
  Cpu,
  File,
  Coffee,
  Settings,
  Terminal,
} from 'lucide-react';

interface LanguageIconProps {
  filename: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface LanguageIconInfo {
  icon: 'c' | 'cpp' | 'header' | 'java' | 'python' | 'typescript' | 'javascript' | 'react' | 'html' | 'css' | 'json' | 'build' | 'config' | 'markdown' | 'shell' | 'file';
  color: string;
  language: string;
}

export const getLanguageIconInfo = (filename: string): LanguageIconInfo => {
  const lower = filename.toLowerCase();
  const parts = lower.split('.');
  const ext = parts.length > 1 ? parts.pop()! : '';

  // Specific configuration / manifest filenames
  if (lower === 'package.json' || lower === 'package-lock.json') {
    return { icon: 'json', color: '#22c55e', language: 'npm' };
  }
  if (lower === 'tsconfig.json' || lower === 'jsconfig.json') {
    return { icon: 'json', color: '#3b82f6', language: 'typescript' };
  }
  if (lower === 'requirements.txt' || lower === 'pyproject.toml') {
    return { icon: 'config', color: '#10b981', language: 'python' };
  }
  if (lower === 'makefile' || lower === 'cmakelists.txt') {
    return { icon: 'build', color: '#f59e0b', language: 'makefile' };
  }
  if (lower === 'pom.xml' || lower === 'build.gradle') {
    return { icon: 'build', color: '#ea580c', language: 'java' };
  }
  if (lower.startsWith('.env')) {
    return { icon: 'config', color: '#ef4444', language: 'env' };
  }
  if (lower === '.gitignore' || lower === '.gitattributes') {
    return { icon: 'config', color: '#f97316', language: 'git' };
  }

  // Extensions
  switch (ext) {
    case 'c':
      return { icon: 'c', color: '#38bdf8', language: 'c' };
    case 'cpp':
    case 'cxx':
    case 'cc':
    case 'c++':
    case 'cp':
      return { icon: 'cpp', color: '#6366f1', language: 'cpp' };
    case 'h':
    case 'hpp':
    case 'hxx':
    case 'hh':
      return { icon: 'header', color: '#a855f7', language: 'c-header' };
    case 'java':
      return { icon: 'java', color: '#ea580c', language: 'java' };
    case 'py':
    case 'pyw':
      return { icon: 'python', color: '#10b981', language: 'python' };
    case 'ts':
      return { icon: 'typescript', color: '#3b82f6', language: 'typescript' };
    case 'tsx':
    case 'jsx':
      return { icon: 'react', color: '#06b6d4', language: 'react' };
    case 'js':
    case 'mjs':
    case 'cjs':
      return { icon: 'javascript', color: '#facc15', language: 'javascript' };
    case 'html':
    case 'htm':
      return { icon: 'html', color: '#f97316', language: 'html' };
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return { icon: 'css', color: '#38bdf8', language: 'css' };
    case 'json':
      return { icon: 'json', color: '#eab308', language: 'json' };
    case 'md':
    case 'markdown':
      return { icon: 'markdown', color: '#94a3b8', language: 'markdown' };
    case 'xml':
    case 'svg':
      return { icon: 'html', color: '#fb923c', language: 'xml' };
    case 'sql':
      return { icon: 'header', color: '#a855f7', language: 'sql' };
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'bat':
    case 'cmd':
      return { icon: 'shell', color: '#4ade80', language: 'shell' };
    default:
      return { icon: 'file', color: '#94a3b8', language: 'plaintext' };
  }
};

export const LanguageIcon: React.FC<LanguageIconProps> = ({ filename, size = 15, className, style }) => {
  const { icon, color } = getLanguageIconInfo(filename);

  switch (icon) {
    case 'c':
    case 'cpp':
      return <Cpu size={size} color={color} className={className} style={style} />;
    case 'header':
      return <FileCode size={size} color={color} className={className} style={style} />;
    case 'java':
      return <Coffee size={size} color={color} className={className} style={style} />;
    case 'python':
    case 'typescript':
    case 'javascript':
      return <FileCode size={size} color={color} className={className} style={style} />;
    case 'react':
      return <Code2 size={size} color={color} className={className} style={style} />;
    case 'html':
    case 'css':
      return <Code size={size} color={color} className={className} style={style} />;
    case 'json':
      return <FileJson size={size} color={color} className={className} style={style} />;
    case 'build':
      return <Settings size={size} color={color} className={className} style={style} />;
    case 'config':
    case 'markdown':
      return <FileText size={size} color={color} className={className} style={style} />;
    case 'shell':
      return <Terminal size={size} color={color} className={className} style={style} />;
    default:
      return <File size={size} color={color} className={className} style={style} />;
  }
};

