import { Router } from 'express';
import * as monitoringController from '../controllers/monitorController';

const router = Router();

// Get monitoring results with optional filtering
router.get('/results', monitoringController.getAllResults);

// Get results for a specific website
router.get('/website/:websiteId/results', monitoringController.getResultsByWebsite);

// Trigger an immediate check for a website
router.post('/check/:websiteId', monitoringController.triggerWebsiteCheck);

// Get performance statistics
router.get('/stats', monitoringController.getMonitoringStats);

export default router;