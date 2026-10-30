import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export interface IFileVersion {
  id: string;
  projectId: string;
  fileId: string;
  versionNumber: number;
  content: string;
  size: number;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  summary?: string;
  createdAt: string;
}

const FileVersionSchema = new Schema<IFileVersion>({
  id: { type: String, required: true, unique: true },
  projectId: { type: String, required: true, index: true },
  fileId: { type: String, required: true, index: true },
  versionNumber: { type: Number, required: true },
  content: { type: String, default: '' },
  size: { type: Number, default: 0 },
  authorId: { type: String, required: true },
  authorName: { type: String, default: 'Collaborator' },
  authorEmail: { type: String },
  summary: { type: String, default: 'File saved' },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

FileVersionSchema.index({ fileId: 1, versionNumber: -1 });

const MongoFileVersionModel: Model<IFileVersion> =
  (mongoose.models.FileVersion as Model<IFileVersion>) ||
  mongoose.model<IFileVersion>('FileVersion', FileVersionSchema);

const jsonFileVersionCollection = new JsonCollection<IFileVersion>('file_versions');

export const FileVersionRepository = {
  async findByFile(projectId: string, fileId: string, limit: number = 30, skip: number = 0): Promise<{ versions: IFileVersion[]; total: number }> {
    if (isMongoActive()) {
      const total = await (MongoFileVersionModel as any).countDocuments({ projectId, fileId });
      const docs = await (MongoFileVersionModel as any)
        .find({ projectId, fileId })
        .sort({ versionNumber: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return { versions: docs as unknown as IFileVersion[], total };
    }

    const all = (await jsonFileVersionCollection
      .find((v) => v.projectId === projectId && v.fileId === fileId))
      .sort((a, b) => b.versionNumber - a.versionNumber);
    const total = all.length;
    const versions = all.slice(skip, skip + limit);
    return { versions, total };
  },

  async findById(id: string): Promise<IFileVersion | null> {
    if (isMongoActive()) {
      const doc = await (MongoFileVersionModel as any).findOne({ id }).lean();
      return doc ? (doc as unknown as IFileVersion) : null;
    }
    return jsonFileVersionCollection.findOne({ id });
  },

  async findLatest(projectId: string, fileId: string): Promise<IFileVersion | null> {
    if (isMongoActive()) {
      const doc = await (MongoFileVersionModel as any)
        .findOne({ projectId, fileId })
        .sort({ versionNumber: -1 })
        .lean();
      return doc ? (doc as unknown as IFileVersion) : null;
    }

    const all = (await jsonFileVersionCollection
      .find((v) => v.projectId === projectId && v.fileId === fileId))
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return all.length > 0 ? all[0] : null;
  },

  async create(version: IFileVersion): Promise<IFileVersion> {
    if (isMongoActive()) {
      const created = await (MongoFileVersionModel as any).create(version);
      return created.toObject ? created.toObject() : created;
    }
    return jsonFileVersionCollection.create(version);
  },

  async update(id: string, update: Partial<IFileVersion>): Promise<IFileVersion | null> {
    if (isMongoActive()) {
      const updated = await (MongoFileVersionModel as any).findOneAndUpdate(
        { id },
        { ...update },
        { new: true }
      ).lean();
      return updated ? (updated as unknown as IFileVersion) : null;
    }
    return jsonFileVersionCollection.findByIdAndUpdate(id, update);
  },

  async deleteByFile(fileId: string): Promise<number> {
    if (isMongoActive()) {
      const res = await (MongoFileVersionModel as any).deleteMany({ fileId });
      return res.deletedCount || 0;
    }
    return jsonFileVersionCollection.deleteMany({ fileId });
  },

  async deleteByProject(projectId: string): Promise<number> {
    if (isMongoActive()) {
      const res = await (MongoFileVersionModel as any).deleteMany({ projectId });
      return res.deletedCount || 0;
    }
    return jsonFileVersionCollection.deleteMany({ projectId });
  },
};
