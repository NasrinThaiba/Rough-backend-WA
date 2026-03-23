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

  io.use(async (socket: CustomSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: CustomSocket) => {
    const user = socket.user!;
    const userId = user._id.toString();

    console.log(`Connected: ${user.name}`);

   
    // ONLINE USERS
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    socket.join(userId);

    const contacts = await User.findById(userId).select('contacts'); // id
    const contactIds = contacts?.contacts.map((c) => c.toString()) ?? []; //convert to string

    contactIds.forEach((id) => {
      io.to(id).emit('user:online', { userId, isOnline: true });
    });

    socket.emit('users:online', getOnlineUserIds()); //newly loggin user

   
    // JOIN / LEAVE CONVERSATION
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
      //frontend emit(enter into conversation room) backend receives it and join in room 
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

   
    // SEND MESSAGE
    socket.on('message:send', async (payload: SendMessagePayload) => {
      try {
        if (!payload.conversationId) {
          return socket.emit('error', { message: 'Invalid payload' });
        }

        const { conversationId, text, replyTo } = payload;

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });

        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          text,
          replyTo,
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        const populated = await message.populate('sender', 'name avatar');

        io.to(`conv:${conversationId}`).emit('message:new', populated);

      } catch (err) {
        console.error('message:send error:', err);
      }
    });

    // ─────────────────────────────
    // SEND FILE
    // ─────────────────────────────
    // socket.on('message:send_file', async (payload) => {
    //   try {
    //     const { conversationId, fileData, mimeType, filename, mediaType } = payload;

    //     if (!conversationId || !fileData) return;

    //     const dataUrl = `data:${mimeType};base64,${fileData}`;

    //     const message = await Message.create({
    //       conversation: conversationId,
    //       sender: userId,
    //       text: filename,
    //       mediaUrl: dataUrl,
    //       mediaType,
    //     });

    //     await Conversation.findByIdAndUpdate(conversationId, {
    //       lastMessage: message._id,
    //       updatedAt: new Date(),
    //     });

    //     const populated = await message.populate('sender', 'name avatar');

    //     io.to(`conv:${conversationId}`).emit('message:new', populated);

    //   } catch (err) {
    //     console.error('file error:', err);
    //   }
    // });

    // // ─────────────────────────────
    // // SEND VOICE
    // // ─────────────────────────────
    // socket.on('message:send_voice', async (payload) => {
    //   try {
    //     const { conversationId, audioData, mimeType, duration } = payload;

    //     if (!conversationId || !audioData) return;

    //     const dataUrl = `data:${mimeType};base64,${audioData}`;

    //     const message = await Message.create({
    //       conversation: conversationId,
    //       sender: userId,
    //       text: `🎤 Voice (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')})`,
    //       mediaUrl: dataUrl,
    //       mediaType: 'audio',
    //     });

    //     await Conversation.findByIdAndUpdate(conversationId, {
    //       lastMessage: message._id,
    //       updatedAt: new Date(),
    //     });

    //     const populated = await message.populate('sender', 'name avatar');

    //     io.to(`conv:${conversationId}`).emit('message:new', populated);

    //   } catch (err) {
    //     console.error('voice error:', err);
    //   }
    // });

    // ─────────────────────────────
    // TYPING
    // ─────────────────────────────
    socket.on('typing:start', (payload: TypingPayload) => {
      socket.to(`conv:${payload.conversationId}`).emit('typing:start', {
        userId,
        userName: user.name,
      });
    });

    socket.on('typing:stop', (payload: TypingPayload) => {
      socket.to(`conv:${payload.conversationId}`).emit('typing:stop', {
        userId,
      });
    });

    // ─────────────────────────────
    // READ RECEIPTS
    // ─────────────────────────────
    socket.on('message:read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversation: conversationId, sender: { $ne: userId } },
          { status: 'read' }
        );

        io.to(`conv:${conversationId}`).emit('message:read', {
          readBy: userId,
        });

      } catch (err) {
        console.error('read error:', err);
      }
    });

    // ─────────────────────────────
    // REACTIONS
    // ─────────────────────────────
    socket.on('message:react', async ({ messageId, emoji, conversationId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          $push: { reactions: { userId, emoji } },
        });

        socket.to(`conv:${conversationId}`).emit('message:reacted', {
          messageId,
          emoji,
          userId,
        });

      } catch (err) {
        console.error('reaction error:', err);
      }
    });

    // ─────────────────────────────
    // DELETE MESSAGE
    // ─────────────────────────────
    socket.on('message:delete', async ({ messageId, conversationId }) => {
      try {
        await Message.findByIdAndDelete(messageId);

        io.to(`conv:${conversationId}`).emit('message:deleted', { messageId });

      } catch (err) {
        console.error('delete error:', err);
      }
    });

    // ─────────────────────────────
    // CALL EVENTS (WebRTC signaling)
    // ─────────────────────────────
    // socket.on('call:offer', ({ to, offer, fromName }) => {
    //   io.to(to).emit('call:incoming', {
    //     from: userId,
    //     fromName,
    //     offer,
    //   });
    // });

    // socket.on('call:answer', ({ to, answer }) => {
    //   io.to(to).emit('call:answered', { answer });
    // });

    // socket.on('call:ice_candidate', ({ to, candidate }) => {
    //   io.to(to).emit('call:ice_candidate', { candidate });
    // });

    // socket.on('call:end', ({ to }) => {
    //   io.to(to).emit('call:ended');
    // });

    // ─────────────────────────────
    // DISCONNECT
    // ─────────────────────────────
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
        }
      }

      console.log(`🔴 Disconnected: ${user.name}`);
    });

  });
};