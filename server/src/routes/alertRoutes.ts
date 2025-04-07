// server/src/routes/alertRoutes.ts
import { Router } from 'express';
import * as alertController from '../controllers/alertController'; // Ensure controller filename is correct
import { authenticate } from '../middleware/authMiddleware'; // Ensure path is correct

const router = Router();

// Apply authentication middleware to all alert routes
router.use(authenticate);

// --- User Specific Routes ---
// GET active alerts for the logged-in user (can filter by websiteId in query)
router.get('/user', alertController.getUserAlerts);
// GET active alert statistics for the logged-in user
router.get('/user/stats', alertController.getUserAlertStats);

// --- User Actions ---
// DELETE (dismiss) a specific alert owned by the user
router.delete('/:alertId', alertController.dismissAlert);

// --- Website Specific Routes (Requires Auth + Access Check in Controller) ---
// GET active alerts associated with a specific website (user must have access)
router.get('/website/:websiteId', alertController.getAlertsByWebsite);

// --- Admin Routes (Optional - Add back if needed with admin role checks) ---
// Example: router.get('/admin/all', ensureAdmin, alertController.getAdminAllAlerts);
// Example: router.get('/admin/stats', ensureAdmin, alertController.getAdminAlertStats);

export default router;