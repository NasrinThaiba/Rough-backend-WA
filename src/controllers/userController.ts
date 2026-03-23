import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../types';


// ─────────────────────────────────────────────
// GET /api/users/search?q=name
// ─────────────────────────────────────────────
export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length < 1) {
      res.status(400).json({ success: false, message: 'Search query required.' });
      return;
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user!._id } },
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { phone : { $regex: query, $options: 'i'} },
          ],
        },
      ],
    })
      .select('name email phone avatar status isOnline lastSeen')
      .limit(20);

    res.status(200).json({ success: true, users });

  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ─────────────────────────────────────────────
// GET /api/users/contacts
// ─────────────────────────────────────────────
export const getContacts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const user = await User.findById(req.user!._id).populate(
      'contacts',
      'name email phone avatar status isOnline lastSeen'
    );

    res.status(200).json({ success: true, contacts: user?.contacts ?? [] });

  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ─────────────────────────────────────────────
// POST /api/users/contacts/:userId
// ─────────────────────────────────────────────
export const addContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const { userId } = req.params;
    const currentUser = req.user!;

    if (userId === currentUser._id.toString()) {
      res.status(400).json({
        success: false,
        message: 'Cannot add yourself.',
      });
      return;
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    if (currentUser.contacts.includes(targetUser._id)) {
      res.status(409).json({
        success: false,
        message: 'Contact already added.',
      });
      return;
    }

    await User.findByIdAndUpdate(currentUser._id, {
      $addToSet: { contacts: userId },
    });

    res.status(200).json({
      success: true,
      message: 'Contact added.',
    });

  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ─────────────────────────────────────────────
// PUT /api/users/profile
// ─────────────────────────────────────────────
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const { name, status, phone, avatar } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      { name, status, phone, avatar },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      user: updatedUser,
    });

  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ─────────────────────────────────────────────
// POST /api/users/:userId/block
// ─────────────────────────────────────────────
export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const { userId } = req.params;
    const currentUserId = req.user!._id;

    if (userId === currentUserId.toString()) {
      res.status(400).json({
        success: false,
        message: 'Cannot block yourself.',
      });
      return;
    }

    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { blockedUsers: userId },
    });

    res.status(200).json({
      success: true,
      message: 'User blocked.',
    });

  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ─────────────────────────────────────────────
// POST /api/users/:userId/unblock
// ─────────────────────────────────────────────
export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const { userId } = req.params;
    const currentUserId = req.user!._id;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { blockedUsers: userId },
    });

    res.status(200).json({
      success: true,
      message: 'User unblocked.',
    });

  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ─────────────────────────────────────────────
// GET /api/users/blocked
// ─────────────────────────────────────────────
export const getBlockedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const user = await User.findById(req.user!._id).populate(
      'blockedUsers',
      'name email avatar'
    );

    res.status(200).json({
      success: true,
      blockedUsers: user?.blockedUsers ?? [],
    });

  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};