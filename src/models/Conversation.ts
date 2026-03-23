import mongoose, { Schema, model } from 'mongoose';
import { IConversation } from '../types';

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
    },
    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding conversations between users
ConversationSchema.index({ participants: 1 });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
