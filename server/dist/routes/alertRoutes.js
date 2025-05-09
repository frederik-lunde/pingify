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
// server/src/routes/alertRoutes.ts
const express_1 = require("express");
const alertController = __importStar(require("../controllers/alertController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const authValidator_1 = require("../middleware/validators/authValidator"); // Reuse this
const alertValidator_1 = require("../middleware/validators/alertValidator");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
// --- User Specific Routes ---
router.get(
  "/user",
  (0, alertValidator_1.getUserAlertsValidationRules)(),
  authValidator_1.handleValidationErrors,
  alertController.getUserAlerts,
);
router.get(
  "/user/stats",
  (0, alertValidator_1.getUserAlertStatsValidationRules)(),
  authValidator_1.handleValidationErrors,
  alertController.getUserAlertStats,
);
// --- User Actions ---
router.delete(
  "/:alertId",
  (0, alertValidator_1.dismissAlertValidationRules)(),
  authValidator_1.handleValidationErrors,
  alertController.dismissAlert,
);
// --- Website Specific Routes ---
router.get(
  "/website/:websiteId",
  (0, alertValidator_1.getAlertsByWebsiteValidationRules)(),
  authValidator_1.handleValidationErrors,
  alertController.getAlertsByWebsite,
);
exports.default = router;
