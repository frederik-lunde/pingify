// server/src/routes/websiteRoutes.ts
import { Router } from 'express';
import * as websiteController from '../controllers/websiteController';
import { authenticate } from '../middleware/authMiddleware';
// Import admin check middleware if you have one, e.g., isAdmin
// import { isAdmin } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin routes for managing all websites
// Optional: Add isAdmin middleware if needed for admin routes
// Example: router.get('/admin/all', isAdmin, websiteController.getAllWebsites);
router.get('/admin/all', websiteController.getAllWebsites);
router.post('/admin/create', websiteController.createWebsite);
router.put('/admin/:id', websiteController.updateWebsite);
router.delete('/admin/:id', websiteController.deleteWebsite);
router.patch('/admin/:id/toggle', websiteController.toggleWebsiteStatus);

// Core website routes
router.get('/search', websiteController.searchWebsites); // Access controlled by `authenticate`
router.get('/:id', websiteController.getWebsiteById); // Access controlled by `authenticate`

// User dashboard routes (implicitly user-specific due to logic in controllers using req.user.id)
router.get('/user/dashboard', websiteController.getUserWebsites);
router.get('/user/dashboard/:id', websiteController.getUserWebsiteById);
router.post('/user/dashboard', websiteController.addWebsiteToUser);
router.put('/user/dashboard/:id', websiteController.updateUserWebsite);
router.delete('/user/dashboard/:id', websiteController.removeWebsiteFromUser);

// New route for pinning/unpinning a website for the user
router.patch('/user/dashboard/:id/pin', websiteController.setPinStatus); // Sets the isPinned status

export default router;
