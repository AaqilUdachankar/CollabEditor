import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface IUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatarColor: string;
  role?: UserRole;
  status?: UserStatus;
  lastActive?: string;
  createdAt: string;
  updatedAt: string;
}

const UserSchema = new Schema<IUser>({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  avatarColor: { type: String, default: '#3b82f6' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  lastActive: { type: String, default: () => new Date().toISOString() },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const MongoUserModel: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
const jsonUserCollection = new JsonCollection<IUser>('users');

function normalizeUser(user: IUser | null): IUser | null {
  if (!user) return null;
  const isDefaultAdmin = user.email === 'alice@nexus.test' || user.email.startsWith('admin@') || user.email.startsWith('admin_');
  return {
    ...user,
    role: user.role || (isDefaultAdmin ? 'admin' : 'user'),
    status: user.status || 'active',
    lastActive: user.lastActive || user.updatedAt || user.createdAt || new Date().toISOString(),
  };
}

export const UserRepository = {
  async findByEmail(email: string): Promise<IUser | null> {
    if (isMongoActive()) {
      const doc = await (MongoUserModel as any).findOne({ email }).lean();
      return normalizeUser(doc ? (doc as unknown as IUser) : null);
    }
    const doc = await jsonUserCollection.findOne({ email });
    return normalizeUser(doc);
  },

  async findById(id: string): Promise<IUser | null> {
    if (isMongoActive()) {
      const doc = await (MongoUserModel as any).findOne({ id }).lean();
      return normalizeUser(doc ? (doc as unknown as IUser) : null);
    }
    const doc = await jsonUserCollection.findOne({ id });
    return normalizeUser(doc);
  },

  async findAll(query?: Partial<IUser> | ((item: IUser) => boolean)): Promise<IUser[]> {
    if (isMongoActive()) {
      const mongoQuery = typeof query === 'function' ? {} : (query || {});
      const docs = await (MongoUserModel as any).find(mongoQuery).lean();
      return (docs as unknown as IUser[]).map(u => normalizeUser(u)!);
    }
    const all = await jsonUserCollection.find(query);
    return all.map(u => normalizeUser(u)!);
  },

  async count(query?: any): Promise<number> {
    if (isMongoActive()) {
      return (MongoUserModel as any).countDocuments(query || {});
    }
    const all = await jsonUserCollection.find(query);
    return all.length;
  },

  async create(user: IUser): Promise<IUser> {
    const isDefaultAdmin = user.email === 'alice@nexus.test' || user.email.startsWith('admin@') || user.email.startsWith('admin_');
    const normalized: IUser = {
      ...user,
      role: user.role || (isDefaultAdmin ? 'admin' : 'user'),
      status: user.status || 'active',
      lastActive: user.lastActive || new Date().toISOString(),
    };
    if (isMongoActive()) {
      const created = await (MongoUserModel as any).create(normalized);
      return normalizeUser(created.toObject ? created.toObject() : created)!;
    }
    const created = await jsonUserCollection.create(normalized);
    return normalizeUser(created)!;
  },

  async update(id: string, update: Partial<IUser>): Promise<IUser | null> {
    if (isMongoActive()) {
      const updated = await (MongoUserModel as any).findOneAndUpdate(
        { id },
        { ...update, updatedAt: new Date().toISOString() },
        { new: true }
      ).lean();
      return normalizeUser(updated ? (updated as unknown as IUser) : null);
    }
    const updated = await jsonUserCollection.findByIdAndUpdate(id, { ...update, updatedAt: new Date().toISOString() });
    return normalizeUser(updated);
  },

  async updateLastActive(id: string): Promise<void> {
    const now = new Date().toISOString();
    if (isMongoActive()) {
      await (MongoUserModel as any).updateOne({ id }, { lastActive: now });
    } else {
      await jsonUserCollection.findByIdAndUpdate(id, { lastActive: now });
    }
  }
};
