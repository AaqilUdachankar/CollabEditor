import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export interface IFileNode {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
  language?: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
}

const FileNodeSchema = new Schema<IFileNode>({
  id: { type: String, required: true, unique: true },
  projectId: { type: String, required: true, index: true },
  parentId: { type: String, default: null },
  name: { type: String, required: true },
  path: { type: String, required: true },
  type: { type: String, enum: ['file', 'directory'], required: true },
  content: { type: String, default: '' },
  language: { type: String, default: 'plaintext' },
  size: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const MongoFileNodeModel: Model<IFileNode> = (mongoose.models.FileNode as Model<IFileNode>) || mongoose.model<IFileNode>('FileNode', FileNodeSchema);
const jsonFileCollection = new JsonCollection<IFileNode>('files');

export const FileNodeRepository = {
  async findByProject(projectId: string): Promise<IFileNode[]> {
    if (isMongoActive()) {
      const docs = await (MongoFileNodeModel as any).find({ projectId }).lean();
      return docs as unknown as IFileNode[];
    }
    return jsonFileCollection.find({ projectId });
  },

  async findById(id: string): Promise<IFileNode | null> {
    if (isMongoActive()) {
      const doc = await (MongoFileNodeModel as any).findOne({ id }).lean();
      return doc ? (doc as unknown as IFileNode) : null;
    }
    return jsonFileCollection.findOne({ id });
  },

  async findByPath(projectId: string, path: string): Promise<IFileNode | null> {
    if (isMongoActive()) {
      const doc = await (MongoFileNodeModel as any).findOne({ projectId, path }).lean();
      return doc ? (doc as unknown as IFileNode) : null;
    }
    return jsonFileCollection.findOne(item => item.projectId === projectId && item.path === path);
  },

  async create(fileNode: IFileNode): Promise<IFileNode> {
    if (isMongoActive()) {
      const created = await (MongoFileNodeModel as any).create(fileNode);
      return created.toObject ? created.toObject() : created;
    }
    return jsonFileCollection.create(fileNode);
  },

  async update(id: string, update: Partial<IFileNode>): Promise<IFileNode | null> {
    if (isMongoActive()) {
      const updated = await (MongoFileNodeModel as any).findOneAndUpdate(
        { id },
        { ...update, updatedAt: new Date().toISOString() },
        { new: true }
      ).lean();
      return updated ? (updated as unknown as IFileNode) : null;
    }
    return jsonFileCollection.findByIdAndUpdate(id, { ...update, updatedAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<boolean> {
    if (isMongoActive()) {
      const res = await (MongoFileNodeModel as any).deleteOne({ id });
      return res.deletedCount > 0;
    }
    return jsonFileCollection.findByIdAndDelete(id);
  },

  async deleteByProject(projectId: string): Promise<number> {
    if (isMongoActive()) {
      const res = await (MongoFileNodeModel as any).deleteMany({ projectId });
      return res.deletedCount || 0;
    }
    return jsonFileCollection.deleteMany({ projectId });
  }
};
