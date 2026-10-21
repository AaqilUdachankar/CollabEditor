# CollabIDE — VS Code-Inspired Collaborative Cloud IDE

CollabIDE is a full-stack, browser-based collaborative coding platform inspired by the interaction patterns, layout, density, and visual design of Visual Studio Code. Built with a TypeScript-first architecture, it provides real-time conflict-free concurrent editing (Yjs CRDTs), multi-user cursor awareness, persistent project workspaces, integrated xterm.js terminals, Git source control, and isolated code execution runtimes.

---

## 🌟 Key Features

### 1. VS Code-Inspired Workbench & Visuals
- **Activity Bar (48px)**: Slim left-side panel for switching between Explorer, Search, Source Control, Run & Debug, Extensions, and Collaborator views.
- **Resizable Sidebar**: Dynamically resizable file explorer with draggable divider.
- **Monaco Editor Engine**: Full Monaco Editor with syntax highlighting, diagnostics, line numbers, word wrap, bracket matching, code folding, minimap toggle, and auto-indentation.
- **Tabs & Breadcrumbs**: Multi-file tab management with dirty-state indicators, middle-click tab closure, split editor groups (horizontal/vertical), and path breadcrumbs.
- **Command Palette & Quick Open**: Keyboard-first interaction via `Ctrl+Shift+P` (Command Palette) and `Ctrl+P` (Quick Open file fuzzy search).
- **Dark Theme Aesthetics**: VS Code Dark+ inspired deep charcoal palette (`#181818`, `#1e1e1e`), restrained blue accents (`#007acc`), crisp typography (`Inter` for UI, `JetBrains Mono` for code).

### 2. Real-Time Multiplayer Collaboration
- **Yjs CRDT Synchronization**: True bidirectional, peer-to-peer style conflict-free text synchronization over WebSockets (`y-websocket`). Edits merge without last-write-wins data loss.
- **Collaborator Presence & Carets**: Real-time remote carets with distinct accessible user colors, name tags, selection highlights, and active file indicators.
- **Live File Tree Sync**: File creation, renaming, and deletion broadcast across all peers in the project room via Socket.IO.
- **Durable CRDT Persistence**: Yjs state vectors and updates are persisted to disk and database (`/data/yjs/*.bin`), surviving server restarts and network reconnects.

### 3. Real Project Filesystem & Persistence
- **Persistent Storage**: Mirrored directly to disk (`/data/projects/<projectId>`) and indexed in the persistent document layer.
- **Starter Templates**:
  - **Vanilla Web**: HTML5, CSS3, JavaScript, README
  - **React + Vite**: React 18, JSX, CSS modules, Vite config
  - **Node.js & Express**: Express API server, routes, health endpoints
  - **Python**: Python 3 modules, Fibonacci generator, requirements.txt
  - **C/C++**: C++17 source, Makefile, GCC build target
- **File Tree Operations**: Create file/folder, inline rename, recursive deletion, duplication, copy path, and full project ZIP export.

### 4. Integrated Terminal & Isolated Code Execution
- **xterm.js Terminal**: Full xterm.js terminal with `FitAddon` and `WebLinksAddon`, streaming live shell sessions (`powershell.exe` on Windows, `bash` on Linux) over WebSockets.
- **One-Click File Runner**: Run current `.js`, `.py`, `.cpp`, `.c`, or `.html` file with real output streaming, exit code capture, and timeout guards (15s limit).
- **Environment Sanitation**: Strips backend secrets (JWT secret, DB credentials) before spawning processes in project directories.

### 5. Git Source Control
- Real Git repository initialization (`git init`) within project storage.
- Live file status (modified, added, deleted, untracked, staged).
- Stage and unstage individual files.
- Commit with author metadata and custom commit messages.
- Commit history log viewer and colored diff modal.

### 6. Authentication & Role-Based Permissions
- JWT authentication with secure password hashing via bcryptjs.
- Project-level authorization with three roles:
  - **Owner**: Full access, member management, project deletion.
  - **Editor**: Can read, write, create files, run code, and use the terminal.
  - **Viewer**: Read-only stream of documents and live cursor changes.
- Shareable invitation links with role selection and expiration.

---

## 🏗️ Architecture

```mermaid
graph TD
    Client["React + TypeScript + Monaco Client (:5173)"]
    Server["Express + Socket.IO + WebSocket Server (:5000)"]
    Storage["Workspace Disk Storage (/data/projects)"]
    DB["MongoDB / Persistent Local JSON Store (/data/db)"]
    YjsSync["Yjs CRDT Binary Persistence (/data/yjs)"]
    Runtime["Isolated Process Runner (Node / Python / GCC / Shell)"]

    Client -->|REST API| Server
    Client -->|WebSocket (Yjs Sync & Awareness)| Server
    Client -->|WebSocket (xterm.js Terminal)| Server
    Client -->|Socket.IO (Presence & FS Events)| Server

    Server --> Storage
    Server --> DB
    Server --> YjsSync
    Server --> Runtime
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0 (Node.js 22 LTS tested)
- npm >= 9.0.0
- Git (optional, for Source Control view)
- Python 3 or GCC (optional, for Python and C++ runners)

### 1. Installation

Clone repository and install dependencies:

```bash
# Install root, server, and client packages
npm install --prefix client
npm install --prefix server
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example server/.env
```

Default configuration in `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/collabide
JWT_SECRET=collabide_super_secret_jwt_key_987216
CORS_ORIGIN=http://localhost:5173
STORAGE_DIR=./data/projects
EXECUTION_TIMEOUT_MS=15000
MAX_OUTPUT_BUFFER_BYTES=1048576
```

> **Note on Database**: If a local or cloud MongoDB server is available at `MONGODB_URI`, Mongoose connects automatically. If MongoDB is not reachable, CollabIDE automatically activates its local persistent JSON document store at `./data/db/*.json`. The server never crashes and all data is persistently saved!

### 3. Running Locally

Start the backend and frontend development servers:

```bash
# Start backend server (port 5000)
npm run dev --prefix server

# In a separate terminal, start frontend client (port 5173)
npm run dev --prefix client
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing

CollabIDE includes an automated test suite covering all 6 phases:

```bash
npm test --prefix server
```

### Test Coverage (21 Automated Tests):
- ✅ **Authentication**: User registration, email lookup, password hash verification.
- ✅ **Projects**: Project creation with starter templates, owner assignment, file seeding.
- ✅ **Filesystem**: Recursive folder creation, file creation, content saving, duplication, renaming, and full-text search.
- ✅ **Git Operations**: Git repo initialization, staging, committing, and log retrieval.
- ✅ **Code Execution**: Running Python scripts inside workspace, capturing stdout/stderr and exit codes.
- ✅ **Multiplayer CRDT Collaboration**: Independent doc sync, simultaneous concurrent edits merging without data loss, CRDT state convergence.

---

## 📦 Production Build

To verify and produce production bundles:

```bash
# Build frontend client (Vite bundle with Monaco assets)
npm run build --prefix client

# Compile server TypeScript to dist/
npm run build --prefix server

# Start compiled production server
npm run start --prefix server
```

---

## 📂 Project Structure

```
Collabrative Code Editor/
├── package.json               # Root workspace scripts
├── .env.example               # Environment variables example
├── README.md                  # Comprehensive project documentation
├── client/
│   ├── index.html             # Client HTML entry point with fonts & styles
│   ├── vite.config.ts         # Vite configuration with API & WebSocket proxies
│   ├── src/
│   │   ├── index.css          # VS Code Dark+ design system & tokens
│   │   ├── main.tsx           # React root
│   │   ├── App.tsx            # Workbench layout & state coordination
│   │   ├── types/ide.ts       # Shared TypeScript interfaces
│   │   ├── stores/            # Zustand state stores (auth, project, editor, git, terminal)
│   │   ├── services/          # REST API, Socket.IO, Yjs Monaco binding, xterm session
│   │   └── components/
│   │       ├── menubar/       # Top Menu Bar, Command search, Collaborator avatars
│   │       ├── activitybar/   # 48px slim left activity navigation bar
│   │       ├── sidebar/       # Resizable Explorer, Search, Git, Debug, Extensions, Collab views
│   │       ├── editor/        # Monaco Editor, Tabs, Breadcrumbs, Diff Viewer, Splits
│   │       ├── panel/         # Resizable Bottom Panel (Terminal, Output, Problems)
│   │       ├── statusbar/     # Status Bar (branch, sync, line/col, language, presence)
│   │       ├── commandpalette/# Command Palette (Ctrl+Shift+P) & Quick Open (Ctrl+P)
│   │       ├── modals/        # New Project, Invite Link, Settings modals
│   │       └── auth/          # Login & Signup modal
└── server/
    ├── package.json           # Server dependencies & scripts
    ├── tsconfig.json          # NodeNext TypeScript configuration
    └── src/
        ├── index.ts           # Express, Socket.IO, and WebSocket server entry
        ├── config/            # Centralized environment configuration
        ├── db/                # Mongoose connection with resilient local JSON fallback
        ├── models/            # User, Project, FileNode, ProjectMember, Invitation
        ├── routes/            # REST API endpoints (/api/auth, /projects, /files, /git, /run)
        ├── controllers/       # Business logic controllers
        ├── middleware/        # JWT auth & Project Role authorization (Owner/Editor/Viewer)
        ├── services/          # ProjectService, FileService, GitService, ExecutionService, YjsPersistence
        ├── sockets/           # Socket.IO presence handler, Yjs CRDT handler, Terminal streaming
        └── tests/             # Automated test suite (runAllTests.ts)
```

---

## 🔒 Security Best Practices Implemented
- **Isolated Execution**: User code executed in subprocesses within dedicated project directories.
- **Process Resource Limits**: 15-second execution timeout guard and output buffer caps to prevent infinite loops.
- **Sanitized Environment**: Secrets (`JWT_SECRET`, `MONGODB_URI`) are stripped before running user code.
- **Zip Slip Prevention**: Project archive import inspects entry names to prevent path traversal attacks.
- **Input Sanitization**: File and folder names are stripped of dangerous OS path characters.
- **Role Verification**: WebSocket terminal and document edit operations are strictly authorized against project membership.
