import mongoose, { Schema, model } from 'mongoose';
import { IMessage } from '../types';

const MessageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    // mediaUrl: {
    //   type: String,
    // },
    // mediaType: {
    //   type: String,
    //   enum: ['image', 'video', 'audio', 'document'],
    // },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String },
      },
    ],
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for fast message retrieval
MessageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = model<IMessage>('Message', MessageSchema);
