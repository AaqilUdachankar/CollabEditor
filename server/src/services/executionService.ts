import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ProjectService } from './projectService.js';
import { FileNodeRepository } from '../models/FileNode.js';
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

  static getSafeEnv(): NodeJS.ProcessEnv {
    // Copy all system environment variables, omitting sensitive secrets
    const safeEnv = { ...process.env };
    delete safeEnv.JWT_SECRET;
    delete safeEnv.MONGODB_URI;
    return safeEnv;
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

    let cmd = '';
    let args: string[] = [];

    switch (ext) {
      case '.js':
      case '.mjs':
        cmd = process.execPath;
        args = [fullFilePath];
        break;
      case '.py':
        cmd = 'python';
        args = ['-u', fullFilePath];
        break;
      case '.cpp':
      case '.c': {
        const outName = path.join(projectDir, process.platform === 'win32' ? 'runner.exe' : 'runner');
        const compiler = ext === '.cpp' ? 'g++' : 'gcc';
        cmd = process.platform === 'win32' ? 'cmd.exe' : 'sh';
        const buildAndRun = `"${compiler}" "${fullFilePath}" -o "${outName}" && "${outName}"`;
        args = process.platform === 'win32' ? ['/c', buildAndRun] : ['-c', buildAndRun];
        break;
      }
      case '.html':
        return {
          stdout: `Web preview ready. Open browser preview at project root: ${file.path}\n`,
          stderr: '',
          exitCode: 0,
          durationMs: 1,
          command: `view ${file.path}`,
          timedOut: false,
        };
      default:
        throw new Error(`Execution not supported for file type "${ext}". Run files via the integrated terminal.`);
    }

    const startTime = Date.now();
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let timedOut = false;

    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: projectDir,
        env: this.getSafeEnv(),
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

      child.on('error', (err) => {
        clearTimeout(timer);
        this.activeProcesses.delete(procId);
        resolve({
          stdout: stdoutBuffer,
          stderr: stderrBuffer + `\nProcess error: ${err.message}`,
          exitCode: 1,
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

  static spawnTerminal(
    sessionId: string,
    projectId: string,
    onData: (chunk: string) => void,
    onExit: (code: number) => void
  ): {
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
  } {
    const projectDir = ProjectService.getProjectPath(projectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : (process.env.SHELL || 'bash');
    const shellArgs = isWin ? ['/q', '/k'] : [];

    const proc = spawn(shell, shellArgs, {
      cwd: projectDir,
      env: {
        ...this.getSafeEnv(),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    this.activeProcesses.set(sessionId, proc);

    let lineBuffer = '';

    proc.stdout?.on('data', (buf) => onData(buf.toString()));
    proc.stderr?.on('data', (buf) => onData(buf.toString()));

    // Show initial shell prompt
    setTimeout(() => {
      if (!proc.killed) {
        onData(`\r\n${projectDir}> `);
      }
    }, 150);

    proc.on('close', (code) => {
      this.activeProcesses.delete(sessionId);
      onExit(code ?? 0);
    });

    proc.on('error', (err) => {
      onData(`\r\n\x1b[31mTerminal session error: ${err.message}\x1b[0m\r\n`);
    });

    return {
      write: (data: string) => {
        if (proc.killed || !proc.stdin?.writable) return;

        if (isWin) {
          for (let i = 0; i < data.length; i++) {
            const char = data[i];
            const code = char.charCodeAt(0);

            if (char === '\r') {
              onData('\r\n');
              const toSend = lineBuffer + '\r\n';
              lineBuffer = '';
              proc.stdin.write(toSend);
              if (i + 1 < data.length && data[i + 1] === '\n') {
                i++;
              }
            } else if (char === '\n') {
              onData('\r\n');
              const toSend = lineBuffer + '\r\n';
              lineBuffer = '';
              proc.stdin.write(toSend);
            } else if (code === 127 || code === 8) {
              if (lineBuffer.length > 0) {
                lineBuffer = lineBuffer.slice(0, -1);
                onData('\b \b');
              }
            } else if (code === 3) {
              // Ctrl+C
              onData('^C\r\n');
              lineBuffer = '';
              proc.stdin.write('\x03');
            } else if (code === 9) {
              // Tab
              lineBuffer += '  ';
              onData('  ');
            } else if (code >= 32) {
              lineBuffer += char;
              onData(char);
            }
          }
        } else {
          proc.stdin.write(data);
        }
      },
      resize: (_cols: number, _rows: number) => {
        // Child_process standard spawn does not resize winpty columns directly,
        // but preserves valid line buffers
      },
      kill: () => {
        if (!proc.killed) {
          try {
            proc.kill();
          } catch {
            // Process cleanup
          }
          this.activeProcesses.delete(sessionId);
        }
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
