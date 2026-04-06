import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { JwtPayload, SendMessagePayload, TypingPayload } from '../types';

// Track online users (multi-device)
const onlineUsers = new Map<string, Set<string>>();

const getOnlineUserIds = (): string[] => Array.from(onlineUsers.keys());

interface CustomSocket extends Socket {
  user?: any;
}

export const initSocket = (io: Server): void => {

  // AUTH
  io.use(async (socket: CustomSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();

    } catch (error) {
      console.error('initSocket error:', error);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: CustomSocket) => {
    const user = socket.user!;
    const userId = user._id.toString();

    console.log(`Connected: ${user.name}`);

   
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    socket.join(userId);

  

    const userConversations = await Conversation.find({
      participants: userId,
    }).distinct('_id');

    const undeliveredMessages = await Message.find({
      conversation: { $in: userConversations },
      sender: { $ne: userId },
      status: 'sent',
    }).select('_id sender');

    await Message.updateMany(
      {
        conversation: { $in: userConversations },
        sender: { $ne: userId },
        status: 'sent',
      },
      { status: 'delivered' }
    );

    undeliveredMessages.forEach((msg) => {
      io.to(msg.sender.toString()).emit('message:status:update', {
        messageId: msg._id,
        status: 'delivered',
      });
    });

    const contacts = await User.findById(userId).select('contacts');
    const contactIds = contacts?.contacts.map((c) => c.toString()) ?? [];


    contactIds.forEach((id) => {
      io.to(id).emit('user:online', {userId, isOnline: true });
    });

    socket.emit('users:online', getOnlineUserIds());

    
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

  
    socket.on('message:send', async (payload: SendMessagePayload) => {
      try {
        const { conversationId, text, replyTo } = payload;

        const conversation = await Conversation.findOne({_id: conversationId,participants: userId});

        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }

        const receiverId = conversation.participants.find(
          (id: any) => id.toString() !== userId
        )?.toString();

        let isReceiverOnline = false;

        if (receiverId) {
          const receiverSockets = onlineUsers.get(receiverId);
          isReceiverOnline = receiverSockets ? receiverSockets.size > 0 : false;
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          text,
          status: isReceiverOnline ? 'delivered' : 'sent',
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        const populated = await message.populate('sender', 'name avatar');

        io.to(`conv:${conversationId}`).emit('message:new', populated);

        if (isReceiverOnline) {
          io.to(userId).emit('message:status:update', {
            messageId: message._id,
            status: 'delivered',
          });
        }

      } catch (error) {
        console.error('message:send error:', error);
      }
    });

    socket.on('typing:start', (payload: TypingPayload) => {
      socket.to(`conv:${payload.conversationId}`).emit('typing:start', {
        userId,
        userName: user.name,
        conversationId: payload.conversationId,
      });
    });

    socket.on('typing:stop', (payload: TypingPayload) => {
      socket.to(`conv:${payload.conversationId}`).emit('typing:stop', {
        userId,
        conversationId: payload.conversationId,
      });
    });

    socket.on('message:read', async ({ conversationId }) => {
      try {
        const messages = await Message.find({
        conversation: conversationId,
        sender: { $ne: userId },
        }).select('_id');

      await Message.updateMany(
        { conversation: conversationId, sender: { $ne: userId } },
        { status: 'read' }
      );

      messages.forEach((msg) => {
        io.to(`conv:${conversationId}`).emit('message:status:update', {
        messageId: msg._id,
        status: 'read',
        });
      });

     } catch (err) {
    console.error('read error:', err);
    }
  });

  
    socket.on('message:delete', async ({ messageId, conversationId }) => {
      try {
        await Message.findByIdAndDelete(messageId);

        io.to(`conv:${conversationId}`).emit('message:deleted', { messageId });

      } catch (err) {
        console.error('delete error:', err);
      }
    });

  
    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);

      if (sockets) {
        sockets.delete(socket.id);

        if (sockets.size === 0) {
          onlineUsers.delete(userId);

          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          // 🔥 Notify contacts user is offline
          const contacts = await User.findById(userId).select('contacts');
          const contactIds = contacts?.contacts.map((c) => c.toString()) ?? [];

          contactIds.forEach((id) => {
            io.to(id).emit('user:online', {
              userId,
              isOnline: false,
            });
          });
        }
      }

      console.log(`Disconnected: ${user.name}`);
    });

  });
};