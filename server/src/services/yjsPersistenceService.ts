import fs from 'fs';
import path from 'path';
import * as Y from 'yjs';
import { config } from '../config/index.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { FileService } from './fileService.js';
import { HistoryService } from './historyService.js';

export class YjsPersistenceService {
  private static yjsDir = path.join(process.cwd(), './data/yjs');
  private static docs: Map<string, Y.Doc> = new Map();
  private static saveDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  static init(): void {
    if (!fs.existsSync(this.yjsDir)) {
      fs.mkdirSync(this.yjsDir, { recursive: true });
    }
  }

  static getDocPath(docName: string): string {
    // Sanitize docName for safe filename
    const safe = docName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.yjsDir, `${safe}.yjs`);
  }

  static async getOrCreateDoc(docName: string): Promise<Y.Doc> {
    if (this.docs.has(docName)) {
      return this.docs.get(docName)!;
    }

    this.init();
    const doc = new Y.Doc();
    const docPath = this.getDocPath(docName);

    // 1. Check if binary Yjs file exists
    if (fs.existsSync(docPath)) {
      try {
        const update = fs.readFileSync(docPath);
        Y.applyUpdate(doc, update);
      } catch (err) {
        console.error(`[Yjs] Error reading persistent CRDT state for ${docName}:`, err);
      }
    } else {
      // 2. Fall back to loading plain text from FileNodeRepository if it's a file doc
      const parts = docName.split('::');
      if (parts.length === 2) {
        const [projectId, fileId] = parts;
        try {
          const file = await FileNodeRepository.findById(fileId);
          if (file && file.content) {
            const ytext = doc.getText('monaco');
            doc.transact(() => {
              ytext.insert(0, file.content || '');
            });
            // Persist the initial state
            const state = Y.encodeStateAsUpdate(doc);
            fs.writeFileSync(docPath, Buffer.from(state));
          }
        } catch (err) {
          console.error(`[Yjs] Error initializing doc content from repository for ${docName}:`, err);
        }
      }
    }

    // Bind update listener to persist CRDT state and debounce save to FileNode
    doc.on('update', (update: Uint8Array) => {
      this.handleDocUpdate(docName, doc, update);
    });

    this.docs.set(docName, doc);
    return doc;
  }

  private static handleDocUpdate(docName: string, doc: Y.Doc, _update: Uint8Array): void {
    const docPath = this.getDocPath(docName);

    // Debounce disk persistence for high performance
    if (this.saveDebounceTimers.has(docName)) {
      clearTimeout(this.saveDebounceTimers.get(docName)!);
    }

    const timer = setTimeout(async () => {
      try {
        // 1. Save full Yjs CRDT state binary
        const fullState = Y.encodeStateAsUpdate(doc);
        fs.writeFileSync(docPath, Buffer.from(fullState));

        // 2. Extract plain text and sync with FileNode & project filesystem
        const parts = docName.split('::');
        if (parts.length === 2) {
          const [projectId, fileId] = parts;
          const text = doc.getText('monaco').toString();
          await FileService.saveFileContent(projectId, fileId, text);
          try {
            await HistoryService.createSnapshot(
              projectId,
              fileId,
              text,
              { id: 'collaborative', username: 'Collaborative Edit' },
              'Collaborative autosave'
            );
          } catch {
            // do not fail Yjs sync
          }
        }
      } catch (err) {
        console.error(`[Yjs] Error persisting update for ${docName}:`, err);
      } finally {
        this.saveDebounceTimers.delete(docName);
      }
    }, 600);

    this.saveDebounceTimers.set(docName, timer);
  }

  static getLoadedDoc(docName: string): Y.Doc | undefined {
    return this.docs.get(docName);
  }

  static removeDoc(docName: string): void {
    if (this.saveDebounceTimers.has(docName)) {
      clearTimeout(this.saveDebounceTimers.get(docName)!);
      this.saveDebounceTimers.delete(docName);
    }
    const doc = this.docs.get(docName);
    if (doc) {
      // Save one final snapshot before destroying
      try {
        const fullState = Y.encodeStateAsUpdate(doc);
        fs.writeFileSync(this.getDocPath(docName), Buffer.from(fullState));
      } catch {
        // ignore
      }
      doc.destroy();
      this.docs.delete(docName);
    }
  }
}
