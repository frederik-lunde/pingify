// server/src/routes/incidentRoutes.ts
import { Router } from 'express';
import * as incidentController from '../controllers/incidentController';
import { authenticate } from '../middleware/authMiddleware';
import { handleValidationErrors } from '../middleware/validators/authValidator'; // Reuse this
import {
    getUserIncidentsValidationRules,
    getWebsiteIncidentsValidationRules,
} from '../middleware/validators/incidentValidator';

const router = Router();

router.use(authenticate);

router.get(
    '/user',
    getUserIncidentsValidationRules(),
    handleValidationErrors,
    incidentController.getUserIncidents
);

router.get(
    '/website/:websiteId',
    getWebsiteIncidentsValidationRules(),
    handleValidationErrors,
    incidentController.getWebsiteIncidents
);

// No validation needed here beyond auth
router.get('/user/count/last24h', incidentController.getUserIncidentCountLast24h);

export default router;