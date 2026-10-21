import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';
import { ProjectRole } from './ProjectMember.js';

export interface IInvitation {
  id: string;
  token: string;
  projectId: string;
  inviterId: string;
  role: ProjectRole;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

const InvitationSchema = new Schema<IInvitation>({
  id: { type: String, required: true, unique: true },
  token: { type: String, required: true, unique: true },
  projectId: { type: String, required: true, index: true },
  inviterId: { type: String, required: true },
  role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
  expiresAt: { type: String, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const MongoInvitationModel: Model<IInvitation> = (mongoose.models.Invitation as Model<IInvitation>) || mongoose.model<IInvitation>('Invitation', InvitationSchema);
const jsonInvitationCollection = new JsonCollection<IInvitation>('invitations');

export const InvitationRepository = {
  async findByToken(token: string): Promise<IInvitation | null> {
    if (isMongoActive()) {
      const doc = await (MongoInvitationModel as any).findOne({ token }).lean();
      return doc ? (doc as unknown as IInvitation) : null;
    }
    return jsonInvitationCollection.findOne({ token });
  },

  async findByProject(projectId: string): Promise<IInvitation[]> {
    if (isMongoActive()) {
      const docs = await (MongoInvitationModel as any).find({ projectId }).lean();
      return docs as unknown as IInvitation[];
    }
    return jsonInvitationCollection.find({ projectId });
  },

  async create(invitation: IInvitation): Promise<IInvitation> {
    if (isMongoActive()) {
      const created = await (MongoInvitationModel as any).create(invitation);
      return created.toObject ? created.toObject() : created;
    }
    return jsonInvitationCollection.create(invitation);
  },

  async markUsed(token: string): Promise<IInvitation | null> {
    if (isMongoActive()) {
      const updated = await (MongoInvitationModel as any).findOneAndUpdate(
        { token },
        { used: true },
        { new: true }
      ).lean();
      return updated ? (updated as unknown as IInvitation) : null;
    }
    const inv = await jsonInvitationCollection.findOne({ token });
    if (!inv) return null;
    return jsonInvitationCollection.findByIdAndUpdate(inv.id, { used: true });
  }
};
