import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

export interface TerminalInstance {
  term: Terminal;
  fitAddon: FitAddon;
  destroy: () => void;
  sendInput: (data: string) => void;
  clear: () => void;
  restart: () => void;
}

export function createTerminalSession(
  container: HTMLElement,
  projectId: string,
  onExit?: (code: number) => void,
  onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void
): TerminalInstance {
  let isDestroyed = false;

  const term = new Terminal({
    cursorBlink: true,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.2,
    theme: {
      background: '#181818',
      foreground: '#cccccc',
      cursor: '#ffffff',
      selectionBackground: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff',
    },
  });

  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();

  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);

  term.open(container);

  const safeFit = () => {
    if (isDestroyed) return;
    try {
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        fitAddon.fit();
      }
    } catch {
      // Dimensions not ready yet
    }
  };

  requestAnimationFrame(() => {
    safeFit();
  });

  const token = localStorage.getItem('collabide_token') || localStorage.getItem('nexus_token') || '';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/term?projectId=${projectId}&token=${token}`;

  let ws: WebSocket | null = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (isDestroyed) {
      try { ws?.close(); } catch {}
      return;
    }
    safeFit();
    onStatusChange?.('connected');
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols || 80, rows: term.rows || 24 }));
    }
  };

  ws.onmessage = (event) => {
    if (isDestroyed) return;
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output') {
        term.write(msg.data);
      } else if (msg.type === 'error') {
        term.writeln(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
      } else if (msg.type === 'exit') {
        onExit?.(msg.code);
        term.writeln(`\r\n\x1b[90m[Process exited with code ${msg.code}]\x1b[0m\r\n`);
      }
    } catch {
      term.write(event.data);
    }
  };

  ws.onerror = () => {
    if (!isDestroyed) {
      onStatusChange?.('disconnected');
      term.writeln('\r\n\x1b[31mFailed to connect to terminal session\x1b[0m\r\n');
    }
  };

  ws.onclose = () => {
    if (!isDestroyed) {
      onStatusChange?.('disconnected');
      term.writeln('\r\n\x1b[90mTerminal session disconnected\x1b[0m\r\n');
    }
  };

  term.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    if (isDestroyed) return;
    safeFit();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  });

  resizeObserver.observe(container);

  return {
    term,
    fitAddon,
    destroy: () => {
      isDestroyed = true;
      try {
        resizeObserver.disconnect();
      } catch {}

      if (ws) {
        try {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.onopen = () => {
              try { ws?.close(); } catch {}
            };
          } else if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        } catch {}
        ws = null;
      }

      setTimeout(() => {
        try {
          term.dispose();
        } catch {}
      }, 0);
    },
    sendInput: (data: string) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    },
    clear: () => {
      term.clear();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: '\x0c' }));
      }
    },
    restart: () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'restart' }));
      }
    },
  };
}
