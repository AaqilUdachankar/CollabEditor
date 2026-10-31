import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export interface IProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  template: string;
  isPublic: boolean;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

const ProjectSchema = new Schema<IProject>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  ownerId: { type: String, required: true },
  template: { type: String, default: 'vanilla' },
  isPublic: { type: Boolean, default: false },
  rootPath: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const MongoProjectModel: Model<IProject> = (mongoose.models.Project as Model<IProject>) || mongoose.model<IProject>('Project', ProjectSchema);
const jsonProjectCollection = new JsonCollection<IProject>('projects');

export const ProjectRepository = {
  async findById(id: string): Promise<IProject | null> {
    if (isMongoActive()) {
      const doc = await (MongoProjectModel as any).findOne({ id }).lean();
      return doc ? (doc as unknown as IProject) : null;
    }
    return jsonProjectCollection.findOne({ id });
  },

  async findByOwner(ownerId: string): Promise<IProject[]> {
    if (isMongoActive()) {
      const docs = await (MongoProjectModel as any).find({ ownerId }).lean();
      return docs as unknown as IProject[];
    }
    return jsonProjectCollection.find({ ownerId });
  },

  async findUserProjects(userId: string, projectIds: string[]): Promise<IProject[]> {
    if (isMongoActive()) {
      const docs = await (MongoProjectModel as any).find({
        $or: [{ ownerId: userId }, { id: { $in: projectIds } }]
      }).lean();
      return docs as unknown as IProject[];
    }
    const all = await jsonProjectCollection.find();
    return all.filter(p => p.ownerId === userId || projectIds.includes(p.id));
  },

  async create(project: IProject): Promise<IProject> {
    if (isMongoActive()) {
      const created = await (MongoProjectModel as any).create(project);
      return created.toObject ? created.toObject() : created;
    }
    return jsonProjectCollection.create(project);
  },

  async update(id: string, update: Partial<IProject>): Promise<IProject | null> {
    if (isMongoActive()) {
      const updated = await (MongoProjectModel as any).findOneAndUpdate(
        { id },
        { ...update, updatedAt: new Date().toISOString() },
        { new: true }
      ).lean();
      return updated ? (updated as unknown as IProject) : null;
    }
    return jsonProjectCollection.findByIdAndUpdate(id, { ...update, updatedAt: new Date().toISOString() });
  },

  async findAll(query?: Partial<IProject> | ((item: IProject) => boolean)): Promise<IProject[]> {
    if (isMongoActive()) {
      const mongoQuery = typeof query === 'function' ? {} : (query || {});
      const docs = await (MongoProjectModel as any).find(mongoQuery).lean();
      return docs as unknown as IProject[];
    }
    return jsonProjectCollection.find(query);
  },

  async count(query?: any): Promise<number> {
    if (isMongoActive()) {
      return (MongoProjectModel as any).countDocuments(query || {});
    }
    const all = await jsonProjectCollection.find(query);
    return all.length;
  },

  async delete(id: string): Promise<boolean> {
    if (isMongoActive()) {
      const res = await (MongoProjectModel as any).deleteOne({ id });
      return res.deletedCount > 0;
    }
    return jsonProjectCollection.findByIdAndDelete(id);
  }
};
