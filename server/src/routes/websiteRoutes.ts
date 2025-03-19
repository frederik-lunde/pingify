import { Router } from 'express';
import * as websiteController from '../controllers/websiteController';

const router = Router();

// Get all websites
router.get('/', websiteController.getAllWebsites);

// Get a specific website
router.get('/:id', websiteController.getWebsiteById);

// Create a new website
router.post('/', websiteController.createWebsite);

// Update a website
router.put('/:id', websiteController.updateWebsite);

// Delete a website
router.delete('/:id', websiteController.deleteWebsite);

// Toggle a website's active status
router.patch('/:id/toggle', websiteController.toggleWebsiteStatus);

// Get monitoring results for a website
router.get('/:id/results', websiteController.getMonitoringResults);

export default router;