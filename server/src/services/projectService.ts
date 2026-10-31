import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { config } from '../config/index.js';
import { ProjectRepository, IProject } from '../models/Project.js';
import { FileNodeRepository, IFileNode } from '../models/FileNode.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';

export class ProjectService {
  static getProjectPath(projectId: string): string {
    return path.join(config.storageDir, projectId);
  }

  static async createProject(userId: string, name: string, description: string = '', template: string = 'vanilla', isPublic: boolean = false): Promise<IProject> {
    const projectId = uuidv4();
    const projectDir = this.getProjectPath(projectId);

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const project: IProject = {
      id: projectId,
      name,
      description,
      ownerId: userId,
      template,
      isPublic,
      rootPath: projectDir,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdProject = await ProjectRepository.create(project);

    // Add owner membership
    await ProjectMemberRepository.addMember({
      id: uuidv4(),
      projectId,
      userId,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });

    // Populate template files
    await this.applyTemplate(projectId, template, projectDir);

    return createdProject;
  }

  static async applyTemplate(projectId: string, template: string, projectDir: string): Promise<void> {
    const templates: Record<string, { [filePath: string]: string }> = {
      vanilla: {
        'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CollabIDE Vanilla App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="card">
    <h1>🚀 Welcome to CollabIDE!</h1>
    <p>A full-stack collaborative IDE running directly in your browser.</p>
    <button id="counter-btn">Clicks: 0</button>
  </div>
  <script src="main.js"></script>
</body>
</html>`,
        'style.css': `body {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #0f172a;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
}
.card {
  text-align: center;
  padding: 2.5rem;
  background: #1e293b;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
  border: 1px solid #334155;
}
h1 {
  font-size: 1.75rem;
  margin-bottom: 0.75rem;
  color: #38bdf8;
}
p {
  color: #94a3b8;
  margin-bottom: 1.5rem;
}
button {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 0.6rem 1.4rem;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}
button:hover {
  background: #1d4ed8;
}`,
        'main.js': `let count = 0;
const btn = document.getElementById('counter-btn');

btn.addEventListener('click', () => {
  count++;
  btn.textContent = \`Clicks: \${count}\`;
});

console.log('CollabIDE App initialized successfully.');`,
        'README.md': `# CollabIDE Vanilla Web Template
Welcome to your new collaborative project in CollabIDE.
- Edit \`index.html\`, \`style.css\`, or \`main.js\`.
- Real-time changes appear instantly across all collaborators.
- Click Run or use the terminal to test your code!`
      },
      'react-vite': {
        'package.json': `{
  "name": "collabide-react-vite-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}`,
        'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CollabIDE React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
        'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        'src/App.jsx': `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <h1>⚡ CollabIDE React + Vite App</h1>
      <p>Real-time collaborative editing with Monaco & Yjs.</p>
      <button onClick={() => setCount(c => c + 1)}>
        Count is {count}
      </button>
    </div>
  );
}`,
        'src/index.css': `body {
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: #090d16;
  color: #e2e8f0;
  font-family: Inter, sans-serif;
}
.container {
  padding: 2rem;
  background: #111827;
  border-radius: 8px;
  border: 1px solid #1f2937;
  text-align: center;
}
button {
  background: #0ea5e9;
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}`,
        'README.md': `# CollabIDE React + Vite Template
A modern React starter configured for CollabIDE collaborative development.`
      },
      'node-express': {
        'package.json': `{
  "name": "collabide-express-api",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}`,
        'src/index.js': `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from CollabIDE Express API!', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(\`CollabIDE API server running on port \${PORT}\`);
});`,
        'README.md': `# Node & Express API Template
Run with: \`node src/index.js\` from the terminal.`
      },
      python: {
        'main.py': `import sys
from utils import greet, calculate_fibonacci

def main():
    print("=" * 45)
    print("🚀 Running Python application in CollabIDE!")
    print(f"Python Version: {sys.version.split()[0]}")
    print("=" * 45)
    
    greeting = greet("CollabIDE Developer")
    print(greeting)
    
    print("\\nGenerating Fibonacci Sequence:")
    fib_series = calculate_fibonacci(10)
    for idx, num in enumerate(fib_series, start=1):
        print(f"Term {idx:2d}: {num}")
    
    print("\\nExecution finished successfully!")

if __name__ == '__main__':
    main()`,
        'utils.py': `def greet(name: str) -> str:
    return f"Hello, {name}! Welcome to the collaborative Python workspace."

def calculate_fibonacci(n: int) -> list:
    if n <= 0:
        return []
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]`,
        'requirements.txt': `# Add external Python dependencies here
requests>=2.31.0
pytest>=8.0.0`,
        'README.md': `# Python Project Template
Execute by clicking "Run File" or running \`python main.py\` in the terminal panel.`
      },
      cpp: {
        'main.cpp': `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "========================================" << std::endl;
    std::cout << "🚀 CollabIDE C++ Workspace" << std::endl;
    std::cout << "========================================" << std::endl;

    std::vector<int> numbers = {10, 20, 30, 40, 50};
    int sum = std::accumulate(numbers.begin(), numbers.end(), 0);

    std::cout << "Elements: ";
    for (int n : numbers) {
        std::cout << n << " ";
    }
    std::cout << std::endl;
    std::cout << "Total Sum = " << sum << std::endl;
    std::cout << "Average = " << static_cast<double>(sum) / numbers.size() << std::endl;

    return 0;
}`,
        'Makefile': `CXX = g++
CXXFLAGS = -std=c++17 -Wall

all: main

main: main.cpp
\t$(CXX) $(CXXFLAGS) -o main main.cpp

clean:
\trm -f main main.exe`,
        'README.md': `# C++ Project Template
Compile with: \`g++ -std=c++17 main.cpp -o main\`
Run with: \`./main\` (or \`main.exe\` on Windows)`
      },
      empty: {}
    };

    const chosenTemplate = templates[template] || templates.vanilla;

    for (const [relPath, content] of Object.entries(chosenTemplate)) {
      const fullPath = path.join(projectDir, relPath);
      const dirName = path.dirname(fullPath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');

      const parts = relPath.split(/[/\\]/);
      let currentPath = '';
      let parentId: string | null = null;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = i === parts.length - 1;

        let existing = await FileNodeRepository.findByPath(projectId, currentPath);
        if (!existing) {
          const node: IFileNode = {
            id: uuidv4(),
            projectId,
            parentId,
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            content: isFile ? content : undefined,
            language: isFile ? this.detectLanguage(part) : undefined,
            size: isFile ? Buffer.byteLength(content, 'utf-8') : 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          existing = await FileNodeRepository.create(node);
        }
        parentId = existing.id;
      }
    }
  }

  static detectLanguage(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const map: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.md': 'markdown',
      '.py': 'python',
      '.cpp': 'cpp',
      '.c++': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.java': 'java',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bat': 'bat',
      '.ps1': 'powershell',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.txt': 'plaintext',
    };
    return map[ext] || 'plaintext';
  }

  static async exportProjectZip(projectId: string, res: any): Promise<void> {
    const projectDir = this.getProjectPath(projectId);
    if (!fs.existsSync(projectDir)) {
      throw new Error('Project storage directory not found');
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(projectDir, false);
    await archive.finalize();
  }

  static async importProjectZip(userId: string, projectName: string, zipFilePath: string): Promise<IProject> {
    const project = await this.createProject(userId, projectName, 'Imported project', 'custom');
    const projectDir = this.getProjectPath(project.id);

    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    // Prevent Zip Slip / path traversal attacks
    for (const entry of zipEntries) {
      const normalized = path.normalize(entry.entryName);
      if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
        throw new Error('Invalid zip entry: Path traversal detected');
      }
    }

    zip.extractAllTo(projectDir, true);

    // Re-index all extracted files into FileNodeRepository
    await this.scanAndIndexDirectory(project.id, projectDir, projectDir, null);

    return project;
  }

  private static async scanAndIndexDirectory(projectId: string, rootDir: string, currentDir: string, parentId: string | null): Promise<void> {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      const isFile = entry.isFile();

      let content = '';
      if (isFile) {
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          content = '';
        }
      }

      let node = await FileNodeRepository.findByPath(projectId, relPath);
      if (!node) {
        node = await FileNodeRepository.create({
          id: uuidv4(),
          projectId,
          parentId,
          name: entry.name,
          path: relPath,
          type: isFile ? 'file' : 'directory',
          content: isFile ? content : undefined,
          language: isFile ? this.detectLanguage(entry.name) : undefined,
          size: isFile ? Buffer.byteLength(content, 'utf-8') : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (entry.isDirectory()) {
        await this.scanAndIndexDirectory(projectId, rootDir, fullPath, node.id);
      }
    }
  }
}
