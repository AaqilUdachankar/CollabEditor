import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export interface IPrivateWhiteboard {
  id: string;
  boardId: string;
  ownerId: string;
  participantIds: string[];
  workspaceId: string;
  title: string;
  canvasData: {
    elements?: any[];
    viewport?: { zoom: number; panX: number; panY: number };
    backgroundColor?: string;
    version?: number;
  };
  createdAt: string;
  updatedAt: string;
}

const PrivateWhiteboardSchema = new Schema<IPrivateWhiteboard>({
  id: { type: String, required: true, unique: true },
  boardId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: String, required: true, index: true },
  participantIds: [{ type: String, required: true, index: true }],
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, default: 'Private Collaborative Board' },
  canvasData: { type: Schema.Types.Mixed, default: { elements: [], viewport: { zoom: 1, panX: 0, panY: 0 } } },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const MongoPrivateWhiteboardModel: Model<IPrivateWhiteboard> =
  (mongoose.models.PrivateWhiteboard as Model<IPrivateWhiteboard>) ||
  mongoose.model<IPrivateWhiteboard>('PrivateWhiteboard', PrivateWhiteboardSchema);

const jsonWhiteboardCollection = new JsonCollection<IPrivateWhiteboard>('private_whiteboards');

export const PrivateWhiteboardRepository = {
  async create(board: IPrivateWhiteboard): Promise<IPrivateWhiteboard> {
    if (isMongoActive()) {
      const created = await (MongoPrivateWhiteboardModel as any).create(board);
      return created.toObject ? created.toObject() : created;
    }
    return jsonWhiteboardCollection.create(board);
  },

  async findByBoardId(boardId: string): Promise<IPrivateWhiteboard | null> {
    if (isMongoActive()) {
      const doc = await (MongoPrivateWhiteboardModel as any).findOne({ boardId }).lean();
      return doc ? (doc as unknown as IPrivateWhiteboard) : null;
    }
    return jsonWhiteboardCollection.findOne({ boardId });
  },

  async findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<IPrivateWhiteboard[]> {
    if (isMongoActive()) {
      const docs = await (MongoPrivateWhiteboardModel as any)
        .find({
          workspaceId,
          participantIds: userId,
        })
        .sort({ updatedAt: -1 })
        .lean();
      return docs as unknown as IPrivateWhiteboard[];
    }
    const all = await jsonWhiteboardCollection.find(
      (b) => b.workspaceId === workspaceId && Array.isArray(b.participantIds) && b.participantIds.includes(userId)
    );
    return all.reverse();
  },

  async updateCanvasData(boardId: string, canvasData: any): Promise<IPrivateWhiteboard | null> {
    const updatedAt = new Date().toISOString();
    if (isMongoActive()) {
      const updated = await (MongoPrivateWhiteboardModel as any)
        .findOneAndUpdate({ boardId }, { canvasData, updatedAt }, { new: true })
        .lean();
      return updated ? (updated as unknown as IPrivateWhiteboard) : null;
    }

    const existing = await this.findByBoardId(boardId);
    if (!existing) return null;
    return jsonWhiteboardCollection.findByIdAndUpdate(existing.id, { canvasData, updatedAt });
  },

  async addParticipant(boardId: string, userId: string): Promise<IPrivateWhiteboard | null> {
    const updatedAt = new Date().toISOString();
    if (isMongoActive()) {
      const updated = await (MongoPrivateWhiteboardModel as any)
        .findOneAndUpdate(
          { boardId },
          { $addToSet: { participantIds: userId }, updatedAt },
          { new: true }
        )
        .lean();
      return updated ? (updated as unknown as IPrivateWhiteboard) : null;
    }
    const existing = await this.findByBoardId(boardId);
    if (!existing) return null;
    const participants = Array.from(new Set([...(existing.participantIds || []), userId]));
    return jsonWhiteboardCollection.findByIdAndUpdate(existing.id, { participantIds: participants, updatedAt });
  },

  async deleteByBoardId(boardId: string): Promise<boolean> {
    if (isMongoActive()) {
      const res = await (MongoPrivateWhiteboardModel as any).deleteOne({ boardId });
      return res.deletedCount > 0;
    }
    const existing = await this.findByBoardId(boardId);
    if (!existing) return false;
    return jsonWhiteboardCollection.findByIdAndDelete(existing.id);
  },
};
