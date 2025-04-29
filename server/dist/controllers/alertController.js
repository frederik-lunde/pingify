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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAlertStats = exports.getAlertsByWebsite = exports.dismissAlert = exports.getUserAlerts = void 0;
const AlertService = __importStar(require("../services/alertService"));
const WebsiteService = __importStar(require("../services/websiteService"));
/**
 * Maps a Prisma Alert (potentially with relations) to the shared Alert type.
 * Note: Assumes relations like 'website', 'user', 'incident' might be included based on the service call.
 */
const mapPrismaAlertToShared = (prismaAlert) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const sharedAlert = {
        id: prismaAlert.id,
        websiteId: prismaAlert.websiteId,
        userId: prismaAlert.userId, // userId is string
        type: prismaAlert.type,
        message: prismaAlert.message,
        createdAt: prismaAlert.createdAt.toISOString(),
        incidentId: (_a = prismaAlert.incidentId) !== null && _a !== void 0 ? _a : undefined,
    };
    if (prismaAlert.website) {
        sharedAlert.website = {
            id: prismaAlert.website.id,
            url: prismaAlert.website.url,
            // Use the user's custom name if available (depends on how service fetched it)
            name: (_d = (_c = (_b = prismaAlert.website.websiteUsers) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : undefined
        };
    }
    if (prismaAlert.user) {
        // Ensure user ID is string
        sharedAlert.user = { id: String(prismaAlert.user.id), name: prismaAlert.user.name };
    }
    if (prismaAlert.incident) {
        sharedAlert.incident = {
            id: prismaAlert.incident.id,
            startTime: (_e = prismaAlert.incident.startTime) === null || _e === void 0 ? void 0 : _e.toISOString(),
            endTime: (_g = (_f = prismaAlert.incident.endTime) === null || _f === void 0 ? void 0 : _f.toISOString()) !== null && _g !== void 0 ? _g : null,
        };
    }
    return sharedAlert;
};
// --- Controller Functions ---
/**
 * GET /api/alerts/user - Get *active* alerts for the authenticated user.
 * Validation handled by middleware.
 */
const getUserAlerts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        // Access validated query parameters directly
        const { limit, type, from, to, websiteId } = req.query;
        const options = {
            // Cast through unknown for validated number/date types
            limit: limit,
            type: type,
            from: from,
            to: to,
            websiteId: websiteId
        };
        const alerts = yield AlertService.getAlertsForUser(userId, options);
        const responseAlerts = alerts.map(mapPrismaAlertToShared);
        res.json(responseAlerts);
    }
    catch (error) {
        next(error);
    }
});
exports.getUserAlerts = getUserAlerts;
/**
 * DELETE /api/alerts/:alertId - Dismiss (delete) an alert for the user.
 * Validation handled by middleware.
 */
const dismissAlert = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        // Access validated alertId (already parsed to int)
        const alertId = req.params.alertId;
        const deletedAlert = yield AlertService.dismissAlert(userId, alertId);
        if (deletedAlert === null) {
            res.status(404).json({ message: 'Alert not found or already dismissed.' });
        }
        else {
            res.status(204).send(); // Success, no content
        }
    }
    catch (error) {
        // Handle potential 'Forbidden' error from service
        if (error instanceof Error && error.message.includes('Forbidden')) {
            res.status(403).json({ message: error.message });
        }
        else {
            next(error);
        }
    }
});
exports.dismissAlert = dismissAlert;
/**
 * GET /api/alerts/website/:websiteId - Get *active* alerts for a specific website.
 * Validation handled by middleware.
 */
const getAlertsByWebsite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        // Access validated params and query
        const websiteId = req.params.websiteId;
        const { limit, type, from, to } = req.query;
        // Access check
        const hasAccess = yield WebsiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }
        const options = {
            // Cast through unknown for validated number/date types
            limit: limit,
            type: type,
            from: from,
            to: to
        };
        const alerts = yield AlertService.getAlertsByWebsite(websiteId, options);
        // Note: The service might include user details here, mapPrismaAlertToShared handles it
        const responseAlerts = alerts.map(mapPrismaAlertToShared);
        res.json(responseAlerts);
    }
    catch (error) {
        next(error);
    }
});
exports.getAlertsByWebsite = getAlertsByWebsite;
/**
 * GET /api/alerts/user/stats - Get *active* alert statistics for the authenticated user.
 * Validation handled by middleware.
 */
const getUserAlertStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        // --- CORRECTED CAST ---
        const days = req.query.days;
        const stats = yield AlertService.getUserAlertStats(userId, days);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getUserAlertStats = getUserAlertStats;
