// server/src/services/incidentService.ts
import {
    PrismaClient,
    Incident as PrismaIncident,
    MonitoringResult as PrismaMonitoringResult,
    Website as PrismaWebsite,
    Prisma,
} from '@prisma/client';
import prisma from '../prisma/prismaClient';
import { subHours, differenceInSeconds } from 'date-fns';
import {
    Incident,
    IncidentType,
    IncidentQueryOptions,
    VALID_INCIDENT_TYPES,
    MonitoringResult,
    WebsiteUser,
} from '../types';

// Helper Type Definition for Included Relation
type IncidentWithIncludedWebsite = PrismaIncident & {
    website?: {
        url: string;
        websiteUsers?: {
            name: string | null;
            userId: number;
        }[];
    } | null;
};


// Helper: Map Prisma Incident to Shared Type
const mapPrismaIncidentToShared = (
    incident: IncidentWithIncludedWebsite | null,
    userId?: number
): Incident | null => {
    if (!incident) return null;
    let websiteName: string | null | undefined = incident.website?.url;
    if (userId && incident.website?.websiteUsers && incident.website.websiteUsers.length > 0) {
        const userWebsite = incident.website.websiteUsers.find(wu => wu.userId === userId);
        if (userWebsite?.name) { websiteName = userWebsite.name; }
    }
    return {
        id: incident.id,
        websiteId: incident.websiteId,
        type: incident.type as IncidentType,
        startTime: incident.startTime.toISOString(),
        endTime: incident.endTime?.toISOString() ?? null,
        durationSeconds: incident.durationSeconds,
        initialResultId: incident.initialResultId,
        confirmingResultId: incident.confirmingResultId,
        resolvingResultId: incident.resolvingResultId,
        website: incident.website ? { id: incident.websiteId, url: incident.website.url, name: websiteName } : undefined,
    };
};


// --- Incident Management Functions ---

// getOpenIncident remains unchanged
export async function getOpenIncident( websiteId: number, type: IncidentType ): Promise<PrismaIncident | null> {
    return prisma.incident.findFirst({ where: { websiteId: websiteId, type: type, endTime: null }, orderBy: { startTime: 'desc' } });
}

// createIncident remains unchanged
export async function createIncident( websiteId: number, type: IncidentType, confirmedAt: Date, initialResultId?: number, confirmingResultId?: number ): Promise<PrismaIncident | null> {
    const logPrefix = `[IncidentService W:${websiteId} T:${type}]`;
    const existingOpenIncident = await getOpenIncident(websiteId, type);
    if (existingOpenIncident) { console.log(`${logPrefix} Incident creation skipped: An open incident (ID: ${existingOpenIncident.id}) of type '${type}' already exists.`); return existingOpenIncident; }
    try {
        console.log(`${logPrefix} Creating new incident. Confirmed At: ${confirmedAt.toISOString()}, InitialResult: ${initialResultId ?? 'N/A'}, ConfirmingResult: ${confirmingResultId ?? 'N/A'}`);
        const newIncident = await prisma.incident.create({ data: { websiteId: websiteId, type: type, startTime: confirmedAt, endTime: null, durationSeconds: null, initialResultId: initialResultId, confirmingResultId: confirmingResultId } });
        console.log(`${logPrefix} Successfully created Incident ID: ${newIncident.id}`); return newIncident;
    } catch (error) {
        console.error(`${logPrefix} Error creating incident:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { console.warn(`${logPrefix} Potential race condition creating incident. Re-checking for open incident.`); return getOpenIncident(websiteId, type); }
        throw error;
    }
}

// resolveIncident remains unchanged
export async function resolveIncident( incidentId: number, resolvedAt: Date, resolvingResultId?: number ): Promise<PrismaIncident | null> {
    const logPrefix = `[IncidentService I:${incidentId}]`;
    try {
        const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
        if (!incident) { console.warn(`${logPrefix} Resolve failed: Incident not found.`); return null; }
        if (incident.endTime !== null) { console.log(`${logPrefix} Resolve skipped: Incident already resolved at ${incident.endTime.toISOString()}.`); return incident; }
        const duration = differenceInSeconds(resolvedAt, incident.startTime);
        console.log(`${logPrefix} Resolving incident. Resolved At: ${resolvedAt.toISOString()}, ResolvingResult: ${resolvingResultId ?? 'N/A'}, Duration: ${duration}s`);
        const updatedIncident = await prisma.incident.update({ where: { id: incidentId }, data: { endTime: resolvedAt, durationSeconds: duration, resolvingResultId: resolvingResultId } });
        console.log(`${logPrefix} Successfully resolved incident.`); return updatedIncident;
    } catch (error) {
        console.error(`${logPrefix} Error resolving incident:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { console.warn(`${logPrefix} Resolve failed: Incident not found during update attempt.`); return null; }
        throw error;
    }
}


// --- Incident Querying Functions ---

// getIncidents remains unchanged
export async function getIncidents( options: IncidentQueryOptions = {}, requestingUserId?: number ): Promise<Incident[]> {
    const { limit = 50, type, from, to, userId, websiteId, status } = options;
    const whereClause: Prisma.IncidentWhereInput = {};
    if (websiteId !== undefined) { whereClause.websiteId = websiteId; }
    else if (userId !== undefined) { whereClause.website = { websiteUsers: { some: { userId: userId } } }; }
    if (type && VALID_INCIDENT_TYPES.includes(type)) { whereClause.type = type; }
    if (from || to) { whereClause.startTime = {}; if (from) whereClause.startTime.gte = from; if (to) whereClause.startTime.lte = to; }
    if (status === 'open') { whereClause.endTime = null; }
    else if (status === 'closed') { whereClause.endTime = { not: null }; }
    const needsWebsiteUsers = !!(userId || requestingUserId);
    const incidentsPrisma = await prisma.incident.findMany({
        where: whereClause, orderBy: { startTime: 'desc' }, take: limit,
        include: { website: { select: { url: true, ...(needsWebsiteUsers && { websiteUsers: { where: { userId: userId ?? requestingUserId }, select: { name: true, userId: true } } }) } } }
    });
    return incidentsPrisma.map(inc => mapPrismaIncidentToShared(inc as IncidentWithIncludedWebsite, userId ?? requestingUserId)).filter(inc => inc !== null) as Incident[];
}

// countIncidents remains unchanged
export async function countIncidents(options: IncidentQueryOptions = {}): Promise<number> {
    const { type, from, to, userId, websiteId, status } = options;
    const whereClause: Prisma.IncidentWhereInput = {};
    if (websiteId !== undefined) whereClause.websiteId = websiteId;
    else if (userId !== undefined) whereClause.website = { websiteUsers: { some: { userId } } };
    if (type && VALID_INCIDENT_TYPES.includes(type)) whereClause.type = type;
    if (from || to) { whereClause.startTime = {}; if (from) whereClause.startTime.gte = from; if (to) whereClause.startTime.lte = to; }
    if (status === 'open') whereClause.endTime = null;
    else if (status === 'closed') whereClause.endTime = { not: null };
    return prisma.incident.count({ where: whereClause });
}

/**
 * Get the most recent incident overall or for a specific user.
 * FIX: Select all fields required by PrismaIncident type.
 */
export async function getMostRecentIncident(userId?: number): Promise<PrismaIncident | null> {
    const whereClause: Prisma.IncidentWhereInput = {};
    if (userId) {
        whereClause.website = { websiteUsers: { some: { userId } } };
    }

    return prisma.incident.findFirst({
        where: whereClause,
        orderBy: { startTime: 'desc' },
        // Select all fields of the Incident model
        select: {
            id: true,
            websiteId: true,
            type: true,
            startTime: true,
            endTime: true,
            durationSeconds: true,
            initialResultId: true,
            confirmingResultId: true,
            resolvingResultId: true,
            // Note: Relations (like website, results) are not selected here
            // If needed elsewhere, adjust the calling function or this select
        }
        // Remove include as select takes precedence
        // include: { website: { select: { id: true } } }
    });
}


// getCurrentOpenIncidentForWebsite remains unchanged
export async function getCurrentOpenIncidentForWebsite(websiteId: number): Promise<Incident | null> {
    const openIncidentPrisma = await prisma.incident.findFirst({
        where: { websiteId: websiteId, endTime: null },
        orderBy: { startTime: 'desc' },
        include: { website: { select: { url: true } } }
    });
    return mapPrismaIncidentToShared(openIncidentPrisma as IncidentWithIncludedWebsite);
}