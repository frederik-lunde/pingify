/* eslint-disable no-console */ // Allow console logs for debugging
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
} from '../types'; // Adjust path if necessary

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
    userId?: number // User requesting the data, for name mapping
): Incident | null => {
    if (!incident) return null;

    let websiteName: string | null | undefined = incident.website?.url; // Default to URL

    // Attempt to find user-specific name if userId is provided and relations exist
    if (userId && incident.website?.websiteUsers && incident.website.websiteUsers.length > 0) {
        // Find the specific WebsiteUser relation for the requesting user
        const userWebsite = incident.website.websiteUsers.find(wu => wu.userId === userId);
        // If found and has a name, use it
        if (userWebsite?.name) {
            websiteName = userWebsite.name;
        }
    }

    return {
        id: incident.id,
        websiteId: incident.websiteId,
        type: incident.type as IncidentType, // Assume type is valid based on creation logic
        startTime: incident.startTime.toISOString(),
        endTime: incident.endTime?.toISOString() ?? null,
        durationSeconds: incident.durationSeconds,
        initialResultId: incident.initialResultId,
        confirmingResultId: incident.confirmingResultId,
        resolvingResultId: incident.resolvingResultId,
        // Include website details, using the potentially mapped name
        website: incident.website ? {
             id: incident.websiteId,
             url: incident.website.url,
             name: websiteName // Use the determined name
         } : undefined,
    };
};


// --- Incident Management Functions ---

// getOpenIncident remains unchanged
export async function getOpenIncident( websiteId: number, type: IncidentType ): Promise<PrismaIncident | null> {
    return prisma.incident.findFirst({ where: { websiteId: websiteId, type: type, endTime: null }, orderBy: { startTime: 'desc' } });
}

// createIncident with logging
export async function createIncident(
    websiteId: number,
    type: IncidentType,
    confirmedAt: Date,
    initialResultId?: number,
    confirmingResultId?: number
): Promise<PrismaIncident | null> {
    const logPrefix = `[IncidentService W:${websiteId} T:${type}]`;
    console.log(`${logPrefix} Attempting to create/get incident. Confirmed At: ${confirmedAt.toISOString()}`);

    const existingOpenIncident = await getOpenIncident(websiteId, type);
    if (existingOpenIncident) {
        console.log(`${logPrefix} Incident creation skipped: An open incident (ID: ${existingOpenIncident.id}) of type '${type}' already exists.`);
        return existingOpenIncident;
    }

    try {
        // --- ADDED LOG: Log the exact startTime being used ---
        const incidentStartTime = confirmedAt; // Use the confirmedAt timestamp
        console.log(`${logPrefix} Creating new incident with startTime: ${incidentStartTime.toISOString()}. InitialResult: ${initialResultId ?? 'N/A'}, ConfirmingResult: ${confirmingResultId ?? 'N/A'}`);

        const newIncident = await prisma.incident.create({
            data: {
                websiteId: websiteId,
                type: type,
                startTime: incidentStartTime, // Save the exact startTime
                endTime: null,
                durationSeconds: null,
                initialResultId: initialResultId,
                confirmingResultId: confirmingResultId
            }
        });
        console.log(`${logPrefix} Successfully created Incident ID: ${newIncident.id}`);
        return newIncident;
    } catch (error) {
        console.error(`${logPrefix} Error creating incident:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // Potential race condition if two processes try to create simultaneously
            console.warn(`${logPrefix} Potential race condition (P2002) creating incident. Re-checking for open incident.`);
            return getOpenIncident(websiteId, type); // Try fetching again
        }
        throw error; // Re-throw other errors
    }
}

// resolveIncident remains unchanged
export async function resolveIncident(
    incidentId: number,
    resolvedAt: Date,
    resolvingResultId?: number
): Promise<PrismaIncident | null> {
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

// getIncidents with logging
export async function getIncidents(
    options: IncidentQueryOptions = {},
    requestingUserId?: number // User ID from the authenticated request for name mapping
): Promise<Incident[]> {
    const logPrefix = `[IncidentService.getIncidents] User: ${requestingUserId ?? 'N/A'}`;
    const { limit = 50, type, from, to, userId, websiteId, status } = options;

    // --- ADDED LOG: Log received options ---
    console.log(`${logPrefix} Received options:`, JSON.stringify(options, null, 2));

    const whereClause: Prisma.IncidentWhereInput = {};

    // Apply filters based on options
    if (websiteId !== undefined) {
        whereClause.websiteId = websiteId;
    } else if (userId !== undefined) {
        // Filter incidents belonging to websites the specified user monitors
        whereClause.website = {
            websiteUsers: { some: { userId: userId } }
        };
    }
    // Note: If neither websiteId nor userId is provided, it fetches for all websites (admin use?)

    if (type && VALID_INCIDENT_TYPES.includes(type)) {
        whereClause.type = type;
    }

    if (from || to) {
        whereClause.startTime = {};
        if (from) whereClause.startTime.gte = from;
        if (to) whereClause.startTime.lte = to; // Incidents started *within* the range
    }

    if (status === 'open') {
        whereClause.endTime = null;
    } else if (status === 'closed') {
        whereClause.endTime = { not: null };
    }

    // Determine if we need to fetch websiteUsers for name mapping
    // We need it if a specific userId was passed in options OR if a requestingUserId is available
    const needsWebsiteUsers = !!(userId || requestingUserId);

    // --- ADDED LOG: Log the constructed whereClause ---
    console.log(`${logPrefix} Constructed Prisma Where Clause:`, JSON.stringify(whereClause, null, 2));

    try {
        const incidentsPrisma = await prisma.incident.findMany({
            where: whereClause,
            orderBy: { startTime: 'desc' },
            take: limit,
            include: {
                // Include website details, and user-specific names if needed
                website: {
                    select: {
                        url: true,
                        // Conditionally include websiteUsers only if needed
                        ...(needsWebsiteUsers && {
                            websiteUsers: {
                                // Filter websiteUsers to only the relevant user for name mapping
                                where: { userId: userId ?? requestingUserId },
                                select: { name: true, userId: true }
                            }
                        })
                    }
                }
            }
        });

        // --- ADDED LOG: Log the number of raw records returned ---
        console.log(`${logPrefix} Prisma findMany returned ${incidentsPrisma.length} raw records.`);

        // Map Prisma results to the shared Incident type
        const mappedIncidents = incidentsPrisma
            // Cast is necessary because Prisma's generated type for include might not perfectly match IncidentWithIncludedWebsite yet
            .map(inc => mapPrismaIncidentToShared(inc as IncidentWithIncludedWebsite, userId ?? requestingUserId))
            // Filter out any null results from mapping (shouldn't happen if inc is valid)
            .filter(inc => inc !== null) as Incident[];

        console.log(`${logPrefix} Returning ${mappedIncidents.length} mapped incidents.`);
        return mappedIncidents;

    } catch (error) {
        console.error(`${logPrefix} Error executing Prisma findMany:`, error);
        throw error; // Re-throw the error to be handled by the controller
    }
}

// countIncidents remains unchanged (logging could be added similarly if needed)
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

// getMostRecentIncident remains unchanged
export async function getMostRecentIncident(userId?: number): Promise<PrismaIncident | null> {
    const whereClause: Prisma.IncidentWhereInput = {};
    if (userId) {
        whereClause.website = { websiteUsers: { some: { userId } } };
    }
    return prisma.incident.findFirst({
        where: whereClause,
        orderBy: { startTime: 'desc' },
        select: { id: true, websiteId: true, type: true, startTime: true, endTime: true, durationSeconds: true, initialResultId: true, confirmingResultId: true, resolvingResultId: true, }
    });
}


// getCurrentOpenIncidentForWebsite remains unchanged
export async function getCurrentOpenIncidentForWebsite(websiteId: number): Promise<Incident | null> {
    const openIncidentPrisma = await prisma.incident.findFirst({
        where: { websiteId: websiteId, endTime: null },
        orderBy: { startTime: 'desc' },
        include: { website: { select: { url: true } } }
    });
    // Use requestingUserId = undefined here as we don't have it, name will default to URL
    return mapPrismaIncidentToShared(openIncidentPrisma as IncidentWithIncludedWebsite);
}