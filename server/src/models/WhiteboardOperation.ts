import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export interface IWhiteboardOperation {
  id: string;
  boardId: string;
  userId: string;
  operationType: string;
  operationData: any;
  timestamp: string;
}

const WhiteboardOperationSchema = new Schema<IWhiteboardOperation>({
  id: { type: String, required: true, unique: true },
  boardId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  operationType: { type: String, required: true },
  operationData: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: String, default: () => new Date().toISOString() },
});

const MongoWhiteboardOperationModel: Model<IWhiteboardOperation> =
  (mongoose.models.WhiteboardOperation as Model<IWhiteboardOperation>) ||
  mongoose.model<IWhiteboardOperation>('WhiteboardOperation', WhiteboardOperationSchema);

const jsonOperationCollection = new JsonCollection<IWhiteboardOperation>('whiteboard_operations');

export const WhiteboardOperationRepository = {
  async record(op: IWhiteboardOperation): Promise<IWhiteboardOperation> {
    if (isMongoActive()) {
      const created = await (MongoWhiteboardOperationModel as any).create(op);
      return created.toObject ? created.toObject() : created;
    }
    return jsonOperationCollection.create(op);
  },

  async findByBoard(boardId: string, limit = 100): Promise<IWhiteboardOperation[]> {
    if (isMongoActive()) {
      const docs = await (MongoWhiteboardOperationModel as any)
        .find({ boardId })
        .sort({ timestamp: 1 })
        .limit(limit)
        .lean();
      return docs as unknown as IWhiteboardOperation[];
    }
    const all = await jsonOperationCollection.find({ boardId });
    return all.slice(-limit);
  },

  async clearBoardOperations(boardId: string): Promise<number> {
    if (isMongoActive()) {
      const res = await (MongoWhiteboardOperationModel as any).deleteMany({ boardId });
      return res.deletedCount;
    }
    return jsonOperationCollection.deleteMany({ boardId });
  },
};
