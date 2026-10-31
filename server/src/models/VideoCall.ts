import mongoose, { Schema, Model } from 'mongoose';
import { isMongoActive } from '../db/connection.js';
import { JsonCollection } from '../db/store.js';

export type CallStatus = 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';

export interface IVideoCall {
  id: string;
  callId: string;
  callerId: string;
  receiverId: string;
  workspaceId: string;
  status: CallStatus;
  startedAt: string;
  endedAt?: string | null;
  metadata?: {
    callerName?: string;
    receiverName?: string;
    durationSeconds?: number;
  };
  createdAt: string;
  updatedAt: string;
}

const VideoCallSchema = new Schema<IVideoCall>({
  id: { type: String, required: true, unique: true },
  callId: { type: String, required: true, index: true },
  callerId: { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['ringing', 'connected', 'ended', 'rejected', 'missed'],
    default: 'ringing',
  },
  startedAt: { type: String, default: () => new Date().toISOString() },
  endedAt: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const MongoVideoCallModel: Model<IVideoCall> =
  (mongoose.models.VideoCall as Model<IVideoCall>) ||
  mongoose.model<IVideoCall>('VideoCall', VideoCallSchema);

const jsonVideoCallCollection = new JsonCollection<IVideoCall>('video_calls');

export const VideoCallRepository = {
  async create(call: IVideoCall): Promise<IVideoCall> {
    if (isMongoActive()) {
      const created = await (MongoVideoCallModel as any).create(call);
      return created.toObject ? created.toObject() : created;
    }
    return jsonVideoCallCollection.create(call);
  },

  async findById(id: string): Promise<IVideoCall | null> {
    if (isMongoActive()) {
      const doc = await (MongoVideoCallModel as any).findOne({ id }).lean();
      return doc ? (doc as unknown as IVideoCall) : null;
    }
    return jsonVideoCallCollection.findById(id);
  },

  async findByCallId(callId: string): Promise<IVideoCall | null> {
    if (isMongoActive()) {
      const doc = await (MongoVideoCallModel as any).findOne({ callId }).lean();
      return doc ? (doc as unknown as IVideoCall) : null;
    }
    return jsonVideoCallCollection.findOne({ callId });
  },

  async updateStatus(
    callId: string,
    status: CallStatus,
    endedAt?: string,
    metadata?: any
  ): Promise<IVideoCall | null> {
    const updateData: Partial<IVideoCall> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (endedAt) updateData.endedAt = endedAt;
    if (metadata) updateData.metadata = metadata;

    if (isMongoActive()) {
      const updated = await (MongoVideoCallModel as any)
        .findOneAndUpdate({ callId }, updateData, { new: true })
        .lean();
      return updated ? (updated as unknown as IVideoCall) : null;
    }

    const existing = await this.findByCallId(callId);
    if (!existing) return null;
    return jsonVideoCallCollection.findByIdAndUpdate(existing.id, updateData);
  },

  async findByWorkspace(workspaceId: string): Promise<IVideoCall[]> {
    if (isMongoActive()) {
      const docs = await (MongoVideoCallModel as any)
        .find({ workspaceId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return docs as unknown as IVideoCall[];
    }
    const all = await jsonVideoCallCollection.find({ workspaceId });
    return all.reverse().slice(0, 50);
  },
};
