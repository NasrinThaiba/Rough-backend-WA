import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  status: string;
  phone: string;
  isOnline: boolean;
  lastSeen: Date;
  contacts: Types.ObjectId[];
  blockedUsers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  text?: string;
  status: 'sent' | 'delivered' | 'read';
  reactions: Array<{ userId: Types.ObjectId; emoji: string }>;
  replyTo?: Types.ObjectId;
  deletedFor: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  groupAdmin?: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: IUser;
}

export interface JwtPayload {
  userId: string;
  phone: string;
}

export interface SocketUser {
  userId: string;
  socketId: string;
}

// Socket event payloads
export interface SendMessagePayload {
  conversationId: string;
  text?: string;
  replyTo?: string;
}

export interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
}

export interface MessageStatusPayload {
  messageId: string;
  status: 'delivered' | 'read';
}
