import { Response } from "express";
import { Conversation } from "../models/Conversation";
import { AuthRequest } from "../types";
import { Types } from "mongoose";


export const createGroupConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, participants } = req.body;
    const currentUserId = req.user!._id;

    if (!name || !participants || participants.length < 2) {
      res.status(400).json({ success: false, message: "Group name and at least 2 participants are required" });
      return;
    }

    const group = await Conversation.create({
      participants: [currentUserId, ...participants],
      isGroup: true,
      groupName: name,
      groupAdmin: currentUserId,
    });

    const populatedGroup = await group.populate("participants", "name avatar isOnline");
    res.status(201).json({ success: true, conversation: populatedGroup });
  } catch (error) {
    console.error("createGroupConversation error:", error);
    res.status(500).json({ success: false, message: "Failed to create group" });
  }
};


export const addUserToGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user!._id;

    if (!groupId || !userId) {
      res.status(400).json({ success: false, message: "Group ID and User ID are required" });
      return;
    }

    const group = await Conversation.findById(groupId);
    if (!group || !group.isGroup) {
      res.status(404).json({ success: false, message: "Group not found" });
      return;
    }

    if (group.groupAdmin?.toString() !== currentUserId.toString()) {
      res.status(403).json({ success: false, message: "Only group admin can add users" });
      return;
    }

    if (group.participants.some(p => p.toString() === userId)) {
      res.status(400).json({ success: false, message: "User already in group" });
      return;
    }

    group.participants.push(new Types.ObjectId(userId));
    await group.save();

    const populatedGroup = await group.populate("participants", "name avatar isOnline");
    res.status(200).json({ success: true, conversation: populatedGroup });
  } catch (error) {
    console.error("addUserToGroup error:", error);
    res.status(500).json({ success: false, message: "Failed to add user to group" });
  }
};


export const removeUserFromGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user!._id;

    if (!groupId || !userId) {
      res.status(400).json({ success: false, message: "Group ID and User ID are required" });
      return;
    }

    const group = await Conversation.findById(groupId);
    if (!group || !group.isGroup) {
      res.status(404).json({ success: false, message: "Group not found" });
      return;
    }

    // Only admin can remove others OR user can remove themselves
    if (group.groupAdmin?.toString() !== currentUserId.toString() && userId !== currentUserId.toString()) {
      res.status(403).json({ success: false, message: "Only admin can remove other users" });
      return;
    }

    if (!group.participants.some(p => p.toString() === userId)) {
      res.status(400).json({ success: false, message: "User is not in the group" });
      return;
    }

    group.participants = group.participants.filter(p => p.toString() !== userId);
    await group.save();

    const populatedGroup = await group.populate("participants", "name avatar isOnline");
    res.status(200).json({ success: true, conversation: populatedGroup });
  } catch (error) {
    console.error("removeUserFromGroup error:", error);
    res.status(500).json({ success: false, message: "Failed to remove user from group" });
  }
};

export const getUserGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!._id;

    const groups = await Conversation.find({ participants: currentUserId, isGroup: true })
      .populate("participants", "name avatar isOnline")
      .populate({ path: "lastMessage", populate: { path: "sender", select: "name" } })
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, groups });
  } catch (error) {
    console.error("getUserGroups error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch groups" });
  }
};