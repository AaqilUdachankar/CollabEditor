export type WhiteboardTool =
  | 'select'
  | 'pan'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'text'
  | 'sticky';

export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';

export interface IPoint {
  x: number;
  y: number;
}

export interface IWhiteboardElement {
  id: string;
  type: 'stroke' | 'shape' | 'text' | 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // Stroke specific
  points?: IPoint[];
  strokeColor?: string;
  strokeWidth?: number;
  isHighlighter?: boolean;
  // Shape specific
  shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
  fillColor?: string;
  // Text specific
  text?: string;
  fontSize?: number;
  fontColor?: string;
  // Sticky specific
  stickyColor?: StickyColor;
  authorName?: string;
  // Meta
  createdBy: string;
  updatedAt: number;
}

export interface IWhiteboardCursor {
  userId: string;
  username: string;
  avatarColor: string;
  x: number;
  y: number;
  lastActive: number;
}

export interface IWhiteboardViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface IPrivateBoardSummary {
  id: string;
  boardId: string;
  title: string;
  ownerId: string;
  workspaceId?: string;
  participantIds: string[];
  participants?: { id: string; username: string; avatarColor?: string }[];
  canvasData?: {
    elements?: IWhiteboardElement[];
    viewport?: IWhiteboardViewport;
  };
  updatedAt: string;
}
