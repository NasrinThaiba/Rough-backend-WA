import { Response } from "express"
import {Conversation} from "../models/Conversation"
import { AuthRequest } from "../types"
import { Types } from "mongoose"


export const getConversations = async (req : AuthRequest, res : Response) : Promise<void> => {
   try {
    const userId = req.user!._id;

    const conversations = await Conversation.find({ participants : userId})
       .populate("participants", "name avatar isOnline")
       .populate({path : "lastMessage", populate : {path : "sender", select : "name"}})
       .sort({updatedAt : -1})

    res.json({ success: true, conversations });

   }catch (error) {
    console.error('getConversations error:', error);
    res.status(500).json({success: false, message: "Failed to fetch conversations" });
  }
}

export const createorGetConversation = async (req : AuthRequest, res : Response) : Promise<void> => {
    try {
        const {participantId} = req.body;
        const userId = req.user!._id;

    if(!participantId) {
        res.status(400).json({success : false, message : "Participant Id is required"})
        return;
    }
    
    let conversation = await Conversation.findOne({
        isGroup : false,
        participants : {
            $all : [userId, new Types.ObjectId(participantId)],
            $size : 2
        }
    })
    
    if(!conversation) {
        conversation = await Conversation.create({
            participants : [userId, participantId],
            isGroup : false
        })
    }
    
    const populatedConversation = await conversation.populate("participants", "name avatar isOnline");
    res.json({success : true, conversation : populatedConversation})

    } catch (error) {
        console.error('createConversation error:', error);
        res.status(500).json({ success : false, message : "Failed to create conversation"})
    }
}


export const deleteConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { conversationId } = req.params;

    if (!conversationId) {
      res.status(400).json({ success: false, message: "Conversation ID is required" });
      return;
    }

    // Check if conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ success: false, message: "Conversation not found" });
      return;
    }

    // Optional: only allow participants to delete
    if (!conversation.participants.includes(userId)) {
      res.status(403).json({ success: false, message: "Not authorized to delete this conversation" });
      return;
    }

    await Conversation.findByIdAndDelete(conversationId);
    res.status(200).json({ success: true, message: "Conversation deleted" });
    
  } catch (error) {
    console.error('deleteConversation error:', error);
    res.status(500).json({ success: false, message: "Failed to delete conversation" });
  }
};


