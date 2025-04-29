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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleResultProcessing = handleResultProcessing;
exports.getAlertsForUser = getAlertsForUser;
exports.getAlertsByWebsite = getAlertsByWebsite;
exports.dismissAlert = dismissAlert;
exports.getUserAlertStats = getUserAlertStats;
// server/src/services/alertService.ts
const client_1 = require("@prisma/client");
const config_1 = require("../config/config");
const prismaClient_1 = __importDefault(require("../prisma/prismaClient"));
const date_fns_1 = require("date-fns");
const types_1 = require("../types");
const monitoringService_1 = require("./monitoringService");
const IncidentService = __importStar(require("./incidentService"));
const mailService_1 = require("./mailService");
const RECHECK_DELAY_SECONDS = config_1.monitoringConfig.recheckDelaySeconds;
function handleResultProcessing(website, result) {
    return __awaiter(this, void 0, void 0, function* () {
        const logPrefix = `[ResultProc W:${website.id} R:${result.id}]`;
        console.log(`${logPrefix} Processing result. Available: ${result.isAvailable}, RT: ${result.responseTime}ms`);
        let recoveryProcessed = false;
        // --- Check for Recovery FIRST ---
        const openDownIncident = yield IncidentService.getOpenIncident(website.id, 'down');
        if (openDownIncident && result.isAvailable) {
            console.log(`${logPrefix} Recovery detected for DOWN incident (ID: ${openDownIncident.id}).`);
            yield IncidentService.resolveIncident(openDownIncident.id, result.checkedAt, result.id);
            yield dismissAlertsByType(website.id, 'down');
            recoveryProcessed = true;
        }
        const openSlowIncident = yield IncidentService.getOpenIncident(website.id, 'slow');
        if (openSlowIncident) {
            const usersPotentiallyAlerted = yield prismaClient_1.default.websiteUser.findMany({
                where: {
                    websiteId: website.id,
                    alertThreshold: { not: null, gt: 0 }
                },
                select: { alertThreshold: true }
            });
            const relevantThresholds = usersPotentiallyAlerted
                .map(u => u.alertThreshold)
                .filter((t) => t !== null);
            const recoveryThreshold = relevantThresholds.length > 0 ? Math.min(...relevantThresholds) : null;
            const isRecoveredSlow = result.isAvailable && (recoveryThreshold === null ||
                (result.responseTime !== null && result.responseTime <= recoveryThreshold));
            if (isRecoveredSlow) {
                console.log(`${logPrefix} Recovery detected for SLOW incident (ID: ${openSlowIncident.id}). RT: ${result.responseTime}ms <= Lowest Threshold: ${recoveryThreshold !== null && recoveryThreshold !== void 0 ? recoveryThreshold : 'N/A'}`);
                yield IncidentService.resolveIncident(openSlowIncident.id, result.checkedAt, result.id);
                yield dismissAlertsByType(website.id, 'slow');
                recoveryProcessed = true;
            }
        }
        // --- Check for Potential New Incidents (only if no recovery was just processed) ---
        if (recoveryProcessed) {
            console.log(`${logPrefix} Skipping new incident check as recovery was just processed.`);
            return;
        }
        let potentialType = null;
        let thresholdForSlow = null;
        if (!result.isAvailable) {
            const isDownIncidentOpen = !!(yield IncidentService.getOpenIncident(website.id, 'down'));
            if (!isDownIncidentOpen) {
                potentialType = 'down';
                console.log(`${logPrefix} Potential DOWN incident detected (Result unavailable, no open 'down' incident).`);
            }
            else {
                console.log(`${logPrefix} Result unavailable, but DOWN incident already open. No action needed.`);
            }
        }
        else if (result.responseTime !== null) {
            const isSlowIncidentOpen = !!(yield IncidentService.getOpenIncident(website.id, 'slow'));
            if (!isSlowIncidentOpen) {
                const allUserThresholds = yield prismaClient_1.default.websiteUser.findMany({
                    where: {
                        websiteId: website.id,
                        alertThreshold: { not: null, gt: 0 }
                    },
                    select: { alertThreshold: true }
                });
                const relevantThresholds = allUserThresholds
                    .map(u => u.alertThreshold)
                    .filter((t) => t !== null);
                let lowestExceededThreshold = null;
                for (const threshold of relevantThresholds) {
                    if (result.responseTime > threshold) {
                        if (lowestExceededThreshold === null || threshold < lowestExceededThreshold) {
                            lowestExceededThreshold = threshold;
                        }
                    }
                }
                if (lowestExceededThreshold !== null) {
                    potentialType = 'slow';
                    thresholdForSlow = lowestExceededThreshold;
                    console.log(`${logPrefix} Potential SLOW incident detected (RT: ${result.responseTime}ms > Lowest Exceeded Threshold: ${thresholdForSlow}ms, no open 'slow' incident).`);
                }
            }
            else {
                console.log(`${logPrefix} Result is slow (RT: ${result.responseTime}ms), but SLOW incident already open. No action needed.`);
            }
        }
        if (potentialType) {
            yield scheduleIncidentConfirmationCheck(website.id, result, potentialType, thresholdForSlow);
        }
        else {
            console.log(`${logPrefix} No new potential incident detected.`);
        }
    });
}
// No changes needed in scheduleIncidentConfirmationCheck
function scheduleIncidentConfirmationCheck(websiteId, initialResult, potentialType, thresholdForSlow) {
    return __awaiter(this, void 0, void 0, function* () {
        const delayMs = RECHECK_DELAY_SECONDS * 1000;
        const logPrefix = `[IncidentConfirmSched W:${websiteId} T:${potentialType}]`;
        console.log(`${logPrefix} Scheduling confirmation check in ${RECHECK_DELAY_SECONDS}s. Initial Result ID: ${initialResult.id}`);
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            console.log(`${logPrefix} Executing delayed ${potentialType} confirmation check.`);
            try {
                const website = yield prismaClient_1.default.website.findUnique({ where: { id: websiteId } });
                if (!website || !website.isActive) {
                    console.log(`${logPrefix} Confirmation check cancelled (website not found or inactive).`);
                    return;
                }
                const freshInitialResult = yield prismaClient_1.default.monitoringResult.findUnique({ where: { id: initialResult.id } });
                if (!freshInitialResult) {
                    console.log(`${logPrefix} Confirmation check cancelled (initial result ${initialResult.id} missing).`);
                    return;
                }
                yield handleIncidentConfirmation(website, freshInitialResult, potentialType, thresholdForSlow);
            }
            catch (error) {
                console.error(`${logPrefix} Error during delayed confirmation check execution:`, error);
            }
        }), delayMs);
    });
}
// No direct userId changes here, but relies on createAlertAndNotify using string userId
function handleIncidentConfirmation(website, initialResult, potentialType, thresholdForSlow) {
    return __awaiter(this, void 0, void 0, function* () {
        const logPrefix = `[IncidentConfirm W:${website.id} T:${potentialType}]`;
        console.log(`${logPrefix} Performing confirmation check.`);
        const existingOpenIncident = yield IncidentService.getOpenIncident(website.id, potentialType);
        if (existingOpenIncident) {
            console.log(`${logPrefix} Confirmation check skipped: An incident (ID: ${existingOpenIncident.id}) of type '${potentialType}' was already opened.`);
            return;
        }
        const confirmationCheckData = yield monitoringService_1.WebsiteMonitor.performWebsiteCheck(website.url);
        let confirmingResultDb;
        try {
            confirmingResultDb = yield monitoringService_1.ResultsManager.saveResult(website.id, confirmationCheckData);
            console.log(`${logPrefix} Confirmation check result saved (ID: ${confirmingResultDb.id}). Avail=${confirmingResultDb.isAvailable}, RT=${confirmingResultDb.responseTime}ms`);
        }
        catch (saveError) {
            console.error(`${logPrefix} CRITICAL: Failed to save confirmation check result:`, saveError);
            return;
        }
        let issueConfirmed = false;
        let confirmedType = null;
        if (potentialType === 'down' && !confirmingResultDb.isAvailable) {
            issueConfirmed = true;
            confirmedType = 'down';
            console.log(`${logPrefix} CONFIRMED DOWN.`);
        }
        else if (potentialType === 'slow' &&
            confirmingResultDb.isAvailable &&
            thresholdForSlow !== null &&
            confirmingResultDb.responseTime !== null &&
            confirmingResultDb.responseTime > thresholdForSlow) {
            issueConfirmed = true;
            confirmedType = 'slow';
            console.log(`${logPrefix} CONFIRMED SLOW (RT: ${confirmingResultDb.responseTime}ms > Original Threshold: ${thresholdForSlow}ms).`);
        }
        else {
            console.log(`${logPrefix} ${potentialType.toUpperCase()} condition NOT confirmed by check. Check Result -> Avail: ${confirmingResultDb.isAvailable}, RT: ${confirmingResultDb.responseTime}ms. Original Threshold (if slow): ${thresholdForSlow !== null && thresholdForSlow !== void 0 ? thresholdForSlow : 'N/A'}`);
        }
        if (issueConfirmed && confirmedType) {
            const newIncident = yield IncidentService.createIncident(website.id, confirmedType, confirmingResultDb.checkedAt, initialResult.id, confirmingResultDb.id);
            if (!newIncident) {
                console.error(`${logPrefix} Failed to create incident record. Aborting alert generation.`);
                return;
            }
            console.log(`${logPrefix} Incident ${newIncident.id} created/confirmed. Checking users for alerts.`);
            // Base criteria: User monitors this website and has alerts enabled globally for it
            const baseWhereClause = {
                websiteId: website.id,
                alertEnabled: true,
            };
            // Specific criteria for SLOW alerts
            if (confirmedType === 'slow') {
                if (confirmingResultDb.responseTime !== null) {
                    baseWhereClause.alertThreshold = {
                        not: null,
                        lte: confirmingResultDb.responseTime
                    };
                }
                else {
                    console.log(`${logPrefix} Confirmed SLOW incident ${newIncident.id} but confirmation check had null responseTime. No threshold-based alerts will be sent.`);
                    baseWhereClause.id = -1; // Impossible condition
                }
            }
            // Fetch WebsiteUser records, which now have userId as string
            const usersToAlert = yield prismaClient_1.default.websiteUser.findMany({
                where: baseWhereClause,
                select: {
                    id: true,
                    userId: true, // This is now a string
                    websiteId: true,
                    name: true,
                    interval: true,
                    alertThreshold: true,
                    alertEnabled: true,
                    notifyEmail: true,
                    createdAt: true,
                    isPinned: true
                }
            });
            if (usersToAlert.length === 0) {
                console.log(`${logPrefix} No users found requiring an alert for this confirmed ${confirmedType} incident ${newIncident.id}.`);
                return;
            }
            console.log(`${logPrefix} Found ${usersToAlert.length} users to notify for incident ${newIncident.id}.`);
            for (const user of usersToAlert) {
                // Pass the PrismaWebsiteUser object (which includes the string userId)
                yield createAlertAndNotify(website, user, newIncident, confirmingResultDb);
            }
        }
    });
}
function createAlertAndNotify(website, websiteUser, // This object has userId: string
incident, confirmingResult) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        // Use string userId from websiteUser object
        const logPrefix = `[AlertNotify U:${websiteUser.userId} W:${website.id} I:${incident.id}]`;
        const alertType = incident.type;
        // Check uses string userId
        const existingAlert = yield prismaClient_1.default.alert.findFirst({
            where: {
                userId: websiteUser.userId, // Use string ID
                websiteId: website.id,
                type: alertType,
                incidentId: incident.id
            },
            select: { id: true }
        });
        if (existingAlert) {
            console.log(`${logPrefix} Skipped ${alertType.toUpperCase()} alert creation (Alert ID: ${existingAlert.id} already exists for Incident ${incident.id}).`);
            return;
        }
        let message = '';
        const websiteDisplayName = websiteUser.name || website.url;
        if (alertType === 'down') {
            message = `Website is down: ${websiteDisplayName}`;
            if (confirmingResult.statusCode)
                message += ` (Status: ${confirmingResult.statusCode})`;
            if (confirmingResult.errorMessage)
                message += ` - Error: ${confirmingResult.errorMessage}`;
            message += ` (Incident ID: ${incident.id})`;
        }
        else if (alertType === 'slow') {
            const responseTimeMsg = confirmingResult.responseTime !== null ? `${confirmingResult.responseTime}ms` : 'N/A';
            message = `Website is responding slowly: ${websiteDisplayName} (${responseTimeMsg} > ${(_a = websiteUser.alertThreshold) !== null && _a !== void 0 ? _a : 'N/A'}ms) (Incident ID: ${incident.id})`;
        }
        let newAlert = null;
        try {
            // Create uses string userId
            newAlert = yield prismaClient_1.default.alert.create({
                data: {
                    userId: websiteUser.userId, // Use string ID
                    websiteId: website.id,
                    type: alertType,
                    message: message,
                    incidentId: incident.id
                }
            });
            console.log(`${logPrefix} Created ${alertType.toUpperCase()} Alert ID: ${newAlert.id} linked to Incident ID: ${incident.id}.`);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                console.warn(`${logPrefix} Alert creation race condition likely occurred for ${alertType} alert for Incident ${incident.id}. Skipping notification.`);
                return;
            }
            else {
                console.error(`${logPrefix} Error creating ${alertType.toUpperCase()} alert for Incident ${incident.id}:`, error);
                return;
            }
        }
        if (newAlert && websiteUser.notifyEmail) {
            let emailSubject = '';
            let emailBody = '';
            if (alertType === 'down') {
                emailSubject = `🔴 CONFIRMED DOWN: ${websiteDisplayName}`;
                emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be down.</p><p>Status Code: ${(_b = confirmingResult.statusCode) !== null && _b !== void 0 ? _b : 'N/A'}<br>Error Message: ${(_c = confirmingResult.errorMessage) !== null && _c !== void 0 ? _c : 'No specific error reported'}<br>Time Confirmed: ${incident.startTime.toLocaleString()}</p><p>Incident ID: ${incident.id}</p><p>Alert ID: ${newAlert.id}</p><p>Please check the dashboard for details and recovery status.</p>`;
            }
            else {
                const responseTimeBody = confirmingResult.responseTime !== null ? `${confirmingResult.responseTime}ms` : 'N/A';
                emailSubject = `🟠 CONFIRMED SLOW: ${websiteDisplayName}`;
                emailBody = `<p>Your monitored website <strong>${websiteDisplayName}</strong> is confirmed to be responding slowly.</p><p>Response Time: ${responseTimeBody} (Your Threshold: ${(_d = websiteUser.alertThreshold) !== null && _d !== void 0 ? _d : 'N/A'}ms)<br>Time Confirmed: ${incident.startTime.toLocaleString()}</p><p>Incident ID: ${incident.id}</p><p>Alert ID: ${newAlert.id}</p><p>Please check the dashboard for details and recovery status.</p>`;
            }
            try {
                console.log(`${logPrefix} Attempting to send ${alertType} email alert to ${websiteUser.notifyEmail}`);
                yield (0, mailService_1.sendMail)({ to: websiteUser.notifyEmail, subject: emailSubject, html: emailBody });
                console.log(`${logPrefix} Successfully sent ${alertType} email alert.`);
            }
            catch (emailError) {
                console.error(`${logPrefix} Failed to send ${alertType} email notification for Alert ID ${newAlert.id}:`, emailError);
            }
        }
        else if (newAlert && !websiteUser.notifyEmail) {
            console.log(`${logPrefix} Skipped email notification for Alert ID ${newAlert.id} (User has no notification email).`);
        }
    });
}
// No changes needed in dismissAlertsByType
function dismissAlertsByType(websiteId, type) {
    return __awaiter(this, void 0, void 0, function* () {
        const logPrefix = `[AlertDismiss W:${websiteId} T:${type}]`;
        try {
            const deleteResult = yield prismaClient_1.default.alert.deleteMany({
                where: {
                    websiteId: websiteId,
                    type: type
                }
            });
            if (deleteResult.count > 0) {
                console.log(`${logPrefix} Dismissed ${deleteResult.count} active '${type}' alerts upon recovery.`);
            }
        }
        catch (error) {
            console.error(`${logPrefix} Error dismissing alerts upon recovery:`, error);
        }
    });
}
// --- Alert Querying Functions ---
/**
* Retrieves alerts for a specific user, with optional filtering.
* Changed userId type to string.
*/
function getAlertsForUser(userId_1) {
    return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
        const { limit = 50, type, from, to, websiteId } = options;
        // Use string userId in where clause
        const whereClause = { userId: userId };
        if (type && types_1.VALID_ALERT_TYPES.includes(type))
            whereClause.type = type;
        if (from || to) {
            whereClause.createdAt = {};
            if (from)
                whereClause.createdAt.gte = from;
            if (to)
                whereClause.createdAt.lte = to;
        }
        if (websiteId !== undefined)
            whereClause.websiteId = websiteId;
        return prismaClient_1.default.alert.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                website: {
                    select: {
                        id: true,
                        url: true,
                        websiteUsers: {
                            where: { userId: userId }, // Use string ID here
                            select: { name: true }
                        }
                    }
                },
                incident: {
                    select: { id: true, startTime: true, endTime: true }
                }
            }
        });
    });
}
/**
* Retrieves alerts for a specific website, with optional filtering.
* Includes website URL, user details (ID will be string), and related incident info.
*/
function getAlertsByWebsite(websiteId_1) {
    return __awaiter(this, arguments, void 0, function* (websiteId, options = {}) {
        const { limit = 50, type, from, to } = options;
        const whereClause = { websiteId };
        if (type && types_1.VALID_ALERT_TYPES.includes(type))
            whereClause.type = type;
        if (from || to) {
            whereClause.createdAt = {};
            if (from)
                whereClause.createdAt.gte = from;
            if (to)
                whereClause.createdAt.lte = to;
        }
        return prismaClient_1.default.alert.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                website: { select: { id: true, url: true } },
                // User ID included here will now be a string
                user: { select: { id: true, name: true, email: true } },
                incident: { select: { id: true, startTime: true, endTime: true } }
            }
        });
    });
}
/**
* Dismisses (deletes) a specific alert if the user owns it.
* Changed userId type to string.
*/
function dismissAlert(userId, alertId) {
    return __awaiter(this, void 0, void 0, function* () {
        const logPrefix = `[Alert Dismiss U:${userId} A:${alertId}]`;
        console.log(`${logPrefix} Attempting to dismiss alert.`);
        const alert = yield prismaClient_1.default.alert.findUnique({
            where: { id: alertId },
            select: { userId: true } // userId retrieved here will be a string
        });
        if (!alert) {
            console.log(`${logPrefix} Alert not found.`);
            return null;
        }
        // Compare string IDs
        if (alert.userId !== userId) {
            console.warn(`${logPrefix} User does not own this alert. Dismissal denied.`);
            throw new Error('Forbidden: User does not own this alert');
        }
        try {
            const deletedAlert = yield prismaClient_1.default.alert.delete({ where: { id: alertId } });
            console.log(`${logPrefix} Alert successfully dismissed.`);
            return deletedAlert;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                console.log(`${logPrefix} Alert was already deleted.`);
                return null;
            }
            console.error(`${logPrefix} Error dismissing alert:`, error);
            throw error;
        }
    });
}
/**
* Calculates statistics about alerts for a specific user over a given period.
* Changed userId type to string.
*/
function getUserAlertStats(userId_1) {
    return __awaiter(this, arguments, void 0, function* (userId, days = 7) {
        const startDate = (0, date_fns_1.subHours)(new Date(), days * 24);
        const alerts = yield prismaClient_1.default.alert.findMany({
            where: {
                userId: userId, // Use string ID
                createdAt: { gte: startDate }
            },
            select: {
                type: true,
                websiteId: true,
                incidentId: true,
                website: {
                    select: {
                        url: true,
                        websiteUsers: {
                            where: { userId: userId }, // Use string ID
                            select: { name: true }
                        }
                    }
                }
            }
        });
        const totalAlerts = alerts.length;
        const byType = {};
        const websiteMap = new Map();
        alerts.forEach(alert => {
            var _a, _b, _c, _d;
            const alertType = alert.type;
            byType[alertType] = (byType[alertType] || 0) + 1;
            const customName = (_c = (_b = (_a = alert.website) === null || _a === void 0 ? void 0 : _a.websiteUsers) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.name;
            const websiteName = customName || ((_d = alert.website) === null || _d === void 0 ? void 0 : _d.url) || `Website ${alert.websiteId}`;
            if (!websiteMap.has(alert.websiteId)) {
                websiteMap.set(alert.websiteId, { websiteId: alert.websiteId, websiteName: websiteName, count: 0 });
            }
            websiteMap.get(alert.websiteId).count++;
        });
        const byWebsite = Array.from(websiteMap.values()).sort((a, b) => b.count - a.count);
        return { totalAlerts, byType, byWebsite };
    });
}
