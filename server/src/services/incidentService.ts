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
        // Include potential user-specific names if needed
        websiteUsers?: {
            name: string | null;
            userId: number;
        }[];
    } | null;
    };
  
    // Helper: Map Prisma Incident to Shared Type
    const mapPrismaIncidentToShared = (
    incident: IncidentWithIncludedWebsite | null,
    userId?: number // Optional: User requesting the data, for name mapping
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
  
    /**
     * Finds the currently open incident of a specific type for a website.
     */
    export async function getOpenIncident( websiteId: number, type: IncidentType ): Promise<PrismaIncident | null> {
    return prisma.incident.findFirst({
        where: {
            websiteId: websiteId,
            type: type,
            endTime: null // Key condition: incident is open
        },
        orderBy: { startTime: 'desc' } // Get the most recent open one if multiple somehow exist
    });
    }
  
    /**
     * Creates a new incident if one of the same type isn't already open.
     */
    export async function createIncident(
    websiteId: number,
    type: IncidentType,
    confirmedAt: Date, // The timestamp when the incident condition was confirmed
    initialResultId?: number, // Optional: Result that triggered the check
    confirmingResultId?: number // Optional: Result that confirmed the incident
    ): Promise<PrismaIncident | null> {
    const logPrefix = `[IncidentService W:${websiteId} T:${type}]`;
    console.log(`${logPrefix} Attempting to create/get incident. Confirmed At: ${confirmedAt.toISOString()}`);
  
    //
    // Check if an incident of this type is already open to prevent duplicates
    //
    const existingOpenIncident = await getOpenIncident(websiteId, type);
    if (existingOpenIncident) {
        console.log(`${logPrefix} Incident creation skipped: An open incident (ID: ${existingOpenIncident.id}) of type '${type}' already exists.`);
        return existingOpenIncident; // Return the existing open incident
    }
  
    try {
        //
        // Use the confirmedAt timestamp as the official start time of the incident
        //
        const incidentStartTime = confirmedAt;
        console.log(`${logPrefix} Creating new incident with startTime: ${incidentStartTime.toISOString()}. InitialResult: ${initialResultId ?? 'N/A'}, ConfirmingResult: ${confirmingResultId ?? 'N/A'}`);
  
        const newIncident = await prisma.incident.create({
            data: {
                websiteId: websiteId,
                type: type,
                startTime: incidentStartTime, // Save the exact start time
                endTime: null, // Initially unresolved
                durationSeconds: null, // Initially no duration
                initialResultId: initialResultId,
                confirmingResultId: confirmingResultId
            }
        });
        console.log(`${logPrefix} Successfully created Incident ID: ${newIncident.id}`);
        return newIncident;
    } catch (error) {
        console.error(`${logPrefix} Error creating incident:`, error);
        // Handle potential race condition where another process created the incident between the check and create
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.warn(`${logPrefix} Potential race condition (P2002) creating incident. Re-checking for open incident.`);
            return getOpenIncident(websiteId, type); // Try fetching again
        }
        throw error; // Re-throw other errors
    }
    }
  
    /**
     * Resolves an open incident by setting its end time and duration.
     */
    export async function resolveIncident(
    incidentId: number,
    resolvedAt: Date, // The timestamp when the recovery was detected
    resolvingResultId?: number // Optional: The result that indicated recovery
    ): Promise<PrismaIncident | null> {
    const logPrefix = `[IncidentService I:${incidentId}]`;
    try {
        //
        // Fetch the incident to ensure it exists and get its start time
        //
        const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  
        if (!incident) {
            console.warn(`${logPrefix} Resolve failed: Incident not found.`);
            return null;
        }
        //
        // Prevent resolving an already resolved incident
        //
        if (incident.endTime !== null) {
            console.log(`${logPrefix} Resolve skipped: Incident already resolved at ${incident.endTime.toISOString()}.`);
            return incident;
        }
  
        //
        // Calculate duration in seconds
        //
        const duration = differenceInSeconds(resolvedAt, incident.startTime);
        console.log(`${logPrefix} Resolving incident. Resolved At: ${resolvedAt.toISOString()}, ResolvingResult: ${resolvingResultId ?? 'N/A'}, Duration: ${duration}s`);
  
        const updatedIncident = await prisma.incident.update({
            where: { id: incidentId },
            data: {
                endTime: resolvedAt,
                durationSeconds: duration,
                resolvingResultId: resolvingResultId
            }
        });
        console.log(`${logPrefix} Successfully resolved incident.`);
        return updatedIncident;
    } catch (error) {
        console.error(`${logPrefix} Error resolving incident:`, error);
        // Handle case where incident was deleted between find and update
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            console.warn(`${logPrefix} Resolve failed: Incident not found during update attempt.`);
            return null;
        }
        throw error;
    }
    }
  
    // --- Incident Querying Functions ---
  
    /**
     * Retrieves incidents based on query options, mapping to shared type.
     * Includes user-specific website names if requestingUserId or options.userId is provided.
     */
    export async function getIncidents(
    options: IncidentQueryOptions = {},
    requestingUserId?: number // Optional: User ID from the authenticated request for name mapping
    ): Promise<Incident[]> {
    const logPrefix = `[IncidentService.getIncidents] User: ${requestingUserId ?? 'N/A'}`;
    const { limit = 50, type, from, to, userId, websiteId, status } = options;
    console.log(`${logPrefix} Received options:`, JSON.stringify(options));
  
    const whereClause: Prisma.IncidentWhereInput = {};
  
    //
    // Apply filters based on options
    //
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
        // Filter incidents that *started* within the date range
        if (to) whereClause.startTime.lte = to;
    }
  
    if (status === 'open') {
        whereClause.endTime = null;
    } else if (status === 'closed') {
        whereClause.endTime = { not: null };
    }
  
    //
    // Determine if we need to fetch websiteUsers for name mapping
    // We need it if a specific userId was passed in options OR if a requestingUserId is available
    //
    const needsWebsiteUsers = !!(userId || requestingUserId);
    //
    // The specific user ID whose name we want to retrieve
    //
    const targetUserIdForName = userId ?? requestingUserId;
  
    console.log(`${logPrefix} Constructed Prisma Where Clause:`, JSON.stringify(whereClause));
  
    try {
        const incidentsPrisma = await prisma.incident.findMany({
            where: whereClause,
            orderBy: { startTime: 'desc' },
            take: limit,
            include: {
                //
                // Include website details, and user-specific names if needed
                //
                website: {
                    select: {
                        url: true,
                        //
                        // Conditionally include websiteUsers only if we need a specific user's name
                        //
                        ...(needsWebsiteUsers && targetUserIdForName && {
                            websiteUsers: {
                                // Filter websiteUsers to only the relevant user for name mapping
                                where: { userId: targetUserIdForName },
                                select: { name: true, userId: true }
                            }
                        })
                    }
                }
            }
        });
  
        console.log(`${logPrefix} Prisma findMany returned ${incidentsPrisma.length} raw records.`);
  
        //
        // Map Prisma results to the shared Incident type, passing the target user ID for name mapping
        //
        const mappedIncidents = incidentsPrisma
            // Cast is necessary because Prisma's generated type for include might not perfectly match IncidentWithIncludedWebsite yet
            .map(inc => mapPrismaIncidentToShared(inc as IncidentWithIncludedWebsite, targetUserIdForName))
            // Filter out any null results from mapping (shouldn't happen if inc is valid)
            .filter(inc => inc !== null) as Incident[];
  
        console.log(`${logPrefix} Returning ${mappedIncidents.length} mapped incidents.`);
        return mappedIncidents;
  
    } catch (error) {
        console.error(`${logPrefix} Error executing Prisma findMany:`, error);
        throw error; // Re-throw the error to be handled by the controller
    }
    }
  
    /**
     * Counts incidents based on query options.
     */
    export async function countIncidents(options: IncidentQueryOptions = {}): Promise<number> {
    const { type, from, to, userId, websiteId, status } = options;
    const whereClause: Prisma.IncidentWhereInput = {};
  
    // Apply filters similarly to getIncidents
    if (websiteId !== undefined) whereClause.websiteId = websiteId;
    else if (userId !== undefined) whereClause.website = { websiteUsers: { some: { userId } } };
  
    if (type && VALID_INCIDENT_TYPES.includes(type)) whereClause.type = type;
  
    if (from || to) {
        whereClause.startTime = {};
        if (from) whereClause.startTime.gte = from;
        if (to) whereClause.startTime.lte = to;
    }
  
    if (status === 'open') whereClause.endTime = null;
    else if (status === 'closed') whereClause.endTime = { not: null };
  
    return prisma.incident.count({ where: whereClause });
    }
  
    /**
     * Gets the most recent incident overall, or for a specific user.
     */
    export async function getMostRecentIncident(userId?: number): Promise<PrismaIncident | null> {
    const whereClause: Prisma.IncidentWhereInput = {};
    if (userId) {
        // Filter to incidents on websites the user monitors
        whereClause.website = { websiteUsers: { some: { userId } } };
    }
  
    return prisma.incident.findFirst({
        where: whereClause,
        orderBy: { startTime: 'desc' }, // Find the latest one
        // Select all necessary fields of the Incident model
        select: {
            id: true, websiteId: true, type: true, startTime: true, endTime: true,
            durationSeconds: true, initialResultId: true, confirmingResultId: true,
            resolvingResultId: true,
        }
    });
    }
  
    /**
     * Gets the current open incident (if any) for a specific website.
     * Maps to the shared Incident type, defaulting website name to URL.
     */
    export async function getCurrentOpenIncidentForWebsite(websiteId: number): Promise<Incident | null> {
    const openIncidentPrisma = await prisma.incident.findFirst({
        where: {
            websiteId: websiteId,
            endTime: null // Ensure it's open
        },
        orderBy: { startTime: 'desc' },
        include: {
            // Include basic website info needed for mapping
            website: { select: { url: true } }
        }
    });
  
    //
    // Use requestingUserId = undefined here, as this function is internal
    // and doesn't have user context. The name will default to the URL.
    //
    return mapPrismaIncidentToShared(openIncidentPrisma as IncidentWithIncludedWebsite);
    }