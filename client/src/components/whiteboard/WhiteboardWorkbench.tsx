import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  MousePointer,
  Hand,
  Pen,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Type,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  X,
  FileDown,
  Video,
  Sparkles,
  Palette,
  Check,
  UserPlus,
  Users,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  WhiteboardTool,
  StickyColor,
  IWhiteboardElement,
  IPoint,
} from '../../types/whiteboard.js';
import { useWhiteboardStore } from '../../stores/whiteboardStore.js';
import { useVideoCallStore } from '../../stores/videoCallStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { api } from '../../services/api.js';

const STICKY_COLORS: Record<StickyColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: '#fef08a', border: '#eab308', text: '#713f12' },
  pink: { bg: '#fbcfe8', border: '#ec4899', text: '#831843' },
  blue: { bg: '#bae6fd', border: '#0284c7', text: '#0c4a6e' },
  green: { bg: '#bbf7d0', border: '#22c55e', text: '#14532d' },
  orange: { bg: '#fed7aa', border: '#f97316', text: '#7c2d12' },
};

const PALETTE = [
  '#ffffff',
  '#94a3b8',
  '#38bdf8',
  '#818cf8',
  '#c084fc',
  '#f472b6',
  '#4ade80',
  '#facc15',
  '#fb923c',
  '#f87171',
];

export const WhiteboardWorkbench: React.FC = () => {
  const {
    isOpen,
    activeBoard,
    elements,
    viewport,
    activeTool,
    strokeColor,
    fillColor,
    strokeWidth,
    stickyColor,
    selectedElementId,
    peerCursors,
    saveStatus,
    undoStack,
    redoStack,
    setIsOpen,
    setActiveTool,
    setStrokeColor,
    setFillColor,
    setStrokeWidth,
    setStickyColor,
    setSelectedElementId,
    setViewport,
    addElement,
    updateElement,
    deleteElement,
    clearCanvas,
    undo,
    redo,
    sendCursor,
    inviteFriendToBoard,
    closeBoard,
  } = useWhiteboardStore();

  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { status: callStatus, peer: callPeer, initiateCall } = useVideoCallStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<IPoint>({ x: 0, y: 0 });
  const [currentStroke, setCurrentStroke] = useState<IPoint[]>([]);
  const [shapeStart, setShapeStart] = useState<IPoint | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [invitedTeammateIds, setInvitedTeammateIds] = useState<Set<string>>(new Set());
  const [editingTextElement, setEditingTextElement] = useState<IWhiteboardElement | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  // Load project members when invite popover opens
  useEffect(() => {
    if (showInviteFriends && currentProject) {
      api.collaboration
        .getMembers(currentProject.id)
        .then((res) => {
          const list = (res.members || []).filter((m: any) => (m.userId || m.id) !== user?.id);
          setProjectMembers(list);
        })
        .catch(() => setProjectMembers([]));
    }
  }, [showInviteFriends, currentProject?.id, user?.id]);

  // Convert screen coordinates to world coordinates
  const toWorld = useCallback(
    (screenX: number, screenY: number): IPoint => {
      return {
        x: (screenX - viewport.panX) / viewport.zoom,
        y: (screenY - viewport.panY) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Resize canvas to fill container
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear Screen
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Dot Grid Background
    ctx.save();
    ctx.fillStyle = '#121215';
    ctx.fillRect(0, 0, width, height);

    const gridSize = 24 * viewport.zoom;
    const offsetX = viewport.panX % gridSize;
    const offsetY = viewport.panY % gridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = offsetX; x < width; x += gridSize) {
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 2. Set World Coordinate Transform
    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // 3. Render all Whiteboard Elements
    for (const el of elements) {
      ctx.save();

      // Highlight selected element
      if (el.id === selectedElementId) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
        ctx.strokeRect(el.x - 4, el.y - 4, el.width + 8, el.height + 8);
        ctx.setLineDash([]);
      }

      if (el.type === 'stroke' && el.points && el.points.length > 0) {
        ctx.beginPath();
        if (el.isHighlighter) {
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = (el.strokeWidth || 8) * 2;
          ctx.strokeStyle = el.strokeColor || '#facc15';
          ctx.lineCap = 'square';
          ctx.lineJoin = 'bevel';
        } else {
          ctx.globalAlpha = 1.0;
          ctx.lineWidth = el.strokeWidth || 3;
          ctx.strokeStyle = el.strokeColor || '#ffffff';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }

        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'shape') {
        ctx.lineWidth = el.strokeWidth || 2;
        ctx.strokeStyle = el.strokeColor || '#ffffff';
        if (el.fillColor && el.fillColor !== 'transparent') {
          ctx.fillStyle = el.fillColor;
        }

        if (el.shapeType === 'rectangle') {
          if (el.fillColor && el.fillColor !== 'transparent') {
            ctx.fillRect(el.x, el.y, el.width, el.height);
          }
          ctx.strokeRect(el.x, el.y, el.width, el.height);
        } else if (el.shapeType === 'circle') {
          ctx.beginPath();
          const radiusX = Math.abs(el.width) / 2;
          const radiusY = Math.abs(el.height) / 2;
          ctx.ellipse(el.x + radiusX, el.y + radiusY, radiusX, radiusY, 0, 0, Math.PI * 2);
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
        } else if (el.shapeType === 'line') {
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x + el.width, el.y + el.height);
          ctx.stroke();
        } else if (el.shapeType === 'arrow') {
          const fromX = el.x;
          const fromY = el.y;
          const toX = el.x + el.width;
          const toY = el.y + el.height;
          const headLength = 16;
          const angle = Math.atan2(toY - fromY, toX - fromX);

          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          // Arrow wings
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(
            toX - headLength * Math.cos(angle - Math.PI / 6),
            toY - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(toX, toY);
          ctx.lineTo(
            toX - headLength * Math.cos(angle + Math.PI / 6),
            toY - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
      } else if (el.type === 'sticky') {
        const theme = STICKY_COLORS[el.stickyColor || 'yellow'];

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(el.x + 3, el.y + 3, el.width, el.height);

        // Body
        ctx.fillStyle = theme.bg;
        ctx.fillRect(el.x, el.y, el.width, el.height);

        // Border
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(el.x, el.y, el.width, el.height);

        // Text Content
        ctx.fillStyle = theme.text;
        ctx.font = '500 13px Inter, sans-serif';
        const lines = (el.text || 'Sticky Note').split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, el.x + 10, el.y + 24 + idx * 18, el.width - 20);
        });

        // Author pill
        if (el.authorName) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText(el.authorName, el.x + 8, el.y + el.height - 8);
        }
      } else if (el.type === 'text') {
        ctx.fillStyle = el.fontColor || '#ffffff';
        ctx.font = `500 ${el.fontSize || 16}px Inter, sans-serif`;
        const lines = (el.text || '').split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, el.x, el.y + (el.fontSize || 16) + idx * ((el.fontSize || 16) + 4));
        });
      }

      ctx.restore();
    }

    // 4. Render Active In-Progress Freehand Stroke
    if (isDrawing && currentStroke.length > 1) {
      ctx.save();
      ctx.beginPath();
      if (activeTool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = strokeWidth * 2;
        ctx.strokeStyle = strokeColor;
      } else {
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Render Active In-Progress Shape Preview
    if (isDrawing && shapeStart && (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'line' || activeTool === 'arrow')) {
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
      const currentPt = currentStroke[currentStroke.length - 1] || shapeStart;
      const w = currentPt.x - shapeStart.x;
      const h = currentPt.y - shapeStart.y;

      if (activeTool === 'rectangle') {
        ctx.strokeRect(shapeStart.x, shapeStart.y, w, h);
      } else if (activeTool === 'circle') {
        ctx.beginPath();
        const rx = Math.abs(w) / 2;
        const ry = Math.abs(h) / 2;
        ctx.ellipse(shapeStart.x + rx, shapeStart.y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === 'line' || activeTool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(shapeStart.x, shapeStart.y);
        ctx.lineTo(currentPt.x, currentPt.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Render Remote Live Peer Cursors
    for (const peerId of Object.keys(peerCursors)) {
      const cursor = peerCursors[peerId];
      if (Date.now() - cursor.lastActive > 15000) continue; // Skip inactive cursors

      ctx.save();
      ctx.translate(cursor.x, cursor.y);

      // Pointer Arrow
      ctx.fillStyle = cursor.avatarColor || '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(4, 11);
      ctx.lineTo(9, 18);
      ctx.lineTo(12, 16);
      ctx.lineTo(7, 9);
      ctx.lineTo(14, 9);
      ctx.closePath();
      ctx.fill();

      // Username tag pill
      ctx.fillStyle = cursor.avatarColor || '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(14, 10, cursor.username.length * 8 + 12, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(cursor.username, 20, 24);

      ctx.restore();
    }

    ctx.restore();
  }, [
    elements,
    viewport,
    isDrawing,
    currentStroke,
    shapeStart,
    selectedElementId,
    peerCursors,
    strokeColor,
    strokeWidth,
    activeTool,
  ]);

  // Mouse Down Event Handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wPt = toWorld(sx, sy);

    // Pan Tool or Spacebar/Middle click drag
    if (activeTool === 'pan' || e.button === 1 || (e as any).spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
      return;
    }

    // Select Tool: hit-testing
    if (activeTool === 'select') {
      const hit = [...elements].reverse().find((el) => {
        return (
          wPt.x >= el.x &&
          wPt.x <= el.x + el.width &&
          wPt.y >= el.y &&
          wPt.y <= el.y + el.height
        );
      });
      setSelectedElementId(hit ? hit.id : null);
      if (hit) {
        setIsDrawing(true);
        setShapeStart(wPt);
      }
      return;
    }

    // Eraser Tool
    if (activeTool === 'eraser') {
      const hit = [...elements].reverse().find((el) => {
        return (
          wPt.x >= el.x - 8 &&
          wPt.x <= el.x + el.width + 8 &&
          wPt.y >= el.y - 8 &&
          wPt.y <= el.y + el.height + 8
        );
      });
      if (hit) {
        deleteElement(hit.id);
      }
      return;
    }

    // Sticky Note Creation
    if (activeTool === 'sticky') {
      const newSticky: IWhiteboardElement = {
        id: `sticky_${Date.now()}`,
        type: 'sticky',
        x: wPt.x,
        y: wPt.y,
        width: 160,
        height: 140,
        stickyColor,
        text: 'New Note\nDouble click to edit',
        authorName: user?.username || 'You',
        createdBy: user?.id || 'anon',
        updatedAt: Date.now(),
      };
      addElement(newSticky);
      setActiveTool('select');
      setSelectedElementId(newSticky.id);
      return;
    }

    // Text Tool Creation
    if (activeTool === 'text') {
      const newText: IWhiteboardElement = {
        id: `text_${Date.now()}`,
        type: 'text',
        x: wPt.x,
        y: wPt.y,
        width: 180,
        height: 40,
        fontSize: 16,
        fontColor: strokeColor,
        text: 'Type text here...',
        createdBy: user?.id || 'anon',
        updatedAt: Date.now(),
      };
      addElement(newText);
      setActiveTool('select');
      setSelectedElementId(newText.id);
      setEditingTextElement(newText);
      setTextInputValue('Type text here...');
      return;
    }

    // Freehand Drawing / Highlighter
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setIsDrawing(true);
      setCurrentStroke([wPt]);
      return;
    }

    // Shape Creation Start
    if (
      activeTool === 'rectangle' ||
      activeTool === 'circle' ||
      activeTool === 'line' ||
      activeTool === 'arrow'
    ) {
      setIsDrawing(true);
      setShapeStart(wPt);
      setCurrentStroke([wPt]);
      return;
    }
  };

  // Mouse Move Event Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wPt = toWorld(sx, sy);

    // Broadcast live cursor to collaborator
    sendCursor(wPt.x, wPt.y, user?.avatarColor || '#38bdf8');

    // Pan Dragging
    if (isPanning) {
      setViewport({
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y,
      });
      return;
    }

    // Freehand Draw
    if (isDrawing && (activeTool === 'pen' || activeTool === 'highlighter')) {
      setCurrentStroke((prev) => [...prev, wPt]);
      return;
    }

    // In-Progress Shape Drag
    if (isDrawing && shapeStart) {
      setCurrentStroke((prev) => [...prev.slice(0, 1), wPt]);
      return;
    }
  };

  // Mouse Up Event Handler
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing) {
      setIsDrawing(false);

      // Finish Freehand Stroke
      if ((activeTool === 'pen' || activeTool === 'highlighter') && currentStroke.length > 1) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        currentStroke.forEach((pt) => {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        });

        const newStrokeEl: IWhiteboardElement = {
          id: `stroke_${Date.now()}`,
          type: 'stroke',
          x: minX,
          y: minY,
          width: Math.max(10, maxX - minX),
          height: Math.max(10, maxY - minY),
          points: currentStroke,
          strokeColor,
          strokeWidth,
          isHighlighter: activeTool === 'highlighter',
          createdBy: user?.id || 'anon',
          updatedAt: Date.now(),
        };

        addElement(newStrokeEl);
        setCurrentStroke([]);
        return;
      }

      // Finish Shape
      if (shapeStart && currentStroke.length > 0) {
        const lastPt = currentStroke[currentStroke.length - 1];
        const w = lastPt.x - shapeStart.x;
        const h = lastPt.y - shapeStart.y;

        if (Math.abs(w) > 4 || Math.abs(h) > 4) {
          const newShapeEl: IWhiteboardElement = {
            id: `shape_${Date.now()}`,
            type: 'shape',
            shapeType: activeTool as any,
            x: Math.min(shapeStart.x, lastPt.x),
            y: Math.min(shapeStart.y, lastPt.y),
            width: Math.abs(w),
            height: Math.abs(h),
            strokeColor,
            fillColor,
            strokeWidth,
            createdBy: user?.id || 'anon',
            updatedAt: Date.now(),
          };

          addElement(newShapeEl);
          setActiveTool('select');
          setSelectedElementId(newShapeEl.id);
        }

        setShapeStart(null);
        setCurrentStroke([]);
      }
    }
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const direction = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.min(3.5, Math.max(0.2, viewport.zoom * (direction > 0 ? zoomFactor : 1 / zoomFactor)));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - viewport.panX) * (newZoom / viewport.zoom);
    const newPanY = mouseY - (mouseY - viewport.panY) * (newZoom / viewport.zoom);

    setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
  };

  // Double Click Element (Edit Text / Sticky)
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wPt = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    const hit = [...elements].reverse().find((el) => {
      return (
        wPt.x >= el.x &&
        wPt.x <= el.x + el.width &&
        wPt.y >= el.y &&
        wPt.y <= el.y + el.height &&
        (el.type === 'sticky' || el.type === 'text')
      );
    });

    if (hit) {
      setEditingTextElement(hit);
      setTextInputValue(hit.text || '');
    }
  };

  // Export to PNG
  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${activeBoard?.title || 'whiteboard'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Export to PDF using jsPDF
  const exportPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${activeBoard?.title || 'whiteboard'}.pdf`);
  };

  // Save Text / Sticky Edit
  const saveTextEdit = () => {
    if (editingTextElement) {
      updateElement({
        ...editingTextElement,
        text: textInputValue,
        updatedAt: Date.now(),
      });
      setEditingTextElement(null);
    }
  };

  if (!isOpen || !activeBoard) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#121215',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          height: 48,
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              padding: '4px 8px',
              backgroundColor: '#a855f7',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              letterSpacing: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Sparkles size={13} />
            MIRO BOARD
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f4f4f5' }}>
            {activeBoard.title}
          </span>
          <span
            style={{
              fontSize: 10,
              color: saveStatus === 'saved' ? '#4ade80' : '#eab308',
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {saveStatus === 'saved' ? '● Synced' : '○ Saving...'}
          </span>
        </div>

        {/* Center: Undo/Redo & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            style={{
              background: '#27272a',
              border: 'none',
              color: undoStack.length > 0 ? '#e4e4e7' : '#52525b',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: undoStack.length > 0 ? 'pointer' : 'default',
            }}
            title="Undo"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            style={{
              background: '#27272a',
              border: 'none',
              color: redoStack.length > 0 ? '#e4e4e7' : '#52525b',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: redoStack.length > 0 ? 'pointer' : 'default',
            }}
            title="Redo"
          >
            <Redo2 size={15} />
          </button>

          <div style={{ width: 1, height: 20, backgroundColor: '#3f3f46', margin: '0 4px' }} />

          <button
            onClick={() => setViewport({ zoom: Math.max(0.2, viewport.zoom * 0.85) })}
            style={{
              background: '#27272a',
              border: 'none',
              color: '#e4e4e7',
              padding: '6px 8px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: 12, color: '#a1a1aa', minWidth: 42, textAlign: 'center' }}>
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            onClick={() => setViewport({ zoom: Math.min(3.5, viewport.zoom * 1.15) })}
            style={{
              background: '#27272a',
              border: 'none',
              color: '#e4e4e7',
              padding: '6px 8px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={() => setViewport({ zoom: 1, panX: 0, panY: 0 })}
            style={{
              background: '#27272a',
              border: 'none',
              color: '#e4e4e7',
              padding: '6px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
            }}
            title="Reset Zoom to 100%"
          >
            Reset
          </button>
        </div>

        {/* Right: Invite Friends, Video Call status, Exports, Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          {/* Invite Friends Button */}
          <button
            onClick={() => setShowInviteFriends(!showInviteFriends)}
            id="btn-invite-whiteboard-friends"
            style={{
              background: showInviteFriends
                ? '#9333ea'
                : 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(59, 130, 246, 0.25))',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              color: '#d8b4fe',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(147, 51, 234, 0.2)',
              transition: 'all 0.15s ease',
            }}
            title="Invite Friends / Teammates to this Whiteboard"
          >
            <UserPlus size={14} />
            <span>Invite Friends</span>
          </button>

          {/* Invite Friends Popover Modal */}
          {showInviteFriends && (
            <div
              style={{
                position: 'absolute',
                top: 45,
                right: 0,
                width: 300,
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 10,
                padding: 14,
                zIndex: 100,
                boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                color: '#e4e4e7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={15} color="#c084fc" />
                  <span>Invite Friends to Whiteboard</span>
                </div>
                <button
                  onClick={() => setShowInviteFriends(false)}
                  style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 2 }}
                >
                  <X size={15} />
                </button>
              </div>

              {projectMembers.length === 0 ? (
                <div style={{ color: '#71717a', fontSize: 11, textAlign: 'center', padding: '10px 0' }}>
                  No other workspace members found. You can add demo collaborators in the sidebar!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {projectMembers.map((m) => {
                    const uid = m.userId || m.id;
                    const isAlreadyInBoard = activeBoard?.participantIds?.includes(uid);
                    const isInvited = invitedTeammateIds.has(uid) || isAlreadyInBoard;

                    return (
                      <div
                        key={uid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          backgroundColor: '#27272a',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: m.avatarColor || '#38bdf8',
                              color: 'white',
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {m.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#f4f4f5' }}>{m.username}</div>
                            <div style={{ fontSize: 10, color: '#71717a' }}>
                              {isAlreadyInBoard ? 'In Session' : 'Workspace Member'}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            if (currentProject) {
                              await inviteFriendToBoard(uid, currentProject.id);
                              setInvitedTeammateIds((prev) => new Set([...prev, uid]));
                            }
                          }}
                          disabled={isInvited}
                          style={{
                            backgroundColor: isInvited ? 'rgba(34, 197, 94, 0.2)' : '#9333ea',
                            color: isInvited ? '#4ade80' : 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: isInvited ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {isInvited ? (
                            <>
                              <Check size={12} />
                              <span>{isAlreadyInBoard ? 'Joined' : 'Invited'}</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={12} />
                              <span>Invite</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* If video call is active, show connected badge */}
          {callStatus === 'connected' && callPeer && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                fontSize: 11,
                color: '#4ade80',
              }}
            >
              <Video size={13} />
              <span>In Call with {callPeer.username}</span>
            </div>
          )}

          <button
            onClick={() => setShowClearConfirm(true)}
            style={{
              background: '#27272a',
              border: 'none',
              color: '#ef4444',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
            }}
            title="Clear Board"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>

          <button
            onClick={exportPNG}
            style={{
              background: '#27272a',
              border: 'none',
              color: '#e4e4e7',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
            }}
            title="Export as PNG Image"
          >
            <Download size={14} />
            <span>PNG</span>
          </button>

          <button
            onClick={exportPDF}
            style={{
              background: '#27272a',
              border: 'none',
              color: '#e4e4e7',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
            }}
            title="Export as PDF Document"
          >
            <FileDown size={14} />
            <span>PDF</span>
          </button>

          <button
            onClick={closeBoard}
            style={{
              background: '#3f3f46',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <X size={15} />
            <span>Close Board</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Workspace Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          style={{
            width: '100%',
            height: '100%',
            cursor:
              activeTool === 'pan'
                ? isPanning
                  ? 'grabbing'
                  : 'grab'
                : activeTool === 'select'
                ? 'default'
                : activeTool === 'eraser'
                ? 'not-allowed'
                : 'crosshair',
          }}
        />

        {/* Floating Miro-Style Tool Dock (Left Center) */}
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            borderRadius: 12,
            padding: '8px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 20,
          }}
        >
          {/* Select Tool */}
          <button
            onClick={() => setActiveTool('select')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'select' ? '#38bdf8' : 'transparent',
              color: activeTool === 'select' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Select & Move (V)"
          >
            <MousePointer size={18} />
          </button>

          {/* Pan Tool */}
          <button
            onClick={() => setActiveTool('pan')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'pan' ? '#38bdf8' : 'transparent',
              color: activeTool === 'pan' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Hand Tool (Pan / H)"
          >
            <Hand size={18} />
          </button>

          <div style={{ height: 1, backgroundColor: '#27272a', margin: '2px 4px' }} />

          {/* Pen Tool */}
          <button
            onClick={() => setActiveTool('pen')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'pen' ? '#38bdf8' : 'transparent',
              color: activeTool === 'pen' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Pen (P)"
          >
            <Pen size={18} />
          </button>

          {/* Highlighter */}
          <button
            onClick={() => setActiveTool('highlighter')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'highlighter' ? '#38bdf8' : 'transparent',
              color: activeTool === 'highlighter' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Highlighter"
          >
            <Highlighter size={18} />
          </button>

          {/* Eraser */}
          <button
            onClick={() => setActiveTool('eraser')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'eraser' ? '#ef4444' : 'transparent',
              color: activeTool === 'eraser' ? '#ffffff' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Eraser (E)"
          >
            <Eraser size={18} />
          </button>

          <div style={{ height: 1, backgroundColor: '#27272a', margin: '2px 4px' }} />

          {/* Rectangle Shape */}
          <button
            onClick={() => setActiveTool('rectangle')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'rectangle' ? '#38bdf8' : 'transparent',
              color: activeTool === 'rectangle' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Rectangle (R)"
          >
            <Square size={18} />
          </button>

          {/* Circle Shape */}
          <button
            onClick={() => setActiveTool('circle')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'circle' ? '#38bdf8' : 'transparent',
              color: activeTool === 'circle' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Circle / Ellipse (C)"
          >
            <Circle size={18} />
          </button>

          {/* Line */}
          <button
            onClick={() => setActiveTool('line')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'line' ? '#38bdf8' : 'transparent',
              color: activeTool === 'line' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Line (L)"
          >
            <Minus size={18} />
          </button>

          {/* Arrow */}
          <button
            onClick={() => setActiveTool('arrow')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'arrow' ? '#38bdf8' : 'transparent',
              color: activeTool === 'arrow' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Arrow (A)"
          >
            <MoveUpRight size={18} />
          </button>

          <div style={{ height: 1, backgroundColor: '#27272a', margin: '2px 4px' }} />

          {/* Text Tool */}
          <button
            onClick={() => setActiveTool('text')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'text' ? '#38bdf8' : 'transparent',
              color: activeTool === 'text' ? '#0f172a' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Text Tool (T)"
          >
            <Type size={18} />
          </button>

          {/* Sticky Note */}
          <button
            onClick={() => setActiveTool('sticky')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeTool === 'sticky' ? '#facc15' : 'transparent',
              color: activeTool === 'sticky' ? '#713f12' : '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Miro Sticky Note (S)"
          >
            <StickyNote size={18} />
          </button>

          {/* Color & Size popover button */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: strokeColor,
              cursor: 'pointer',
              marginTop: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
            title="Color & Style Settings"
          />
        </div>

        {/* Color Palette & Brush Size Floating Popover */}
        {showColorPicker && (
          <div
            style={{
              position: 'absolute',
              left: 72,
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 12,
              padding: 14,
              boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
              zIndex: 25,
              width: 220,
              fontSize: 12,
              color: 'white',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Stroke Color</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setStrokeColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: strokeColor === c ? '2px solid #38bdf8' : '1px solid #3f3f46',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {strokeColor === c && <Check size={14} color={c === '#ffffff' ? '#000' : '#fff'} />}
                </button>
              ))}
            </div>

            <div style={{ fontWeight: 600, marginBottom: 6 }}>Brush Size ({strokeWidth}px)</div>
            <input
              type="range"
              min={1}
              max={24}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 12 }}
            />

            <div style={{ fontWeight: 600, marginBottom: 6 }}>Sticky Note Color</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['yellow', 'pink', 'blue', 'green', 'orange'] as StickyColor[]).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setStickyColor(sc)}
                  style={{
                    flex: 1,
                    height: 24,
                    backgroundColor: STICKY_COLORS[sc].bg,
                    border: stickyColor === sc ? '2px solid #38bdf8' : '1px solid #3f3f46',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Double-Click Text / Sticky Edit Modal */}
        {editingTextElement && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              zIndex: 9999,
              width: 320,
            }}
          >
            <div style={{ fontWeight: 600, color: 'white', marginBottom: 8, fontSize: 13 }}>
              Edit Text
            </div>
            <textarea
              autoFocus
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                color: 'white',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
                resize: 'none',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setEditingTextElement(null)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#27272a',
                  color: '#a1a1aa',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveTextEdit}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#38bdf8',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Clear Canvas Confirmation Dialog */}
        {showClearConfirm && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#18181b',
              border: '1px solid #ef4444',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              zIndex: 9999,
              width: 320,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f4f4f5', marginBottom: 8 }}>
              Clear entire canvas?
            </div>
            <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 16 }}>
              This will remove all drawings, shapes and sticky notes from this session.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#27272a',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearCanvas();
                  setShowClearConfirm(false);
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
