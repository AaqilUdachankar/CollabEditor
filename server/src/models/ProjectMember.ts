import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface IProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
}

const ProjectMemberSchema = new Schema<IProjectMember>({
  id: { type: String, required: true, unique: true },
  projectId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'editor' },
  joinedAt: { type: String, default: () => new Date().toISOString() },
});

const MongoProjectMemberModel: Model<IProjectMember> = (mongoose.models.ProjectMember as Model<IProjectMember>) || mongoose.model<IProjectMember>('ProjectMember', ProjectMemberSchema);
const jsonMemberCollection = new JsonCollection<IProjectMember>('project_members');

export const ProjectMemberRepository = {
  async findAll(query?: Partial<IProjectMember> | ((item: IProjectMember) => boolean)): Promise<IProjectMember[]> {
    if (isMongoActive()) {
      const mongoQuery = typeof query === 'function' ? {} : (query || {});
      const docs = await (MongoProjectMemberModel as any).find(mongoQuery).lean();
      return docs as unknown as IProjectMember[];
    }
    return jsonMemberCollection.find(query);
  },

  async count(query?: any): Promise<number> {
    if (isMongoActive()) {
      return (MongoProjectMemberModel as any).countDocuments(query || {});
    }
    const all = await jsonMemberCollection.find(query);
    return all.length;
  },

  async findByProject(projectId: string): Promise<IProjectMember[]> {
    if (isMongoActive()) {
      const docs = await (MongoProjectMemberModel as any).find({ projectId }).lean();
      return docs as unknown as IProjectMember[];
    }
    return jsonMemberCollection.find({ projectId });
  },

  async findByUser(userId: string): Promise<IProjectMember[]> {
    if (isMongoActive()) {
      const docs = await (MongoProjectMemberModel as any).find({ userId }).lean();
      return docs as unknown as IProjectMember[];
    }
    return jsonMemberCollection.find({ userId });
  },

  async findMembership(projectId: string, userId: string): Promise<IProjectMember | null> {
    if (isMongoActive()) {
      const doc = await (MongoProjectMemberModel as any).findOne({ projectId, userId }).lean();
      return doc ? (doc as unknown as IProjectMember) : null;
    }
    return jsonMemberCollection.findOne(item => item.projectId === projectId && item.userId === userId);
  },

  async addMember(member: IProjectMember): Promise<IProjectMember> {
    if (isMongoActive()) {
      const created = await (MongoProjectMemberModel as any).create(member);
      return created.toObject ? created.toObject() : created;
    }
    return jsonMemberCollection.create(member);
  },

  async updateRole(projectId: string, userId: string, role: ProjectRole): Promise<IProjectMember | null> {
    if (isMongoActive()) {
      const updated = await (MongoProjectMemberModel as any).findOneAndUpdate(
        { projectId, userId },
        { role },
        { new: true }
      ).lean();
      return updated ? (updated as unknown as IProjectMember) : null;
    }
    const existing = await this.findMembership(projectId, userId);
    if (!existing) return null;
    return jsonMemberCollection.findByIdAndUpdate(existing.id, { role });
  },

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    if (isMongoActive()) {
      const res = await (MongoProjectMemberModel as any).deleteOne({ projectId, userId });
      return res.deletedCount > 0;
    }
    const existing = await this.findMembership(projectId, userId);
    if (!existing) return false;
    return jsonMemberCollection.findByIdAndDelete(existing.id);
  }
};
