import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export interface IUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

const UserSchema = new Schema<IUser>({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  avatarColor: { type: String, default: '#3b82f6' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const MongoUserModel: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
const jsonUserCollection = new JsonCollection<IUser>('users');

export const UserRepository = {
  async findByEmail(email: string): Promise<IUser | null> {
    if (isMongoActive()) {
      const doc = await (MongoUserModel as any).findOne({ email }).lean();
      return doc ? (doc as unknown as IUser) : null;
    }
    return jsonUserCollection.findOne({ email });
  },

  async findById(id: string): Promise<IUser | null> {
    if (isMongoActive()) {
      const doc = await (MongoUserModel as any).findOne({ id }).lean();
      return doc ? (doc as unknown as IUser) : null;
    }
    return jsonUserCollection.findOne({ id });
  },

  async create(user: IUser): Promise<IUser> {
    if (isMongoActive()) {
      const created = await (MongoUserModel as any).create(user);
      return created.toObject ? created.toObject() : created;
    }
    return jsonUserCollection.create(user);
  },

  async update(id: string, update: Partial<IUser>): Promise<IUser | null> {
    if (isMongoActive()) {
      const updated = await (MongoUserModel as any).findOneAndUpdate(
        { id },
        { ...update, updatedAt: new Date().toISOString() },
        { new: true }
      ).lean();
      return updated ? (updated as unknown as IUser) : null;
    }
    return jsonUserCollection.findByIdAndUpdate(id, { ...update, updatedAt: new Date().toISOString() });
  }
};
