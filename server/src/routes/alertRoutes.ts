// server/src/routes/alertRoutes.ts
import { Router } from "express";
import * as alertController from "../controllers/alertController";
import { authenticate } from "../middleware/authMiddleware";
import { handleValidationErrors } from "../middleware/validators/authValidator"; // Reuse this
import {
  getUserAlertsValidationRules,
  dismissAlertValidationRules,
  getAlertsByWebsiteValidationRules,
  getUserAlertStatsValidationRules,
} from "../middleware/validators/alertValidator";

const router = Router();

router.use(authenticate);

// --- User Specific Routes ---
router.get(
  "/user",
  getUserAlertsValidationRules(),
  handleValidationErrors,
  alertController.getUserAlerts,
);
router.get(
  "/user/stats",
  getUserAlertStatsValidationRules(),
  handleValidationErrors,
  alertController.getUserAlertStats,
);

// --- User Actions ---
router.delete(
  "/:alertId",
  dismissAlertValidationRules(),
  handleValidationErrors,
  alertController.dismissAlert,
);

// --- Website Specific Routes ---
router.get(
  "/website/:websiteId",
  getAlertsByWebsiteValidationRules(),
  handleValidationErrors,
  alertController.getAlertsByWebsite,
);

export default router;
