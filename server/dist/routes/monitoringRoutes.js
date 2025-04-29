"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// server/src/routes/monitoringRoutes.ts
const express_1 = require("express");
const monitoringController = __importStar(require("../controllers/monitorController")); // Corrected controller import name
const authMiddleware_1 = require("../middleware/authMiddleware");
const authValidator_1 = require("../middleware/validators/authValidator"); // Reuse this
const monitorValidator_1 = require("../middleware/validators/monitorValidator");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
// --- Admin Routes ---
// Optional: Add isAdmin middleware if needed
router.get('/admin/results', (0, monitorValidator_1.getResultsValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.getAllResults);
router.get('/admin/stats', (0, monitorValidator_1.getStatsValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.getOverallStats);
// --- User Routes ---
router.get('/user/results', (0, monitorValidator_1.getResultsValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.getUserResults);
router.get('/user/stats', (0, monitorValidator_1.getStatsValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.getUserStats);
// --- Website-Specific Routes ---
router.get('/website/:websiteId/results', (0, monitorValidator_1.getResultsByWebsiteValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.getResultsByWebsite);
router.get('/website/:websiteId/stats', (0, monitorValidator_1.getWebsiteStatsValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.getWebsiteStats);
router.get('/website/:websiteId', (0, monitorValidator_1.getWebsiteDetailsValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.getWebsiteDetails);
// --- Actions ---
router.post('/check/:websiteId', (0, monitorValidator_1.triggerWebsiteCheckValidationRules)(), authValidator_1.handleValidationErrors, monitoringController.triggerWebsiteCheck);
exports.default = router;
