import { Router } from 'express';
import * as alertController from '../controllers/alertController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication to all alert routes
router.use(authenticate);

// --- Admin Routes (Optional: Add admin role check middleware if needed) ---
router.get('/admin/all', alertController.getRecentAlerts); // Get all alerts system-wide
router.get('/admin/stats', alertController.getAlertStats); // Get system-wide stats

// --- Website Specific (Needs Auth + Ownership/Access Check) ---
// This route was missing but is useful, controller already exists
router.get('/website/:websiteId', alertController.getAlertsByWebsite);

// --- User Specific Routes ---
router.get('/user', alertController.getUserAlerts); // Get alerts linked to the user
router.get('/user/unread', alertController.getUserUnreadAlerts); // Get unread AlertUser links
router.get('/user/stats', alertController.getUserAlertStats); // Get user-specific stats

// User Actions
router.post('/user/read/:alertId', alertController.markAlertAsRead); // Mark one as read
router.post('/user/read-all', alertController.markAllAlertsAsRead); // Mark all as read
router.delete('/user/:alertId', alertController.deleteAlertForUser); // NEW: Dismiss alert for user

export default router;