// server/src/routes/websiteRoutes.ts
import { Router } from 'express';
import * as websiteController from '../controllers/websiteController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin routes for managing all websites
router.get('/admin/all', websiteController.getAllWebsites);
router.post('/admin/create', websiteController.createWebsite);
router.put('/admin/:id', websiteController.updateWebsite);
router.delete('/admin/:id', websiteController.deleteWebsite);
router.patch('/admin/:id/toggle', websiteController.toggleWebsiteStatus);

// Core website routes
router.get('/search', websiteController.searchWebsites);
router.get('/:id', websiteController.getWebsiteById);
// User dashboard routes
router.get('/user/dashboard', websiteController.getUserWebsites);
router.get('/user/dashboard/:id', websiteController.getUserWebsiteById);
router.post('/user/dashboard', websiteController.addWebsiteToUser);
router.put('/user/dashboard/:id', websiteController.updateUserWebsite);
router.delete('/user/dashboard/:id', websiteController.removeWebsiteFromUser);

export default router;