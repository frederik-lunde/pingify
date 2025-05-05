// server/src/routes/websiteRoutes.ts
import { Router } from 'express';
import * as websiteController from '../controllers/websiteController';
import { authenticate } from '../middleware/authMiddleware';
import { handleValidationErrors } from '../middleware/validators/authValidator'; // Reuse this
import {
    getWebsiteByIdValidationRules,
    createWebsiteValidationRules,
    updateWebsiteValidationRules,
    updateUserWebsiteValidationRules,
    setPinStatusValidationRules,
    deleteWebsiteValidationRules,
    toggleWebsiteStatusValidationRules,
    addWebsiteToUserValidationRules,
    searchWebsitesValidationRules,
} from '../middleware/validators/websiteValidator';


const router = Router();

router.use(authenticate);

// --- Admin Routes ---
// Optional: Add isAdmin middleware if needed
router.get('/admin/all', websiteController.getAllWebsites); // No input validation

router.post(
    '/admin/create',
    createWebsiteValidationRules(),
    handleValidationErrors,
    websiteController.createWebsite
);

router.put(
    '/admin/:id',
    updateWebsiteValidationRules(),
    handleValidationErrors,
    websiteController.updateWebsite
);

router.delete(
    '/admin/:id',
    deleteWebsiteValidationRules(), // Only validates ID param
    handleValidationErrors,
    websiteController.deleteWebsite
);

router.patch(
    '/admin/:id/toggle',
    toggleWebsiteStatusValidationRules(), // Only validates ID param
    handleValidationErrors,
    websiteController.toggleWebsiteStatus
);

// --- Core website routes ---
router.get(
    '/search',
    searchWebsitesValidationRules(),
    handleValidationErrors,
    websiteController.searchWebsites
);

router.get(
    '/:id',
    getWebsiteByIdValidationRules(), // Only validates ID param
    handleValidationErrors,
    websiteController.getWebsiteById
);

// --- User dashboard routes ---
router.get('/user/dashboard', websiteController.getUserWebsites); // No input validation

router.get(
    '/user/dashboard/:id',
    getWebsiteByIdValidationRules(), // Only validates ID param
    handleValidationErrors,
    websiteController.getUserWebsiteById
);

router.post(
    '/user/dashboard',
    addWebsiteToUserValidationRules(),
    handleValidationErrors,
    websiteController.addWebsiteToUser
);

router.put(
    '/user/dashboard/:id',
    updateUserWebsiteValidationRules(),
    handleValidationErrors,
    websiteController.updateUserWebsite
);

router.delete(
    '/user/dashboard/:id',
    deleteWebsiteValidationRules(), // Only validates ID param
    handleValidationErrors,
    websiteController.removeWebsiteFromUser
);

router.patch(
    '/user/dashboard/:id/pin',
    setPinStatusValidationRules(),
    handleValidationErrors,
    websiteController.setPinStatus
);

export default router;