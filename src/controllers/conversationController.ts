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
        res.status(500).json({ success : false, message : "Failed to create conversation"})
    }
}

export const createGroupConversation = async (req : AuthRequest, res: Response) : Promise<void> => {
    try {
        const { name, participants } = req.body;
        const userId = req.user!._id;

        if(!name || !participants || participants.length < 2) {
            res.status(400).json({ success : false, message : "Group name and participants required"})
            return;
        }

        const group =  await Conversation.create({
            participants : [userId, ...participants],
            isGroup : true,
            groupName : name,
            groupAdmin : userId,
        })

        const populatedGroup = await group.populate("participants", "name avatar isOnline");
        res.status(201).json({ success: true, conversation: populatedGroup });

    }catch (error) {
    res.status(500).json({ success: false, message: "Failed to create group" });
  }
}