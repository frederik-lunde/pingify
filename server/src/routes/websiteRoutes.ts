import { Router } from "express";
import * as websiteController from "../controllers/websiteController";
import { authenticate } from "../middleware/authMiddleware";
import { handleValidationErrors } from "../middleware/validators/authValidator";
import {
  getWebsiteByIdValidationRules,
  updateUserWebsiteValidationRules,
  setPinStatusValidationRules,
  deleteWebsiteValidationRules,
  addWebsiteToUserValidationRules,
  searchWebsitesValidationRules,
} from "../middleware/validators/websiteValidator";

const router = Router();

router.use(authenticate);

router.get(
  "/search",
  searchWebsitesValidationRules(),
  handleValidationErrors,
  websiteController.searchWebsites,
);

router.get("/user/dashboard", websiteController.getUserWebsites);

router.get(
  "/user/dashboard/:id",
  getWebsiteByIdValidationRules(),
  handleValidationErrors,
  websiteController.getUserWebsiteById,
);

router.post(
  "/user/dashboard",
  addWebsiteToUserValidationRules(),
  handleValidationErrors,
  websiteController.addWebsiteToUser,
);

router.put(
  "/user/dashboard/:id",
  updateUserWebsiteValidationRules(),
  handleValidationErrors,
  websiteController.updateUserWebsite,
);

router.delete(
  "/user/dashboard/:id",
  deleteWebsiteValidationRules(),
  handleValidationErrors,
  websiteController.removeWebsiteFromUser,
);

router.patch(
  "/user/dashboard/:id/pin",
  setPinStatusValidationRules(),
  handleValidationErrors,
  websiteController.setPinStatus,
);

export default router;
