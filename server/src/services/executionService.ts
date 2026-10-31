import { spawn, spawnSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ProjectService } from './projectService.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { ProjectRepository } from '../models/Project.js';
import { config } from '../config/index.js';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  command: string;
  timedOut: boolean;
}

export class ExecutionService {
  private static activeProcesses: Map<string, ChildProcess> = new Map();


  static formatToolMissingError(toolName: string, languageName: string, installGuidance: string, filePath: string): string {
    const osName = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
    return [
      `[CollabIDE Toolchain Error] Required ${languageName} tool '${toolName}' is not installed or not found in system PATH.`,
      `• Target file: ${filePath}`,
      `• Operating system: ${osName}`,
      `• Resolution: ${installGuidance}`,
      `• Alternative: Use the integrated terminal to run with custom paths or containerized runtimes.`,
    ].join('\n');
  }

  static getPythonCommand(): string {
    for (const bin of ['python', 'python3', 'py']) {
      try {
        const res = spawnSync(bin, ['--version'], { stdio: 'pipe', env: ExecutionService.getSafeEnv() });
        if (res.status === 0) return bin;
      } catch {}
    }
    return 'python';
  }

  static getAvailableToolchains(): Record<string, { installed: boolean; version?: string }> {
    const probe = (bin: string, args: string[]): { installed: boolean; version?: string } => {
      try {
        const res = spawnSync(bin, args, { stdio: 'pipe', timeout: 3000, env: ExecutionService.getSafeEnv() });
        if (res.status === 0) {
          const out = (res.stdout?.toString() || res.stderr?.toString() || '').trim().split('\n')[0];
          return { installed: true, version: out };
        }
      } catch {}
      return { installed: false };
    };

    const pyCmd = this.getPythonCommand();
    const pyProbe = probe(pyCmd, ['--version']);

    return {
      node: probe(process.execPath, ['--version']),
      python: { installed: pyProbe.installed, version: pyProbe.version },
      java: probe('java', ['-version']),
      gcc: probe('gcc', ['--version']),
      gpp: probe('g++', ['--version']),
    };
  }

  static getSafeEnv(): NodeJS.ProcessEnv {
    // Copy all system environment variables, omitting sensitive secrets and credentials
    const safeEnv = { ...process.env };
    const sensitivePattern = /(jwt|token|secret|pass|mongo|database|auth|cred|api_key)/i;
    for (const key of Object.keys(safeEnv)) {
      if (sensitivePattern.test(key)) {
        delete safeEnv[key];
      }
    }
    safeEnv.TERM = 'xterm-256color';
    safeEnv.COLORTERM = 'truecolor';
    safeEnv.PYTHONIOENCODING = 'utf-8';
    safeEnv.PYTHONUTF8 = '1';
    return safeEnv;
  }

  static async runEntryFile(projectId: string, contentOverride?: string): Promise<ExecutionResult> {
    const project = await ProjectRepository.findById(projectId);
    if (!project) throw new Error('Project not found');

    const files = await FileNodeRepository.findByProject(projectId);
    const configuredEntry = project.entryFile || ProjectService.getDefaultEntryFile(project.template);

    let targetFile = configuredEntry ? files.find((f) => f.type === 'file' && f.path.replace(/\\/g, '/') === configuredEntry.replace(/\\/g, '/')) : null;

    if (!targetFile) {
      // Fallback heuristics: find common sensible entry files
      const candidates = [
        'src/main.py', 'main.py',
        'src/main.java/Main.java', 'src/main/java/Main.java', 'Main.java',
        'src/main.cpp', 'main.cpp',
        'src/main.c', 'main.c',
        'src/index.ts', 'index.ts',
        'src/index.js', 'index.js', 'main.js',
        'src/App.jsx', 'src/App.tsx',
        'index.html'
      ];
      for (const candidate of candidates) {
        targetFile = files.find((f) => f.type === 'file' && f.path.replace(/\\/g, '/') === candidate) || null;
        if (targetFile) break;
      }
    }

    if (!targetFile) {
      // Fallback to any runnable source file
      targetFile = files.find((f) => f.type === 'file' && /\.(py|java|cpp|c|ts|js|mjs|cjs|html)$/i.test(f.name)) || null;
    }

    if (!targetFile) {
      throw new Error(`No runnable entry file found in project workspace (${project.name}). Please create or select a runnable source file.`);
    }

    return this.runFile(projectId, targetFile.id, contentOverride);
  }

  static async getRunConfig(projectId: string) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) throw new Error('Project not found');

    const files = await FileNodeRepository.findByProject(projectId);
    const defaultEntry = project.entryFile || ProjectService.getDefaultEntryFile(project.template);
    const entryNode = files.find((f) => f.type === 'file' && f.path.replace(/\\/g, '/') === defaultEntry.replace(/\\/g, '/'));

    const toolchains = this.getAvailableToolchains();

    let runnerInfo = {
      language: 'generic',
      runner: 'integrated-terminal',
      command: 'Select a file to run',
      toolRequired: '',
      isToolInstalled: true,
      folderConventions: 'Custom workspace structure',
    };

    const tmpl = (project.template || '').toLowerCase();
    if (tmpl === 'python' || tmpl === 'py') {
      runnerInfo = {
        language: 'python',
        runner: 'Python 3',
        command: 'python -u src/main.py',
        toolRequired: 'python',
        isToolInstalled: toolchains.python.installed,
        folderConventions: 'src/ for source code; requirements.txt or pyproject.toml for dependencies',
      };
    } else if (tmpl === 'cpp' || tmpl === 'c++') {
      runnerInfo = {
        language: 'cpp',
        runner: 'GCC C++ Compiler (g++)',
        command: 'g++ -std=c++17 -Isrc/include -Iinclude src/main.cpp -o runner && ./runner',
        toolRequired: 'g++',
        isToolInstalled: toolchains.gpp.installed,
        folderConventions: 'src/include and include/ for headers; src/main.cpp entry point; Makefile',
      };
    } else if (tmpl === 'c') {
      runnerInfo = {
        language: 'c',
        runner: 'GCC C Compiler (gcc)',
        command: 'gcc -std=c11 -Isrc/include -Iinclude src/main.c -o runner && ./runner',
        toolRequired: 'gcc',
        isToolInstalled: toolchains.gcc.installed,
        folderConventions: 'src/include and include/ for headers; src/main.c entry point; Makefile',
      };
    } else if (tmpl === 'java') {
      runnerInfo = {
        language: 'java',
        runner: 'Java SE (java)',
        command: 'java src/main/java/Main.java',
        toolRequired: 'java',
        isToolInstalled: toolchains.java.installed,
        folderConventions: 'src/main/java for source classes; public class Main matching filename; pom.xml',
      };
    } else if (tmpl === 'typescript' || tmpl === 'ts') {
      runnerInfo = {
        language: 'typescript',
        runner: 'Node.js (Native TS Strip Types)',
        command: 'node --experimental-strip-types src/index.ts',
        toolRequired: 'node',
        isToolInstalled: toolchains.node.installed,
        folderConventions: 'package.json and tsconfig.json; src/ for source modules',
      };
    } else if (tmpl === 'javascript' || tmpl === 'js' || tmpl === 'node' || tmpl === 'node-express') {
      runnerInfo = {
        language: 'javascript',
        runner: 'Node.js',
        command: 'node src/index.js',
        toolRequired: 'node',
        isToolInstalled: toolchains.node.installed,
        folderConventions: 'package.json and src/ folder convention',
      };
    }

    return {
      projectId,
      projectName: project.name,
      template: project.template,
      entryFile: defaultEntry,
      entryFileId: entryNode ? entryNode.id : null,
      runnerInfo,
      toolchains,
    };
  }

  static async runFile(projectId: string, fileId: string, contentOverride?: string): Promise<ExecutionResult> {
    const file = await FileNodeRepository.findById(fileId);
    if (!file || file.projectId !== projectId) {
      throw new Error('File not found in project');
    }
    if (file.type !== 'file') {
      throw new Error('Selected item is a directory, not a runnable file');
    }

    const projectDir = ProjectService.getProjectPath(projectId);
    const fullFilePath = path.join(projectDir, file.path);
    const ext = path.extname(file.name).toLowerCase();

    // Ensure target directory exists on disk
    const dirName = path.dirname(fullFilePath);
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }

    // Flush latest code content to disk and update database record
    const contentToRun = contentOverride !== undefined ? contentOverride : (file.content ?? '');
    fs.writeFileSync(fullFilePath, contentToRun, 'utf-8');
    await FileNodeRepository.update(fileId, {
      content: contentToRun,
      size: Buffer.byteLength(contentToRun, 'utf-8'),
    });

    const startTime = Date.now();
    let cmd = '';
    let args: string[] = [];
    const executionEnv = this.getSafeEnv();

    switch (ext) {
      case '.js':
      case '.mjs':
      case '.cjs':
        cmd = process.execPath;
        args = [fullFilePath];
        break;
      case '.ts':
      case '.tsx':
        cmd = process.execPath;
        args = ['--experimental-strip-types', fullFilePath];
        break;
      case '.py': {
        cmd = this.getPythonCommand();
        args = ['-u', fullFilePath];
        const srcDir = path.join(projectDir, 'src');
        const fileDir = path.dirname(fullFilePath);
        const existingPyPath = executionEnv.PYTHONPATH ? `${executionEnv.PYTHONPATH}${path.delimiter}` : '';
        executionEnv.PYTHONPATH = `${existingPyPath}${srcDir}${path.delimiter}${fileDir}${path.delimiter}${projectDir}`;
        break;
      }
      case '.java':
        cmd = 'java';
        args = [fullFilePath];
        break;
      case '.cpp':
      case '.c++':
      case '.cc':
      case '.cxx':
      case '.cp':
      case '.c': {
        const isCpp = ext !== '.c';
        const compiler = isCpp ? 'g++' : 'gcc';
        const outName = path.join(projectDir, process.platform === 'win32' ? 'runner.exe' : 'runner');

        // Include directories convention
        const includeFlags: string[] = [];
        const inc1 = path.join(projectDir, 'src', 'include');
        const inc2 = path.join(projectDir, 'include');
        const inc3 = path.join(projectDir, 'src');
        if (fs.existsSync(inc1)) includeFlags.push('-I', inc1);
        if (fs.existsSync(inc2)) includeFlags.push('-I', inc2);
        if (fs.existsSync(inc3)) includeFlags.push('-I', inc3);

        const compileArgs = [...includeFlags, fullFilePath, '-o', outName];
        if (isCpp) compileArgs.unshift('-std=c++17');
        else compileArgs.unshift('-std=c11');

        const compileRes = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolveCompile) => {
          let cStdout = '';
          let cStderr = '';
          const compileProc = spawn(compiler, compileArgs, {
            cwd: projectDir,
            env: executionEnv,
            shell: false,
          });

          compileProc.stdout?.on('data', (d) => { cStdout += d.toString(); });
          compileProc.stderr?.on('data', (d) => { cStderr += d.toString(); });
          compileProc.on('error', (err: any) => {
            const isMissing = err.code === 'ENOENT' || err.message?.includes('ENOENT');
            const guidance = isCpp
              ? 'Install GCC/G++ (e.g. MinGW-w64 on Windows, build-essential on Linux, or Xcode tools on macOS).'
              : 'Install GCC (e.g. MinGW-w64 on Windows, build-essential on Linux, or Xcode tools on macOS).';
            const errMsg = isMissing
              ? ExecutionService.formatToolMissingError(compiler, isCpp ? 'C++' : 'C', guidance, file.path)
              : `Compiler error: ${err.message}`;
            resolveCompile({ stdout: cStdout, stderr: cStderr + (cStderr ? '\n' : '') + errMsg, code: 127 });
          });
          compileProc.on('close', (code) => {
            resolveCompile({ stdout: cStdout, stderr: cStderr, code });
          });
        });

        if (compileRes.code !== 0) {
          return {
            stdout: compileRes.stdout,
            stderr: compileRes.stderr || `[CollabIDE Compilation] Build failed with exit code ${compileRes.code}`,
            exitCode: compileRes.code ?? 1,
            durationMs: Date.now() - startTime,
            command: `${compiler} ${compileArgs.join(' ')}`,
            timedOut: false,
          };
        }

        // Ensure executable permissions on Unix platforms
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(outName, 0o755);
          } catch {}
        }

        cmd = outName;
        args = [];
        break;
      }
      case '.html':
      case '.htm':
        return {
          stdout: `Web preview ready. Open browser preview at project root: ${file.path}\n`,
          stderr: '',
          exitCode: 0,
          durationMs: 1,
          command: `view ${file.path}`,
          timedOut: false,
        };
      default:
        throw new Error(`Execution not supported for file type "${ext}". Supported types: .py, .java, .c, .cpp, .js, .ts. Run other files via the integrated terminal.`);
    }

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let timedOut = false;

    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: projectDir,
        env: executionEnv,
        shell: false,
      });

      const procId = `${projectId}_${fileId}_${Date.now()}`;
      this.activeProcesses.set(procId, child);

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, config.executionTimeoutMs);

      child.stdout?.on('data', (data) => {
        if (stdoutBuffer.length < config.maxOutputBufferBytes) {
          stdoutBuffer += data.toString();
        }
      });

      child.stderr?.on('data', (data) => {
        if (stderrBuffer.length < config.maxOutputBufferBytes) {
          stderrBuffer += data.toString();
        }
      });

      child.on('error', (err: any) => {
        clearTimeout(timer);
        this.activeProcesses.delete(procId);

        const isMissing = err.code === 'ENOENT' || err.message?.includes('ENOENT');
        let errMsg = `Process error: ${err.message}`;

        if (isMissing) {
          if (cmd === 'java') {
            errMsg = ExecutionService.formatToolMissingError(
              'java',
              'Java',
              'Install Java Development Kit (JDK 11+) from https://adoptium.net/ and ensure "java" is added to system PATH.',
              file.path
            );
          } else if (cmd.startsWith('python') || cmd === 'py') {
            errMsg = ExecutionService.formatToolMissingError(
              cmd,
              'Python',
              'Install Python 3 from https://www.python.org/downloads/ and ensure "python" or "python3" is added to system PATH.',
              file.path
            );
          } else {
            errMsg = ExecutionService.formatToolMissingError(
              cmd,
              'Runtime',
              `Ensure "${cmd}" is installed and available in your environment PATH.`,
              file.path
            );
          }
        }

        resolve({
          stdout: stdoutBuffer,
          stderr: stderrBuffer + (stderrBuffer ? '\n' : '') + errMsg,
          exitCode: isMissing ? 127 : 1,
          durationMs: Date.now() - startTime,
          command: `${cmd} ${args.join(' ')}`,
          timedOut: false,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        this.activeProcesses.delete(procId);
        resolve({
          stdout: stdoutBuffer,
          stderr: stderrBuffer + (timedOut ? `\n[CollabIDE Execution] Process timed out after ${config.executionTimeoutMs / 1000} seconds.` : ''),
          exitCode: timedOut ? 124 : code,
          durationMs: Date.now() - startTime,
          command: `${cmd} ${args.join(' ')}`,
          timedOut,
        });
      });
    });
  }

  static checkEnvironmentCapabilities(projectDir: string) {
    let gitAvailable = false;
    let npmAvailable = false;
    let fsWritable = false;

    try {
      const gitRes = spawnSync('git', ['--version'], { stdio: 'pipe' });
      gitAvailable = gitRes.status === 0;
    } catch {
      gitAvailable = false;
    }

    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const npmRes = spawnSync(npmCmd, ['--version'], { stdio: 'pipe' });
      npmAvailable = npmRes.status === 0;
    } catch {
      npmAvailable = false;
    }

    try {
      const testFile = path.join(projectDir, `.collabide_test_${Date.now()}`);
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      fsWritable = true;
    } catch {
      fsWritable = false;
    }

    return {
      ptySupported: false,
      persistentShell: true,
      gitAvailable,
      npmAvailable,
      fsWritable,
      mode: 'emulated' as const,
    };
  }

  static spawnTerminal(
    sessionId: string,
    projectId: string,
    onData: (chunk: string) => void,
    onExit: (code: number) => void
  ): {
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    restart: () => void;
    kill: () => void;
  } {
    const projectDir = path.resolve(ProjectService.getProjectPath(projectId));
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const caps = this.checkEnvironmentCapabilities(projectDir);

    let currentCwd = projectDir;
    let lineBuffer = '';
    const history: string[] = [];
    let historyIndex = 0;
    let currentChild: ChildProcess | null = null;
    let currentCommandTimer: NodeJS.Timeout | null = null;
    let isTerminated = false;
    let cols = 80;
    let rows = 24;

    const getPrompt = () => {
      const rel = path.relative(projectDir, currentCwd).replace(/\\/g, '/');
      const display = rel ? `~/${rel}` : '~';
      return `\x1b[1;32mcollabide\x1b[0m:\x1b[1;34m${display}\x1b[0m$ `;
    };

    const printPrompt = () => {
      if (!isTerminated) {
        onData(getPrompt());
      }
    };

    const sendBanner = () => {
      const gitText = caps.gitAvailable ? '\x1b[32mActive\x1b[0m' : '\x1b[33mNot in PATH\x1b[0m';
      const npmText = caps.npmAvailable ? '\x1b[32mActive\x1b[0m' : '\x1b[33mNot in PATH\x1b[0m';
      const ptyText = '\x1b[36mEmulated (Sandbox Isolation)\x1b[0m';
      const fsText = caps.fsWritable ? '\x1b[32mWritable\x1b[0m' : '\x1b[31mRead-Only\x1b[0m';

      onData(
        `\r\n\x1b[1;34m⚡ CollabIDE Interactive Terminal Session\x1b[0m\r\n` +
        `\x1b[90mCaps: [PTY: ${ptyText}\x1b[90m] [Git: ${gitText}\x1b[90m] [NPM: ${npmText}\x1b[90m] [FS: ${fsText}\x1b[90m]\x1b[0m\r\n` +
        `\x1b[90mWorkspace Root: ${projectDir}\x1b[0m\r\n` +
        `\x1b[90mType "help" for built-in commands or run project scripts.\x1b[0m\r\n\r\n`
      );
      printPrompt();
    };

    const killActiveProcess = () => {
      if (currentCommandTimer) {
        clearTimeout(currentCommandTimer);
        currentCommandTimer = null;
      }
      if (currentChild && !currentChild.killed) {
        try {
          if (process.platform === 'win32' && currentChild.pid) {
            spawnSync('taskkill', ['/pid', String(currentChild.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            currentChild.kill('SIGINT');
          }
        } catch {
          // ignore
        }
        currentChild = null;
      }
      ExecutionService.activeProcesses.delete(`${sessionId}_cmd`);
    };

    const formatDirectoryListing = (dirPath: string, longFormat: boolean): string => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        if (entries.length === 0) {
          return '\x1b[90m(empty directory)\x1b[0m\r\n';
        }

        if (!longFormat) {
          const names = entries.map((e) => {
            if (e.isDirectory()) {
              return `\x1b[1;34m${e.name}/\x1b[0m`;
            } else if (/\.(js|mjs|cjs|py|sh|bat|cmd|exe)$/i.test(e.name)) {
              return `\x1b[1;32m${e.name}\x1b[0m`;
            }
            return `\x1b[0m${e.name}\x1b[0m`;
          });
          return names.join('  ') + '\r\n';
        }

        let out = `total ${entries.length}\r\n`;
        for (const entry of entries) {
          try {
            const st = fs.statSync(path.join(dirPath, entry.name));
            const typeChar = entry.isDirectory() ? 'd' : '-';
            const sizeStr = String(st.size).padStart(8, ' ');
            const mtime = st.mtime.toLocaleDateString() + ' ' + st.mtime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const nameColor = entry.isDirectory()
              ? `\x1b[1;34m${entry.name}/\x1b[0m`
              : (/\.(js|mjs|cjs|py|sh|bat|cmd|exe)$/i.test(entry.name) ? `\x1b[1;32m${entry.name}\x1b[0m` : entry.name);
            out += `${typeChar}rwxr-xr-x 1 collabide collabide ${sizeStr} ${mtime} ${nameColor}\r\n`;
          } catch {
            out += `-rwxr-xr-x 1 collabide collabide        0 Jan 01 00:00 ${entry.name}\r\n`;
          }
        }
        return out;
      } catch (err: any) {
        return `\x1b[31mls: ${err.message}\x1b[0m\r\n`;
      }
    };

    const executeCommand = (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) {
        printPrompt();
        return;
      }

      const [firstWord, ...args] = trimmed.split(/\s+/);
      const lower = firstWord.toLowerCase();

      // 1. Built-in: pwd
      if (lower === 'pwd') {
        onData(`${currentCwd}\r\n`);
        printPrompt();
        return;
      }

      // 2. Built-in: cd
      if (lower === 'cd') {
        const target = args.join(' ').trim();
        let targetDir = projectDir;

        if (target && target !== '~' && target !== '/') {
          targetDir = path.resolve(currentCwd, target);
        }

        // Workspace isolation: forbid navigating outside project directory
        const rel = path.relative(projectDir, targetDir);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          onData(`\x1b[31mcd: Access denied: Path traversal outside project workspace is restricted.\x1b[0m\r\n`);
          printPrompt();
          return;
        }

        if (!fs.existsSync(targetDir)) {
          onData(`\x1b[31mcd: ${target}: No such file or directory\x1b[0m\r\n`);
          printPrompt();
          return;
        }

        try {
          const stat = fs.statSync(targetDir);
          if (!stat.isDirectory()) {
            onData(`\x1b[31mcd: ${target}: Not a directory\x1b[0m\r\n`);
            printPrompt();
            return;
          }
          currentCwd = targetDir;
        } catch (err: any) {
          onData(`\x1b[31mcd: ${err.message}\x1b[0m\r\n`);
        }
        printPrompt();
        return;
      }

      // 3. Built-in: ls or dir
      if (lower === 'ls' || lower === 'dir') {
        const isLong = args.some((a) => a.startsWith('-') && a.includes('l'));
        const dirArg = args.find((a) => !a.startsWith('-'));
        let targetDir = currentCwd;
        if (dirArg) {
          targetDir = path.resolve(currentCwd, dirArg);
          const rel = path.relative(projectDir, targetDir);
          if (rel.startsWith('..') || path.isAbsolute(rel)) {
            onData(`\x1b[31mls: Access denied: Path traversal outside workspace.\x1b[0m\r\n`);
            printPrompt();
            return;
          }
        }
        onData(formatDirectoryListing(targetDir, isLong));
        printPrompt();
        return;
      }

      // 4. Built-in: clear or cls
      if (lower === 'clear' || lower === 'cls') {
        onData('\x1b[2J\x1b[H');
        printPrompt();
        return;
      }

      // 5. Built-in: exit
      if (lower === 'exit') {
        onData(`\r\n\x1b[90m[Process exited with code 0]\x1b[0m\r\n`);
        isTerminated = true;
        killActiveProcess();
        ExecutionService.activeProcesses.delete(sessionId);
        onExit(0);
        return;
      }

      // 6. Built-in: help
      if (lower === 'help') {
        onData(
          `\r\n\x1b[1;36mCollabIDE Interactive Terminal Commands:\x1b[0m\r\n` +
          `  \x1b[32mpwd\x1b[0m                   Print current working directory\r\n` +
          `  \x1b[32mcd <dir>\x1b[0m              Change directory (scoped within workspace)\r\n` +
          `  \x1b[32mls [-l] / dir\x1b[0m         List files in current directory\r\n` +
          `  \x1b[32mclear / cls\x1b[0m           Clear screen buffer\r\n` +
          `  \x1b[32mexit\x1b[0m                  Close terminal session\r\n` +
          `  \x1b[32mhelp\x1b[0m                  Display this guidance\r\n` +
          `\x1b[1;36mExternal System Runtimes:\x1b[0m\r\n` +
          `  \x1b[32mnpm <args>\x1b[0m            Node Package Manager (installed)\r\n` +
          `  \x1b[32mgit <args>\x1b[0m            Git Version Control (installed)\r\n` +
          `  \x1b[32mnode / python\x1b[0m         Execute project files\r\n\r\n`
        );
        printPrompt();
        return;
      }

      // 7. Spawn external command
      const isWin = process.platform === 'win32';
      const shell = isWin ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
      const shellArgs = isWin ? ['/d', '/s', '/c', trimmed] : ['-c', trimmed];

      try {
        const child = spawn(shell, shellArgs, {
          cwd: currentCwd,
          env: ExecutionService.getSafeEnv(),
          windowsVerbatimArguments: isWin,
        });

        currentChild = child;
        ExecutionService.activeProcesses.set(`${sessionId}_cmd`, child);

        const formatOutput = (buf: Buffer | string) => {
          return buf.toString().replace(/\r?\n/g, '\r\n');
        };

        child.stdout?.on('data', (data) => {
          if (!isTerminated) {
            onData(formatOutput(data));
          }
        });

        child.stderr?.on('data', (data) => {
          if (!isTerminated) {
            onData(formatOutput(data));
          }
        });

        // Command timeout guard
        currentCommandTimer = setTimeout(() => {
          if (currentChild === child) {
            onData('\r\n\x1b[33m[CollabIDE] Command exceeded 120s timeout. Terminating...\x1b[0m\r\n');
            killActiveProcess();
            printPrompt();
          }
        }, 120000);

        child.on('close', (code) => {
          if (currentCommandTimer) {
            clearTimeout(currentCommandTimer);
            currentCommandTimer = null;
          }
          if (currentChild === child) {
            currentChild = null;
          }
          ExecutionService.activeProcesses.delete(`${sessionId}_cmd`);
          if (code !== 0 && code !== null) {
            onData(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
          }
          printPrompt();
        });

        child.on('error', (err) => {
          if (currentCommandTimer) {
            clearTimeout(currentCommandTimer);
            currentCommandTimer = null;
          }
          if (currentChild === child) {
            currentChild = null;
          }
          ExecutionService.activeProcesses.delete(`${sessionId}_cmd`);
          onData(`\r\n\x1b[31mProcess error: ${err.message}\x1b[0m\r\n`);
          printPrompt();
        });
      } catch (err: any) {
        onData(`\r\n\x1b[31mFailed to spawn command: ${err.message}\x1b[0m\r\n`);
        printPrompt();
      }
    };

    // Initial session start
    setTimeout(() => {
      if (!isTerminated) {
        sendBanner();
      }
    }, 50);

    return {
      write: (data: string) => {
        if (isTerminated) return;

        // If a command process is running, forward raw keystrokes or handle Ctrl+C
        if (currentChild && !currentChild.killed) {
          if (data.includes('\x03')) {
            onData('^C\r\n');
            killActiveProcess();
            printPrompt();
            return;
          }
          if (currentChild.stdin?.writable) {
            currentChild.stdin.write(data);
          }
          return;
        }

        // At interactive prompt
        // Check for Arrow Keys / Escape sequences
        if (data === '\x1b[A') {
          // Up arrow: recall previous history
          if (history.length > 0 && historyIndex > 0) {
            historyIndex--;
            const item = history[historyIndex] || '';
            onData(`\r\x1b[K${getPrompt()}${item}`);
            lineBuffer = item;
          }
          return;
        }

        if (data === '\x1b[B') {
          // Down arrow: recall next history
          if (historyIndex < history.length - 1) {
            historyIndex++;
            const item = history[historyIndex] || '';
            onData(`\r\x1b[K${getPrompt()}${item}`);
            lineBuffer = item;
          } else if (historyIndex === history.length - 1) {
            historyIndex = history.length;
            onData(`\r\x1b[K${getPrompt()}`);
            lineBuffer = '';
          }
          return;
        }

        if (data === '\x03') {
          // Ctrl+C at prompt: clear buffer and newline
          onData('^C\r\n');
          lineBuffer = '';
          printPrompt();
          return;
        }

        if (data === '\x0c') {
          // Ctrl+L: clear screen
          onData(`\x1b[2J\x1b[H${getPrompt()}${lineBuffer}`);
          return;
        }

        if (data === '\t') {
          // Tab auto-complete
          try {
            const parts = lineBuffer.split(/\s+/);
            const token = parts[parts.length - 1] || '';
            if (token) {
              const files = fs.readdirSync(currentCwd);
              const matched = files.filter((f) => f.toLowerCase().startsWith(token.toLowerCase()));
              if (matched.length === 1) {
                const completion = matched[0].slice(token.length);
                lineBuffer += completion;
                onData(completion);
              } else if (matched.length > 1) {
                onData(`\r\n${matched.join('  ')}\r\n${getPrompt()}${lineBuffer}`);
              }
            }
          } catch {
            // ignore
          }
          return;
        }

        // Process individual characters
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          const code = char.charCodeAt(0);

          if (char === '\r' || char === '\n') {
            onData('\r\n');
            const cmd = lineBuffer;
            lineBuffer = '';
            if (cmd.trim()) {
              if (history[history.length - 1] !== cmd.trim()) {
                history.push(cmd.trim());
              }
              historyIndex = history.length;
            }
            if (char === '\r' && i + 1 < data.length && data[i + 1] === '\n') {
              i++;
            }
            executeCommand(cmd);
            break;
          } else if (code === 127 || code === 8) {
            // Backspace
            if (lineBuffer.length > 0) {
              lineBuffer = lineBuffer.slice(0, -1);
              onData('\b \b');
            }
          } else if (code >= 32) {
            lineBuffer += char;
            onData(char);
          }
        }
      },
      resize: (newCols: number, newRows: number) => {
        cols = newCols || 80;
        rows = newRows || 24;
      },
      restart: () => {
        killActiveProcess();
        lineBuffer = '';
        currentCwd = projectDir;
        onData('\x1b[2J\x1b[H');
        sendBanner();
      },
      kill: () => {
        isTerminated = true;
        killActiveProcess();
        ExecutionService.activeProcesses.delete(sessionId);
      },
    };
  }

  static killAllForProject(projectId: string): void {
    for (const [key, proc] of this.activeProcesses.entries()) {
      if (key.startsWith(projectId)) {
        try {
          proc.kill();
        } catch {
          // ignore
        }
        this.activeProcesses.delete(key);
      }
    }
  }
}
