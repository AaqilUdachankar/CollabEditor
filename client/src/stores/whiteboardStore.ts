import { create } from 'zustand';
import {
  WhiteboardTool,
  StickyColor,
  IWhiteboardElement,
  IWhiteboardCursor,
  IWhiteboardViewport,
  IPrivateBoardSummary,
} from '../types/whiteboard.js';
import { api } from '../services/api.js';
import { getSocket } from '../services/socket.js';

interface IncomingBoardInvite {
  boardId: string;
  callerId: string;
  callerName: string;
  avatarColor?: string;
  title: string;
  projectId: string;
}

interface WhiteboardStoreState {
  isOpen: boolean;
  isLoading: boolean;
  activeBoard: IPrivateBoardSummary | null;
  elements: IWhiteboardElement[];
  undoStack: IWhiteboardElement[][];
  redoStack: IWhiteboardElement[][];
  viewport: IWhiteboardViewport;
  activeTool: WhiteboardTool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  stickyColor: StickyColor;
  fontSize: number;
  selectedElementId: string | null;
  peerCursors: Record<string, IWhiteboardCursor>;
  workspaceBoards: IPrivateBoardSummary[];
  incomingInvite: IncomingBoardInvite | null;
  saveStatus: 'saved' | 'saving' | 'error';

  // Actions
  setIsOpen: (isOpen: boolean) => void;
  setActiveTool: (tool: WhiteboardTool) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setStickyColor: (color: StickyColor) => void;
  setFontSize: (fontSize: number) => void;
  setSelectedElementId: (id: string | null) => void;
  setViewport: (viewport: Partial<IWhiteboardViewport>) => void;

  loadProjectBoards: (projectId: string) => Promise<void>;
  createAndOpenPrivateBoard: (
    targetUser: { id: string; username: string; avatarColor?: string },
    projectId: string,
    title?: string
  ) => Promise<string | null>;
  openBoard: (boardId: string, projectId: string) => Promise<void>;
  deleteBoard: (boardId: string, projectId: string) => Promise<boolean>;
  inviteFriendToBoard: (targetUserId: string, projectId: string) => Promise<boolean>;
  closeBoard: () => void;
  handleIncomingInvite: (invite: IncomingBoardInvite) => void;
  acceptInvite: () => Promise<void>;
  rejectInvite: () => void;

  addElement: (element: IWhiteboardElement, emit?: boolean) => void;
  updateElement: (element: IWhiteboardElement, emit?: boolean) => void;
  deleteElement: (id: string, emit?: boolean) => void;
  clearCanvas: (emit?: boolean) => void;
  undo: () => void;
  redo: () => void;
  applyRemoteOperation: (operation: any) => void;
  syncRemoteCanvas: (elements: IWhiteboardElement[]) => void;
  updatePeerCursor: (cursor: IWhiteboardCursor) => void;
  sendCursor: (x: number, y: number, avatarColor?: string) => void;
}

let saveDebounceTimer: any = null;

export const useWhiteboardStore = create<WhiteboardStoreState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  activeBoard: null,
  elements: [],
  undoStack: [],
  redoStack: [],
  viewport: { zoom: 1, panX: 0, panY: 0 },
  activeTool: 'pen',
  strokeColor: '#38bdf8',
  fillColor: 'transparent',
  strokeWidth: 3,
  stickyColor: 'yellow',
  fontSize: 16,
  selectedElementId: null,
  peerCursors: {},
  workspaceBoards: [],
  incomingInvite: null,
  saveStatus: 'saved',

  setIsOpen: (isOpen) => set({ isOpen }),
  setActiveTool: (activeTool) => set({ activeTool, selectedElementId: null }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setStickyColor: (stickyColor) => set({ stickyColor }),
  setFontSize: (fontSize) => set({ fontSize }),
  setSelectedElementId: (selectedElementId) => set({ selectedElementId }),
  setViewport: (viewportUpdate) =>
    set((state) => ({ viewport: { ...state.viewport, ...viewportUpdate } })),

  loadProjectBoards: async (projectId) => {
    try {
      const res = await api.whiteboard.list(projectId);
      set({ workspaceBoards: res.whiteboards || [] });
    } catch (err) {
      console.error('[Load Project Boards Error]', err);
    }
  },

  createAndOpenPrivateBoard: async (targetUser, projectId, title) => {
    set({ isLoading: true });
    try {
      const socket = getSocket();
      const boardTitle = title || `Whiteboard with ${targetUser.username}`;

      // 1. Create board via API or socket
      const res = await api.whiteboard.create(projectId, {
        targetUserId: targetUser.id,
        title: boardTitle,
        initialCanvasData: {
          elements: [],
          viewport: { zoom: 1, panX: 0, panY: 0 },
          version: 1,
        },
      });

      const newBoard = res.whiteboard;

      // 2. Deliver real-time invite event to target user
      socket?.emit('board:invite', {
        targetUserId: targetUser.id,
        projectId,
        title: boardTitle,
      });

      // 3. Join socket board room
      socket?.emit('board:join', { boardId: newBoard.boardId });

      set({
        isOpen: true,
        isLoading: false,
        activeBoard: newBoard,
        elements: [],
        undoStack: [],
        redoStack: [],
        viewport: { zoom: 1, panX: 0, panY: 0 },
        peerCursors: {},
      });

      get().loadProjectBoards(projectId);
      return newBoard.boardId;
    } catch (err: any) {
      set({ isLoading: false });
      alert(`Could not create private whiteboard: ${err.message}`);
      return null;
    }
  },

  openBoard: async (boardId, projectId) => {
    set({ isLoading: true, isOpen: true });
    try {
      const res = await api.whiteboard.get(projectId, boardId);
      const board = res.whiteboard;
      const initialElements = board.canvasData?.elements || [];
      const initialViewport = board.canvasData?.viewport || { zoom: 1, panX: 0, panY: 0 };

      const socket = getSocket();
      socket?.emit('board:join', { boardId });

      set({
        isLoading: false,
        activeBoard: board,
        elements: initialElements,
        viewport: initialViewport,
        undoStack: [],
        redoStack: [],
        peerCursors: {},
      });
    } catch (err: any) {
      set({ isLoading: false, isOpen: false });
      alert(`Failed to open whiteboard: ${err.message}`);
    }
  },

  deleteBoard: async (boardId, projectId) => {
    // Optimistic removal from list
    const prev = get().workspaceBoards;
    set({ workspaceBoards: prev.filter((b) => b.boardId !== boardId) });

    try {
      await api.whiteboard.delete(projectId, boardId);
      if (get().activeBoard?.boardId === boardId) {
        get().closeBoard();
      }
      return true;
    } catch (err: any) {
      // Revert if failed
      set({ workspaceBoards: prev });
      alert(`Failed to delete whiteboard: ${err.message}`);
      return false;
    }
  },

  inviteFriendToBoard: async (targetUserId, projectId) => {
    const { activeBoard } = get();
    if (!activeBoard) return false;

    try {
      await api.whiteboard.invite(projectId, activeBoard.boardId, targetUserId);
      const socket = getSocket();
      socket?.emit('board:invite', {
        targetUserId,
        projectId,
        title: activeBoard.title,
      });

      // Update active board participant list
      const res = await api.whiteboard.get(projectId, activeBoard.boardId);
      if (res?.whiteboard) {
        set({ activeBoard: res.whiteboard });
      }
      return true;
    } catch (err: any) {
      alert(`Failed to invite teammate: ${err.message}`);
      return false;
    }
  },

  closeBoard: () => {
    const { activeBoard } = get();
    if (activeBoard) {
      const socket = getSocket();
      socket?.emit('board:leave', { boardId: activeBoard.boardId });
    }
    set({
      isOpen: false,
      activeBoard: null,
      elements: [],
      peerCursors: {},
      undoStack: [],
      redoStack: [],
    });
  },

  handleIncomingInvite: (invite) => {
    set({ incomingInvite: invite });
  },

  acceptInvite: async () => {
    const { incomingInvite } = get();
    if (!incomingInvite) return;

    const socket = getSocket();
    socket?.emit('board:accept', {
      boardId: incomingInvite.boardId,
      targetUserId: incomingInvite.callerId,
    });

    const projectId = incomingInvite.projectId;
    const boardId = incomingInvite.boardId;
    set({ incomingInvite: null });

    await get().openBoard(boardId, projectId);
  },

  rejectInvite: () => {
    const { incomingInvite } = get();
    if (incomingInvite) {
      const socket = getSocket();
      socket?.emit('board:reject', {
        boardId: incomingInvite.boardId,
        targetUserId: incomingInvite.callerId,
        reason: 'Invitation declined',
      });
    }
    set({ incomingInvite: null });
  },

  addElement: (element, emit = true) => {
    const prev = get().elements;
    set((state) => ({
      elements: [...state.elements, element],
      undoStack: [...state.undoStack, prev],
      redoStack: [],
    }));

    if (emit) {
      const { activeBoard, elements, viewport } = get();
      if (activeBoard) {
        const socket = getSocket();
        socket?.emit('board:operation', {
          boardId: activeBoard.boardId,
          operation: { type: 'element:add', element },
          canvasSnapshot: { elements, viewport },
        });

        // Debounced persistent update to database
        clearTimeout(saveDebounceTimer);
        set({ saveStatus: 'saving' });
        saveDebounceTimer = setTimeout(async () => {
          try {
            await api.whiteboard.update(activeBoard.workspaceId || '', activeBoard.boardId, {
              elements: get().elements,
              viewport: get().viewport,
            });
            set({ saveStatus: 'saved' });
          } catch {
            set({ saveStatus: 'error' });
          }
        }, 800);
      }
    }
  },

  updateElement: (updated, emit = true) => {
    const prev = get().elements;
    set((state) => ({
      elements: state.elements.map((el) => (el.id === updated.id ? updated : el)),
      undoStack: [...state.undoStack, prev],
      redoStack: [],
    }));

    if (emit) {
      const { activeBoard, elements, viewport } = get();
      if (activeBoard) {
        const socket = getSocket();
        socket?.emit('board:operation', {
          boardId: activeBoard.boardId,
          operation: { type: 'element:update', element: updated },
          canvasSnapshot: { elements, viewport },
        });

        clearTimeout(saveDebounceTimer);
        set({ saveStatus: 'saving' });
        saveDebounceTimer = setTimeout(async () => {
          try {
            await api.whiteboard.update(activeBoard.workspaceId || '', activeBoard.boardId, {
              elements: get().elements,
              viewport: get().viewport,
            });
            set({ saveStatus: 'saved' });
          } catch {
            set({ saveStatus: 'error' });
          }
        }, 800);
      }
    }
  },

  deleteElement: (id, emit = true) => {
    const prev = get().elements;
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      undoStack: [...state.undoStack, prev],
      redoStack: [],
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    }));

    if (emit) {
      const { activeBoard, elements, viewport } = get();
      if (activeBoard) {
        const socket = getSocket();
        socket?.emit('board:operation', {
          boardId: activeBoard.boardId,
          operation: { type: 'element:delete', elementId: id },
          canvasSnapshot: { elements, viewport },
        });

        clearTimeout(saveDebounceTimer);
        set({ saveStatus: 'saving' });
        saveDebounceTimer = setTimeout(async () => {
          try {
            await api.whiteboard.update(activeBoard.workspaceId || '', activeBoard.boardId, {
              elements: get().elements,
              viewport: get().viewport,
            });
            set({ saveStatus: 'saved' });
          } catch {
            set({ saveStatus: 'error' });
          }
        }, 800);
      }
    }
  },

  clearCanvas: (emit = true) => {
    const prev = get().elements;
    set((state) => ({
      elements: [],
      undoStack: [...state.undoStack, prev],
      redoStack: [],
      selectedElementId: null,
    }));

    if (emit) {
      const { activeBoard, viewport } = get();
      if (activeBoard) {
        const socket = getSocket();
        socket?.emit('board:operation', {
          boardId: activeBoard.boardId,
          operation: { type: 'canvas:clear' },
          canvasSnapshot: { elements: [], viewport },
        });

        api.whiteboard
          .update(activeBoard.workspaceId || '', activeBoard.boardId, {
            elements: [],
            viewport,
          })
          .catch(console.error);
      }
    }
  },

  undo: () => {
    const { undoStack, elements, redoStack, activeBoard, viewport } = get();
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    set({
      elements: previousState,
      undoStack: newUndoStack,
      redoStack: [...redoStack, elements],
    });

    if (activeBoard) {
      const socket = getSocket();
      socket?.emit('board:sync', {
        boardId: activeBoard.boardId,
        canvasData: { elements: previousState, viewport },
      });
    }
  },

  redo: () => {
    const { redoStack, elements, undoStack, activeBoard, viewport } = get();
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    set({
      elements: nextState,
      redoStack: newRedoStack,
      undoStack: [...undoStack, elements],
    });

    if (activeBoard) {
      const socket = getSocket();
      socket?.emit('board:sync', {
        boardId: activeBoard.boardId,
        canvasData: { elements: nextState, viewport },
      });
    }
  },

  applyRemoteOperation: (op) => {
    if (!op) return;
    if (op.type === 'element:add' && op.element) {
      set((s) => ({
        elements: [...s.elements.filter((e) => e.id !== op.element.id), op.element],
      }));
    } else if (op.type === 'element:update' && op.element) {
      set((s) => ({
        elements: s.elements.map((e) => (e.id === op.element.id ? op.element : e)),
      }));
    } else if (op.type === 'element:delete' && op.elementId) {
      set((s) => ({
        elements: s.elements.filter((e) => e.id !== op.elementId),
        selectedElementId: s.selectedElementId === op.elementId ? null : s.selectedElementId,
      }));
    } else if (op.type === 'canvas:clear') {
      set({ elements: [], selectedElementId: null });
    }
  },

  syncRemoteCanvas: (elements) => {
    set({ elements: elements || [] });
  },

  updatePeerCursor: (cursor) => {
    set((s) => ({
      peerCursors: {
        ...s.peerCursors,
        [cursor.userId]: { ...cursor, lastActive: Date.now() },
      },
    }));
  },

  sendCursor: (x, y, avatarColor) => {
    const { activeBoard } = get();
    if (activeBoard) {
      const socket = getSocket();
      socket?.emit('board:cursor', {
        boardId: activeBoard.boardId,
        x,
        y,
        avatarColor,
      });
    }
  },
}));
