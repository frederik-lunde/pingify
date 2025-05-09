"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
// server/src/routes/websiteRoutes.ts
const express_1 = require("express");
const websiteController = __importStar(
  require("../controllers/websiteController"),
);
const authMiddleware_1 = require("../middleware/authMiddleware");
const authValidator_1 = require("../middleware/validators/authValidator"); // Reuse this
const websiteValidator_1 = require("../middleware/validators/websiteValidator");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
// --- Admin Routes ---
// Optional: Add isAdmin middleware if needed
router.get("/admin/all", websiteController.getAllWebsites); // No input validation
router.post(
  "/admin/create",
  (0, websiteValidator_1.createWebsiteValidationRules)(),
  authValidator_1.handleValidationErrors,
  websiteController.createWebsite,
);
router.put(
  "/admin/:id",
  (0, websiteValidator_1.updateWebsiteValidationRules)(),
  authValidator_1.handleValidationErrors,
  websiteController.updateWebsite,
);
router.delete(
  "/admin/:id",
  (0, websiteValidator_1.deleteWebsiteValidationRules)(), // Only validates ID param
  authValidator_1.handleValidationErrors,
  websiteController.deleteWebsite,
);
router.patch(
  "/admin/:id/toggle",
  (0, websiteValidator_1.toggleWebsiteStatusValidationRules)(), // Only validates ID param
  authValidator_1.handleValidationErrors,
  websiteController.toggleWebsiteStatus,
);
// --- Core website routes ---
router.get(
  "/search",
  (0, websiteValidator_1.searchWebsitesValidationRules)(),
  authValidator_1.handleValidationErrors,
  websiteController.searchWebsites,
);
router.get(
  "/:id",
  (0, websiteValidator_1.getWebsiteByIdValidationRules)(), // Only validates ID param
  authValidator_1.handleValidationErrors,
  websiteController.getWebsiteById,
);
// --- User dashboard routes ---
router.get("/user/dashboard", websiteController.getUserWebsites); // No input validation
router.get(
  "/user/dashboard/:id",
  (0, websiteValidator_1.getWebsiteByIdValidationRules)(), // Only validates ID param
  authValidator_1.handleValidationErrors,
  websiteController.getUserWebsiteById,
);
router.post(
  "/user/dashboard",
  (0, websiteValidator_1.addWebsiteToUserValidationRules)(),
  authValidator_1.handleValidationErrors,
  websiteController.addWebsiteToUser,
);
router.put(
  "/user/dashboard/:id",
  (0, websiteValidator_1.updateUserWebsiteValidationRules)(),
  authValidator_1.handleValidationErrors,
  websiteController.updateUserWebsite,
);
router.delete(
  "/user/dashboard/:id",
  (0, websiteValidator_1.deleteWebsiteValidationRules)(), // Only validates ID param
  authValidator_1.handleValidationErrors,
  websiteController.removeWebsiteFromUser,
);
router.patch(
  "/user/dashboard/:id/pin",
  (0, websiteValidator_1.setPinStatusValidationRules)(),
  authValidator_1.handleValidationErrors,
  websiteController.setPinStatus,
);
exports.default = router;
