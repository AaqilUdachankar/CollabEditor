import { v4 as uuidv4 } from 'uuid';
import { FileVersionRepository, IFileVersion } from '../models/FileVersion.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { FileService } from './fileService.js';
import { YjsPersistenceService } from './yjsPersistenceService.js';
import { getSocketIO } from '../sockets/index.js';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  lines: DiffLine[];
}

export class HistoryService {
  /**
   * Debounced or interval snapshot creation.
   * Prevents creating a snapshot on every keystroke in collaborative environments.
   */
  static async createSnapshot(
    projectId: string,
    fileId: string,
    content: string,
    author: { id: string; username: string; email?: string },
    summary: string = 'Saved version',
    force: boolean = false
  ): Promise<IFileVersion> {
    const file = await FileNodeRepository.findById(fileId);
    if (!file || file.projectId !== projectId) {
      throw new Error('File not found in project');
    }

    const latest = await FileVersionRepository.findLatest(projectId, fileId);

    // If content is identical to latest snapshot, no new snapshot needed
    if (latest && latest.content === content) {
      return latest;
    }

    // Debounce: If not forced, and last snapshot by the same author was < 15 seconds ago,
    // update the latest snapshot's content instead of creating an excessive version record
    if (!force && latest && latest.authorId === author.id) {
      const elapsedMs = Date.now() - new Date(latest.createdAt).getTime();
      if (elapsedMs < 15000) {
        const updated = await FileVersionRepository.update(latest.id, {
          content,
          size: Buffer.byteLength(content, 'utf-8'),
          summary,
        });
        return updated || latest;
      }
    }

    const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;

    const version: IFileVersion = {
      id: uuidv4(),
      projectId,
      fileId,
      versionNumber: nextVersionNumber,
      content,
      size: Buffer.byteLength(content, 'utf-8'),
      authorId: author.id,
      authorName: author.username || 'Collaborator',
      authorEmail: author.email,
      summary: summary || `Version ${nextVersionNumber}`,
      createdAt: new Date().toISOString(),
    };

    return FileVersionRepository.create(version);
  }

  static async getHistory(
    projectId: string,
    fileId: string,
    limit: number = 30,
    skip: number = 0
  ): Promise<{ versions: IFileVersion[]; total: number }> {
    const file = await FileNodeRepository.findById(fileId);
    if (!file || file.projectId !== projectId) {
      throw new Error('File not found');
    }

    // If no versions exist yet, seed initial version from active file content
    const count = await FileVersionRepository.findByFile(projectId, fileId, 1, 0);
    if (count.total === 0) {
      await this.createSnapshot(
        projectId,
        fileId,
        file.content || '',
        { id: 'system', username: 'Original' },
        'Initial version',
        true
      );
    }

    return FileVersionRepository.findByFile(projectId, fileId, limit, skip);
  }

  static async getVersion(projectId: string, fileId: string, versionId: string): Promise<IFileVersion> {
    const version = await FileVersionRepository.findById(versionId);
    if (!version || version.projectId !== projectId || version.fileId !== fileId) {
      throw new Error('Version snapshot not found');
    }
    return version;
  }

  /**
   * Restore a historical snapshot.
   * Requires confirmation on client and creates a new version record rather than deleting history.
   * Synchronizes with active Yjs doc so all active collaborators receive the restored state.
   */
  static async restoreVersion(
    projectId: string,
    fileId: string,
    versionId: string,
    user: { id: string; username: string; email?: string }
  ): Promise<{ file: any; newVersion: IFileVersion }> {
    const targetVersion = await this.getVersion(projectId, fileId, versionId);

    // 1. Save restored content to disk & FileNode database
    const updatedFile = await FileService.saveFileContent(projectId, fileId, targetVersion.content);

    // 2. Synchronize Yjs CRDT document in real-time so connected collaborators receive update
    try {
      const docName = `${projectId}::${fileId}`;
      const doc = await YjsPersistenceService.getOrCreateDoc(docName);
      const ytext = doc.getText('monaco');
      doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, targetVersion.content);
      });
    } catch (err) {
      console.error('[HistoryService] Error updating Yjs CRDT state during restore:', err);
    }

    // 3. Create a new version snapshot tracking the restore action
    const newVersion = await this.createSnapshot(
      projectId,
      fileId,
      targetVersion.content,
      user,
      `Restored from Version ${targetVersion.versionNumber}`,
      true // Force new version
    );

    // 4. Notify room collaborators via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`project:${projectId}`).emit('file:restored', {
        fileId,
        versionNumber: newVersion.versionNumber,
        restoredFromVersion: targetVersion.versionNumber,
        author: user.username,
        content: targetVersion.content,
      });
      io.to(`project:${projectId}`).emit('file:saved', { fileId, size: updatedFile.size });
    }

    return { file: updatedFile, newVersion };
  }

  /**
   * Line-by-line diff computation using Longest Common Subsequence (LCS).
   */
  static computeDiff(textA: string, textB: string): DiffResult {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');

    const m = linesA.length;
    const n = linesB.length;

    // LCS table for small/medium documents, or chunked for large documents
    const maxMatrixSize = 3000 * 3000;
    if (m * n > maxMatrixSize) {
      // Fast line compare for very large files
      return this.computeFastDiff(linesA, linesB);
    }

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (linesA[i - 1] === linesB[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = m;
    let j = n;
    const reversedLines: DiffLine[] = [];
    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        reversedLines.push({
          type: 'unchanged',
          content: linesA[i - 1],
          oldLineNumber: i,
          newLineNumber: j,
        });
        unchangedCount++;
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        reversedLines.push({
          type: 'added',
          content: linesB[j - 1],
          newLineNumber: j,
        });
        addedCount++;
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        reversedLines.push({
          type: 'removed',
          content: linesA[i - 1],
          oldLineNumber: i,
        });
        removedCount++;
        i--;
      }
    }

    return {
      addedCount,
      removedCount,
      unchangedCount,
      lines: reversedLines.reverse(),
    };
  }

  private static computeFastDiff(linesA: string[], linesB: string[]): DiffResult {
    const lines: DiffLine[] = [];
    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    const maxLines = Math.max(linesA.length, linesB.length);
    for (let i = 0; i < maxLines; i++) {
      const a = linesA[i];
      const b = linesB[i];

      if (a === undefined) {
        lines.push({ type: 'added', content: b, newLineNumber: i + 1 });
        addedCount++;
      } else if (b === undefined) {
        lines.push({ type: 'removed', content: a, oldLineNumber: i + 1 });
        removedCount++;
      } else if (a === b) {
        lines.push({ type: 'unchanged', content: a, oldLineNumber: i + 1, newLineNumber: i + 1 });
        unchangedCount++;
      } else {
        lines.push({ type: 'removed', content: a, oldLineNumber: i + 1 });
        lines.push({ type: 'added', content: b, newLineNumber: i + 1 });
        removedCount++;
        addedCount++;
      }
    }

    return { addedCount, removedCount, unchangedCount, lines };
  }
}
