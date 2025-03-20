// server/src/routes/websiteRoutes.ts
import { Router } from 'express';
import * as websiteController from '../controllers/websiteController';

const router = Router();

// General website routes
router.get('/', websiteController.getAllWebsites);
router.get('/:id', websiteController.getWebsiteById);
router.post('/', websiteController.createWebsite);
router.put('/:id', websiteController.updateWebsite);
router.delete('/:id', websiteController.deleteWebsite);

// Toggle website status
router.patch('/:id/toggle', websiteController.toggleWebsiteStatus);

// Get monitoring results
router.get('/:id/results', websiteController.getMonitoringResults);

// User dashboard routes
router.get('/user/dashboard', websiteController.getUserWebsites);
router.get('/user/dashboard/:id', websiteController.getUserWebsiteById);
router.post('/user/dashboard', websiteController.addWebsiteToUser);
router.delete('/user/dashboard/:id', websiteController.removeWebsiteFromUser);

export default router;