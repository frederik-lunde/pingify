// server/src/routes/websiteRoutes.ts
import { Router } from 'express';
import * as websiteController from '../controllers/websiteController';

const websiteRouter: Router = Router();

// Get all websites for a given user
websiteRouter.get('/:userId', websiteController.getWebsitesForUser);

// Create a new website to monitor
websiteRouter.post('/', websiteController.createWebsite);

// New: Get monitoring results for a specific website
websiteRouter.get('/:websiteId/results', websiteController.getMonitoringResultsForWebsite);

export default websiteRouter;
