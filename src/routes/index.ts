import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/authController';
import { searchUsers, getContacts, addContact, updateProfile, blockUser, unblockUser, getBlockedUsers } from '../controllers/userController';
import { getConversations, createorGetConversation, createGroupConversation } from '../controllers/conversationController';
import { getMessages, sendMessage, deleteMessage } from '../controllers/messageController';
import { protect } from '../middleware/auth';

const router = Router();

// ─── Auth ──────────────────────────────────────────────────────────────────
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', protect, getMe);
router.post('/auth/logout', protect, logout);

// ─── Users ─────────────────────────────────────────────────────────────────
router.get('/users/search', protect, searchUsers);
router.get('/users/contacts', protect, getContacts);
router.post('/users/contacts/:userId', protect, addContact);
router.put('/users/profile', protect, updateProfile);

// ─── Conversations ─────────────────────────────────────────────────────────
router.get('/conversations', protect, getConversations);
router.post('/conversations', protect, createorGetConversation);
router.post('/conversations/group', protect, createGroupConversation);

// ─── Messages ──────────────────────────────────────────────────────────────
router.get('/messages/:conversationId', protect, getMessages);
router.post('/messages', protect, sendMessage);
router.delete('/messages/:messageId', protect, deleteMessage);
// router.post('/messages/:messageId/react', protect, reactToMessage);

router.post('/users/:userId/block', protect, blockUser);
router.post('/users/:userId/unblock', protect, unblockUser);
router.get('/users/blocked', protect, getBlockedUsers);

export default router;
