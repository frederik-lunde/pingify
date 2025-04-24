// server/src/routes/monitoringRoutes.ts
import { Router } from 'express';
import * as monitoringController from '../controllers/monitorController'; // Corrected controller import name
import { authenticate } from '../middleware/authMiddleware';
import { handleValidationErrors } from '../middleware/validators/authValidator'; // Reuse this
import {
    getResultsValidationRules,
    getResultsByWebsiteValidationRules,
    triggerWebsiteCheckValidationRules,
    getStatsValidationRules,
    getWebsiteStatsValidationRules,
    getWebsiteDetailsValidationRules,
} from '../middleware/validators/monitorValidator';

const router = Router();

router.use(authenticate);

// --- Admin Routes ---
// Optional: Add isAdmin middleware if needed
router.get(
    '/admin/results',
    getResultsValidationRules(),
    handleValidationErrors,
    monitoringController.getAllResults
);
router.get(
    '/admin/stats',
    getStatsValidationRules(),
    handleValidationErrors,
    monitoringController.getOverallStats
);

// --- User Routes ---
router.get(
    '/user/results',
    getResultsValidationRules(),
    handleValidationErrors,
    monitoringController.getUserResults
);
router.get(
    '/user/stats',
    getStatsValidationRules(),
    handleValidationErrors,
    monitoringController.getUserStats
);

// --- Website-Specific Routes ---
router.get(
    '/website/:websiteId/results',
    getResultsByWebsiteValidationRules(),
    handleValidationErrors,
    monitoringController.getResultsByWebsite
);
router.get(
    '/website/:websiteId/stats',
    getWebsiteStatsValidationRules(),
    handleValidationErrors,
    monitoringController.getWebsiteStats
);
router.get(
    '/website/:websiteId',
    getWebsiteDetailsValidationRules(),
    handleValidationErrors,
    monitoringController.getWebsiteDetails
);

// --- Actions ---
router.post(
    '/check/:websiteId',
    triggerWebsiteCheckValidationRules(),
    handleValidationErrors,
    monitoringController.triggerWebsiteCheck
);

export default router;