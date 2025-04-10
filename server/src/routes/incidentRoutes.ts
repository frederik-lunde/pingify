// server/src/routes/incidentRoutes.ts
import { Router } from 'express';
import * as incidentController from '../controllers/incidentController';
import { authenticate } from '../middleware/authMiddleware'; // Ensure path is correct

const router = Router();

// Apply authentication middleware to all incident routes
router.use(authenticate);

// Get incidents for the authenticated user's monitored websites
router.get('/user', incidentController.getUserIncidents);

// Get incidents for a specific website (access check performed in controller)
router.get('/website/:websiteId', incidentController.getWebsiteIncidents);

// Get the count of incidents started in the last 24 hours for the user
router.get('/user/count/last24h', incidentController.getUserIncidentCountLast24h);

export default router;