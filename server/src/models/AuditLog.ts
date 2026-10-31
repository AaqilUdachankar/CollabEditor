import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export interface IAuditLog {
  id: string;
  actorId: string;
  actorUsername: string;
  actorEmail?: string;
  action: string;
  targetType: 'user' | 'project' | 'member' | 'system';
  targetId: string;
  targetName?: string;
  details?: Record<string, any>;
  timestamp: string;
}

const AuditLogSchema = new Schema<IAuditLog>({
  id: { type: String, required: true, unique: true },
  actorId: { type: String, required: true, index: true },
  actorUsername: { type: String, required: true },
  actorEmail: { type: String },
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true, enum: ['user', 'project', 'member', 'system'] },
  targetId: { type: String, required: true, index: true },
  targetName: { type: String },
  details: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: String, default: () => new Date().toISOString(), index: true },
});

AuditLogSchema.index({ timestamp: -1 });

const MongoAuditLogModel: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

const jsonAuditCollection = new JsonCollection<IAuditLog>('audit_logs');

export interface AuditLogFilterOptions {
  actorId?: string;
  targetType?: string;
  action?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export const AuditLogRepository = {
  async create(log: IAuditLog): Promise<IAuditLog> {
    if (isMongoActive()) {
      const created = await (MongoAuditLogModel as any).create(log);
      return created.toObject ? created.toObject() : created;
    }
    return jsonAuditCollection.create(log);
  },

  async find(
    options: AuditLogFilterOptions = {}
  ): Promise<{ logs: IAuditLog[]; total: number }> {
    const limit = options.limit || 50;
    const skip = options.skip || 0;

    if (isMongoActive()) {
      const query: any = {};
      if (options.actorId) query.actorId = options.actorId;
      if (options.targetType) query.targetType = options.targetType;
      if (options.action) query.action = options.action;
      if (options.search) {
        const regex = new RegExp(options.search, 'i');
        query.$or = [{ action: regex }, { actorUsername: regex }, { targetName: regex }];
      }

      const total = await (MongoAuditLogModel as any).countDocuments(query);
      const docs = await (MongoAuditLogModel as any)
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return { logs: docs as unknown as IAuditLog[], total };
    }

    const all = (await jsonAuditCollection.find((l) => {
      if (options.actorId && l.actorId !== options.actorId) return false;
      if (options.targetType && l.targetType !== options.targetType) return false;
      if (options.action && l.action !== options.action) return false;
      if (options.search) {
        const term = options.search.toLowerCase();
        const inAction = l.action.toLowerCase().includes(term);
        const inActor = l.actorUsername.toLowerCase().includes(term);
        const inTarget = (l.targetName || '').toLowerCase().includes(term);
        if (!inAction && !inActor && !inTarget) return false;
      }
      return true;
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = all.length;
    const logs = all.slice(skip, skip + limit);
    return { logs, total };
  },

  async count(query?: any): Promise<number> {
    if (isMongoActive()) {
      return (MongoAuditLogModel as any).countDocuments(query || {});
    }
    const all = await jsonAuditCollection.find(query);
    return all.length;
  }
};

