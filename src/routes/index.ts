import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/authController';
import { searchUsers, getContacts, addContact, updateProfile, blockUser, unblockUser, getBlockedUsers } from '../controllers/userController';
import { getConversations, createorGetConversation, deleteConversation } from '../controllers/conversationController';
import { getMessages, sendMessage, deleteMessage } from '../controllers/messageController';
import { createGroupConversation, addUserToGroup, removeUserFromGroup, getUserGroups } from '../controllers/groupController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', protect, getMe);
router.post('/auth/logout', protect, logout);

router.get('/users/search', protect, searchUsers);
router.get('/users/contacts', protect, getContacts);
router.post('/users/contacts/:userId', protect, addContact);
router.put('/users/profile', protect, updateProfile);

router.get('/conversations', protect, getConversations);
router.post('/conversations', protect, createorGetConversation);
router.delete('/:conversationId', protect, deleteConversation);

router.get('/messages/:conversationId', protect, getMessages);
router.post('/messages', protect, sendMessage);
router.delete('/messages/:messageId', protect, deleteMessage);

router.post('/users/block/:userId', protect, blockUser);
router.post('/users/unblock/:userId', protect, unblockUser);
router.get('/users/blocked', protect, getBlockedUsers);

router.post('/conversations/group', protect, createGroupConversation);
router.put("/groups/:groupId/add", protect, addUserToGroup);
router.put("/groups/:groupId/remove", protect, removeUserFromGroup);
router.get("/conversations/group", protect, getUserGroups);


export default router;
