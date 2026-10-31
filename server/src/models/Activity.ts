import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export type ActivityEventType =
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'file:create'
  | 'file:save'
  | 'file:rename'
  | 'file:delete'
  | 'execution:start'
  | 'execution:complete'
  | 'execution:error'
  | 'git:commit'
  | 'git:stage'
  | 'member:join'
  | 'member:leave'
  | 'member:role_change'
  | 'session:connect'
  | 'session:disconnect'
  | 'admin:user_update'
  | 'admin:role_change'
  | 'admin:status_change'
  | 'admin:project_modify'
  | 'error:api'
  | 'error:save'
  | 'error:websocket';

export interface IActivityMetadata {
  fileId?: string;
  fileName?: string;
  filePath?: string;
  fileExtension?: string;
  fileSize?: number;
  linesChanged?: number;
  durationMs?: number;
  exitCode?: number;
  language?: string;
  template?: string;
  commitHash?: string;
  commitMessage?: string;
  previousRole?: string;
  newRole?: string;
  previousStatus?: string;
  newStatus?: string;
  errorSummary?: string;
  timeout?: boolean;
  success?: boolean;
  clientIp?: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  [key: string]: any;
}

export interface IActivity {
  id: string;
  projectId?: string;
  userId: string;
  username: string;
  userEmail?: string;
  eventType: ActivityEventType;
  action: string;
  metadata: IActivityMetadata;
  createdAt: string;
}

const ActivitySchema = new Schema<IActivity>({
  id: { type: String, required: true, unique: true },
  projectId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  userEmail: { type: String },
  eventType: { type: String, required: true, index: true },
  action: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: String, default: () => new Date().toISOString(), index: true },
});

ActivitySchema.index({ projectId: 1, createdAt: -1 });
ActivitySchema.index({ eventType: 1, createdAt: -1 });

const MongoActivityModel: Model<IActivity> =
  (mongoose.models.Activity as Model<IActivity>) ||
  mongoose.model<IActivity>('Activity', ActivitySchema);

const jsonActivityCollection = new JsonCollection<IActivity>('activities');

export interface ActivityFilterOptions {
  projectId?: string;
  userId?: string;
  eventType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}

export const ActivityRepository = {
  async create(activity: IActivity): Promise<IActivity> {
    if (isMongoActive()) {
      const created = await (MongoActivityModel as any).create(activity);
      return created.toObject ? created.toObject() : created;
    }
    return jsonActivityCollection.create(activity);
  },

  async findByProject(
    projectId: string,
    options: { eventType?: string; limit?: number; skip?: number } = {}
  ): Promise<{ activities: IActivity[]; total: number }> {
    const limit = options.limit || 50;
    const skip = options.skip || 0;

    if (isMongoActive()) {
      const query: any = { projectId };
      if (options.eventType) {
        query.eventType = options.eventType;
      }
      const total = await (MongoActivityModel as any).countDocuments(query);
      const docs = await (MongoActivityModel as any)
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return { activities: docs as unknown as IActivity[], total };
    }

    const all = (await jsonActivityCollection.find(
      (a) => a.projectId === projectId && (!options.eventType || a.eventType === options.eventType)
    )).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = all.length;
    const activities = all.slice(skip, skip + limit);
    return { activities, total };
  },

  async findPlatform(
    options: ActivityFilterOptions = {}
  ): Promise<{ activities: IActivity[]; total: number }> {
    const limit = options.limit || 50;
    const skip = options.skip || 0;

    if (isMongoActive()) {
      const query: any = {};
      if (options.projectId) query.projectId = options.projectId;
      if (options.userId) query.userId = options.userId;
      if (options.eventType) query.eventType = options.eventType;
      if (options.startDate || options.endDate) {
        query.createdAt = {};
        if (options.startDate) query.createdAt.$gte = options.startDate;
        if (options.endDate) query.createdAt.$lte = options.endDate;
      }
      if (options.search) {
        const regex = new RegExp(options.search, 'i');
        query.$or = [{ action: regex }, { username: regex }, { 'metadata.fileName': regex }];
      }

      const total = await (MongoActivityModel as any).countDocuments(query);
      const docs = await (MongoActivityModel as any)
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return { activities: docs as unknown as IActivity[], total };
    }

    const all = (await jsonActivityCollection.find((a) => {
      if (options.projectId && a.projectId !== options.projectId) return false;
      if (options.userId && a.userId !== options.userId) return false;
      if (options.eventType && a.eventType !== options.eventType) return false;
      if (options.startDate && new Date(a.createdAt) < new Date(options.startDate)) return false;
      if (options.endDate && new Date(a.createdAt) > new Date(options.endDate)) return false;
      if (options.search) {
        const term = options.search.toLowerCase();
        const inAction = a.action.toLowerCase().includes(term);
        const inUser = a.username.toLowerCase().includes(term);
        const inFileName = a.metadata?.fileName?.toLowerCase().includes(term);
        if (!inAction && !inUser && !inFileName) return false;
      }
      return true;
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = all.length;
    const activities = all.slice(skip, skip + limit);
    return { activities, total };
  },

  async count(query?: any): Promise<number> {
    if (isMongoActive()) {
      return (MongoActivityModel as any).countDocuments(query || {});
    }
    const all = await jsonActivityCollection.find(query);
    return all.length;
  },

  async getRecent(limit: number = 10): Promise<IActivity[]> {
    const res = await this.findPlatform({ limit, skip: 0 });
    return res.activities;
  }
};

