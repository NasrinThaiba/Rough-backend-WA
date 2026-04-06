import { Response } from 'express';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { AuthRequest } from '../types';
import { User } from '../models/User';

//  GET MESSAGES 
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user!._id });

    if (!conversation) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const messages = await Message.find({ conversation: conversationId, deletedFor: { $ne: req.user!._id } })
      .populate('sender', 'name avatar')
      .populate('replyTo', 'text sender')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversation: conversationId, deletedFor: { $ne: req.user!._id } });

    res.status(200).json({ success: true, messages: messages.reverse(),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });

  } catch(error) {
    console.error('getMessages error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, text, replyTo } = req.body;
    const senderId = req.user!._id;

    if (!conversationId || !text) {
      res.status(400).json({ success: false, message: 'Text message required.' });
      return;
    }

    const conversation = await Conversation.findOne({_id: conversationId, participants: senderId});
    if (!conversation) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const receiverId = conversation.participants.find(
      (id: any) => id.toString() !== senderId.toString()
    );
    const receiver = await User.findById(receiverId);

    if (!receiver) {
      res.status(404).json({ success: false, message: 'Receiver not found' });
      return;
    }

    if (receiver.blockedUsers.includes(senderId)) {
      res.status(403).json({ success: false, message: "You are blocked by this user"});
      return;
    }

   //create message
    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      text,
      status : 'sent',
    });

    //Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    const populated = await message.populate('sender', 'name avatar');

    res.status(201).json({
      success: true,
      message: populated,
    });

  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ==================== DELETE MESSAGE ====================
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { deleteFor } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ success: false, message: 'Message not found.' });
      return;
    }

    const isSender = message.sender.toString() === req.user!._id.toString();

    if (deleteFor === 'everyone' && isSender) {
      await Message.findByIdAndDelete(messageId);
    } else {
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: req.user!._id },
      });
    }

    res.status(200).json({ success: true, message: 'Message deleted.' });

  } catch(error){
    console.error('deletemsg error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


