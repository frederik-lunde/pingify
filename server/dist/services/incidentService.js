"use strict";
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
exports.getOpenIncident = getOpenIncident;
exports.createIncident = createIncident;
exports.resolveIncident = resolveIncident;
exports.getIncidents = getIncidents;
exports.countIncidents = countIncidents;
exports.getMostRecentIncident = getMostRecentIncident;
exports.getCurrentOpenIncidentForWebsite = getCurrentOpenIncidentForWebsite;
// server/src/services/incidentService.ts
const client_1 = require("@prisma/client");
const prismaClient_1 = __importDefault(require("../prisma/prismaClient"));
const date_fns_1 = require("date-fns");
// Assume these types are updated: Incident should reflect userId: string if it includes user details directly
const types_1 = require("../types");
// Helper: Map Prisma Incident to Shared Type
// Changed userId parameter to string.
const mapPrismaIncidentToShared = (incident, userId // Optional: User requesting the data (string ID)
) => {
    var _a, _b, _c, _d;
    if (!incident)
        return null;
    let websiteName = (_a = incident.website) === null || _a === void 0 ? void 0 : _a.url;
    if (userId && ((_b = incident.website) === null || _b === void 0 ? void 0 : _b.websiteUsers) && incident.website.websiteUsers.length > 0) {
        // Compare string IDs
        const userWebsite = incident.website.websiteUsers.find(wu => wu.userId === userId);
        if (userWebsite === null || userWebsite === void 0 ? void 0 : userWebsite.name) {
            websiteName = userWebsite.name;
        }
    }
    return {
        id: incident.id,
        websiteId: incident.websiteId,
        type: incident.type,
        startTime: incident.startTime.toISOString(),
        endTime: (_d = (_c = incident.endTime) === null || _c === void 0 ? void 0 : _c.toISOString()) !== null && _d !== void 0 ? _d : null,
        durationSeconds: incident.durationSeconds,
        initialResultId: incident.initialResultId,
        confirmingResultId: incident.confirmingResultId,
        resolvingResultId: incident.resolvingResultId,
        website: incident.website ? {
            id: incident.websiteId,
            url: incident.website.url,
            name: websiteName
        } : undefined,
    };
};
// --- Incident Management Functions ---
// No userId changes needed in getOpenIncident, createIncident, resolveIncident
function getOpenIncident(websiteId, type) {
    return __awaiter(this, void 0, void 0, function* () {
        return prismaClient_1.default.incident.findFirst({
            where: {
                websiteId: websiteId,
                type: type,
                endTime: null
            },
            orderBy: { startTime: 'desc' }
        });
    });
}
function createIncident(websiteId, type, confirmedAt, initialResultId, confirmingResultId) {
    return __awaiter(this, void 0, void 0, function* () {
        const logPrefix = `[IncidentService W:${websiteId} T:${type}]`;
        console.log(`${logPrefix} Attempting to create/get incident. Confirmed At: ${confirmedAt.toISOString()}`);
        const existingOpenIncident = yield getOpenIncident(websiteId, type);
        if (existingOpenIncident) {
            console.log(`${logPrefix} Incident creation skipped: An open incident (ID: ${existingOpenIncident.id}) of type '${type}' already exists.`);
            return existingOpenIncident;
        }
        try {
            const incidentStartTime = confirmedAt;
            console.log(`${logPrefix} Creating new incident with startTime: ${incidentStartTime.toISOString()}. InitialResult: ${initialResultId !== null && initialResultId !== void 0 ? initialResultId : 'N/A'}, ConfirmingResult: ${confirmingResultId !== null && confirmingResultId !== void 0 ? confirmingResultId : 'N/A'}`);
            const newIncident = yield prismaClient_1.default.incident.create({
                data: {
                    websiteId: websiteId,
                    type: type,
                    startTime: incidentStartTime,
                    endTime: null,
                    durationSeconds: null,
                    initialResultId: initialResultId,
                    confirmingResultId: confirmingResultId
                }
            });
            console.log(`${logPrefix} Successfully created Incident ID: ${newIncident.id}`);
            return newIncident;
        }
        catch (error) {
            console.error(`${logPrefix} Error creating incident:`, error);
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                console.warn(`${logPrefix} Potential race condition (P2002) creating incident. Re-checking for open incident.`);
                return getOpenIncident(websiteId, type);
            }
            throw error;
        }
    });
}
function resolveIncident(incidentId, resolvedAt, resolvingResultId) {
    return __awaiter(this, void 0, void 0, function* () {
        const logPrefix = `[IncidentService I:${incidentId}]`;
        try {
            const incident = yield prismaClient_1.default.incident.findUnique({ where: { id: incidentId } });
            if (!incident) {
                console.warn(`${logPrefix} Resolve failed: Incident not found.`);
                return null;
            }
            if (incident.endTime !== null) {
                console.log(`${logPrefix} Resolve skipped: Incident already resolved at ${incident.endTime.toISOString()}.`);
                return incident;
            }
            const duration = (0, date_fns_1.differenceInSeconds)(resolvedAt, incident.startTime);
            console.log(`${logPrefix} Resolving incident. Resolved At: ${resolvedAt.toISOString()}, ResolvingResult: ${resolvingResultId !== null && resolvingResultId !== void 0 ? resolvingResultId : 'N/A'}, Duration: ${duration}s`);
            const updatedIncident = yield prismaClient_1.default.incident.update({
                where: { id: incidentId },
                data: {
                    endTime: resolvedAt,
                    durationSeconds: duration,
                    resolvingResultId: resolvingResultId
                }
            });
            console.log(`${logPrefix} Successfully resolved incident.`);
            return updatedIncident;
        }
        catch (error) {
            console.error(`${logPrefix} Error resolving incident:`, error);
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                console.warn(`${logPrefix} Resolve failed: Incident not found during update attempt.`);
                return null;
            }
            throw error;
        }
    });
}
// --- Incident Querying Functions ---
/**
 * Retrieves incidents based on query options, mapping to shared type.
 * Changed requestingUserId and options.userId to string.
 */
function getIncidents() {
    return __awaiter(this, arguments, void 0, function* (options = {}, requestingUserId // Changed to string
    ) {
        const logPrefix = `[IncidentService.getIncidents] User: ${requestingUserId !== null && requestingUserId !== void 0 ? requestingUserId : 'N/A'}`;
        // Ensure options.userId is treated as string if present
        const { limit = 50, type, from, to, userId: optionsUserId, websiteId, status } = options;
        const userId = optionsUserId; // Cast options.userId to string
        console.log(`${logPrefix} Received options:`, JSON.stringify(Object.assign(Object.assign({}, options), { userId })));
        const whereClause = {};
        if (websiteId !== undefined) {
            whereClause.websiteId = websiteId;
        }
        else if (userId !== undefined) {
            // Filter by string userId
            whereClause.website = {
                websiteUsers: { some: { userId: userId } }
            };
        }
        if (type && types_1.VALID_INCIDENT_TYPES.includes(type))
            whereClause.type = type;
        if (from || to) {
            whereClause.startTime = {};
            if (from)
                whereClause.startTime.gte = from;
            if (to)
                whereClause.startTime.lte = to;
        }
        if (status === 'open')
            whereClause.endTime = null;
        else if (status === 'closed')
            whereClause.endTime = { not: null };
        const needsWebsiteUsers = !!(userId || requestingUserId);
        const targetUserIdForName = userId !== null && userId !== void 0 ? userId : requestingUserId; // This will be a string or undefined
        console.log(`${logPrefix} Constructed Prisma Where Clause:`, JSON.stringify(whereClause));
        try {
            const incidentsPrisma = yield prismaClient_1.default.incident.findMany({
                where: whereClause,
                orderBy: { startTime: 'desc' },
                take: limit,
                include: {
                    website: {
                        select: Object.assign({ url: true }, (needsWebsiteUsers && targetUserIdForName && {
                            websiteUsers: {
                                where: { userId: targetUserIdForName }, // Use string ID
                                select: { name: true, userId: true } // userId selected is string
                            }
                        }))
                    }
                }
            });
            console.log(`${logPrefix} Prisma findMany returned ${incidentsPrisma.length} raw records.`);
            // Pass string userId for name mapping
            const mappedIncidents = incidentsPrisma
                .map(inc => mapPrismaIncidentToShared(inc, targetUserIdForName))
                .filter(inc => inc !== null);
            console.log(`${logPrefix} Returning ${mappedIncidents.length} mapped incidents.`);
            return mappedIncidents;
        }
        catch (error) {
            console.error(`${logPrefix} Error executing Prisma findMany:`, error);
            throw error;
        }
    });
}
/**
 * Counts incidents based on query options.
 * Changed options.userId to string.
 */
function countIncidents() {
    return __awaiter(this, arguments, void 0, function* (options = {}) {
        // Ensure options.userId is treated as string if present
        const { type, from, to, userId: optionsUserId, websiteId, status } = options;
        const userId = optionsUserId; // Cast to string
        const whereClause = {};
        if (websiteId !== undefined)
            whereClause.websiteId = websiteId;
        else if (userId !== undefined)
            whereClause.website = { websiteUsers: { some: { userId: userId } } }; // Use string ID
        if (type && types_1.VALID_INCIDENT_TYPES.includes(type))
            whereClause.type = type;
        if (from || to) {
            whereClause.startTime = {};
            if (from)
                whereClause.startTime.gte = from;
            if (to)
                whereClause.startTime.lte = to;
        }
        if (status === 'open')
            whereClause.endTime = null;
        else if (status === 'closed')
            whereClause.endTime = { not: null };
        return prismaClient_1.default.incident.count({ where: whereClause });
    });
}
/**
 * Gets the most recent incident overall, or for a specific user.
 * Changed userId type to string.
 */
function getMostRecentIncident(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const whereClause = {};
        if (userId) {
            whereClause.website = { websiteUsers: { some: { userId: userId } } }; // Use string ID
        }
        return prismaClient_1.default.incident.findFirst({
            where: whereClause,
            orderBy: { startTime: 'desc' },
            select: {
                id: true, websiteId: true, type: true, startTime: true, endTime: true,
                durationSeconds: true, initialResultId: true, confirmingResultId: true,
                resolvingResultId: true,
            }
        });
    });
}
// No userId changes needed in getCurrentOpenIncidentForWebsite
function getCurrentOpenIncidentForWebsite(websiteId) {
    return __awaiter(this, void 0, void 0, function* () {
        const openIncidentPrisma = yield prismaClient_1.default.incident.findFirst({
            where: {
                websiteId: websiteId,
                endTime: null
            },
            orderBy: { startTime: 'desc' },
            include: {
                website: { select: { url: true } }
            }
        });
        // Pass undefined userId for mapping (defaults to URL)
        return mapPrismaIncidentToShared(openIncidentPrisma);
    });
}
