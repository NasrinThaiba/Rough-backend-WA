import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../types';

// GET /api/users/search?q=name
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
            { phone : { $regex: query, $options: 'i'} },
          ],
        },
      ],
    })
      .select('name email phone avatar status isOnline lastSeen')
      .limit(20);

    res.status(200).json({ success: true, users });

  } catch(error) {
    console.error('searchquery error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// GET /api/users/contacts
export const getContacts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const user = await User.findById(req.user!._id).populate(
      'contacts',
      'name email phone avatar status isOnline lastSeen'
    );

    res.status(200).json({ success: true, contacts: user?.contacts ?? [] });

  } catch (error) {
    console.error('getContacts error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// POST /api/users/contacts/:userId
export const addContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUser = req.user!;

    if (userId === currentUser._id.toString()) {
      res.status(400).json({ success: false, message: 'Cannot add yourself.' });
      return;
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found.'});
      return;
    }

    if (currentUser.contacts.includes(targetUser._id)) {
      res.status(409).json({ success: false, message: 'Contact already added.'});
      return;
    }

    await User.findByIdAndUpdate(currentUser._id, {
      $addToSet: { contacts: userId },
    });

    res.status(200).json({ success: true, message: 'Contact added.' });

  } catch(error){
    console.error('addContact error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/users/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const { name, status, phone, avatar } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      { name, status, phone, avatar },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true,  user: updatedUser});

  } catch (error) {
    console.error('profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!._id;

    if (userId === currentUserId.toString()) {
      res.status(400).json({success: false, message: 'Cannot block yourself.'});
      return;
    }

    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { blockedUsers: userId },
    });

    const blockedUser = await User.findById(userId).select('name email avatar');

    res.status(200).json({ success: true, user: blockedUser, message: 'User blocked.'});

  } catch (error) {
    console.error('blockUser:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!._id;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { blockedUsers: userId },
    });

    res.status(200).json({ success: true, message: 'User unblocked.'});

  } catch (error) {
    console.error('unblock error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


export const getBlockedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const user = await User.findById(req.user!._id).populate(
      'blockedUsers',
      'name phone email avatar'
    );

    res.status(200).json({ success: true, blockedUsers: user?.blockedUsers ?? []});

  } catch (error){
    console.error('getblockuser error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};