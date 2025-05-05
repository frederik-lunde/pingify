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
exports.getUserIncidentCountLast24h = exports.getWebsiteIncidents = exports.getUserIncidents = void 0;
const IncidentService = __importStar(require("../services/incidentService"));
const WebsiteService = __importStar(require("../services/websiteService")); // For access checks
const date_fns_1 = require("date-fns");
// --- Controller Functions ---
/**
 * GET /api/incidents/user - Get incidents for websites monitored by the authenticated user.
 * Validation handled by middleware.
 */
const getUserIncidents = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        // Access validated query parameters
        const { limit, type, from, to, websiteId, status } = req.query;
        const options = {
            limit: limit,
            type: type,
            from: from,
            to: to,
            userId: userId, // Add authenticated user ID
            websiteId: websiteId,
            status: status
        };
        // Pass userId again for potential name mapping in the service
        const incidents = yield IncidentService.getIncidents(options, userId);
        res.json(incidents);
    }
    catch (error) {
        next(error);
    }
});
exports.getUserIncidents = getUserIncidents;
/**
 * GET /api/incidents/website/:websiteId - Get incidents for a specific website.
 * Validation handled by middleware.
 */
const getWebsiteIncidents = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        // Access validated params and query
        const websiteId = req.params.websiteId;
        const { limit, type, from, to, status } = req.query;
        // Access Check
        const hasAccess = yield WebsiteService.hasUserWebsite(userId, websiteId);
        if (!hasAccess) {
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }
        const options = {
            limit: limit,
            type: type,
            from: from,
            to: to,
            websiteId: websiteId,
            status: status
        };
        // Pass userId for potential name mapping in the service
        const incidents = yield IncidentService.getIncidents(options, userId);
        res.json(incidents);
    }
    catch (error) {
        next(error);
    }
});
exports.getWebsiteIncidents = getWebsiteIncidents;
/**
 * GET /api/incidents/user/count/last24h - Get count of incidents started in last 24h for user.
 * No specific input validation needed beyond authentication.
 */
const getUserIncidentCountLast24h = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Authentication required.' });
            return;
        }
        const userId = req.user.id;
        const twentyFourHoursAgo = (0, date_fns_1.subHours)(new Date(), 24);
        const count = yield IncidentService.countIncidents({ userId: userId, from: twentyFourHoursAgo });
        const response = { incidentCount: count };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.getUserIncidentCountLast24h = getUserIncidentCountLast24h;
