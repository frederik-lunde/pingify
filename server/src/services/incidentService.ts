import {
  
  Incident as PrismaIncident,
  Prisma,

} from "@prisma/client";
import prisma from "../prisma/prismaClient";
import {  differenceInSeconds } from "date-fns";

import {
  Incident,
  IncidentType,
  IncidentQueryOptions,
  VALID_INCIDENT_TYPES,
} from "../types";


type IncidentWithIncludedWebsite = PrismaIncident & {
  website?: {
    url: string;
    websiteUsers?: {
      name: string | null;
      userId: string;
    }[];
  } | null;
};


/**
 * Maps a Prisma Incident object to a shared Incident DTO. It prioritizes the user-specific website name if available.
 */
const mapPrismaIncidentToShared = (
  incident: IncidentWithIncludedWebsite | null,
  userId?: string,
): Incident | null => {
  if (!incident) return null;

  let websiteName: string | null | undefined = incident.website?.url;

  if (
    userId &&
    incident.website?.websiteUsers &&
    incident.website.websiteUsers.length > 0
  ) {

    const userWebsite = incident.website.websiteUsers.find(
      (wu) => wu.userId === userId,
    );
    if (userWebsite?.name) {
      websiteName = userWebsite.name;
    }
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
    website: incident.website
      ? {
          id: incident.websiteId,
          url: incident.website.url,
          name: websiteName,
        }
      : undefined,
  };
};


/**
 * Retrieves an open incident of a specific type for a given website.
 * An open incident is one that does not have an endTime.
 */
export async function getOpenIncident(
  websiteId: number,
  type: IncidentType,
): Promise<PrismaIncident | null> {
  return prisma.incident.findFirst({
    where: {
      websiteId: websiteId,
      type: type,
      endTime: null,
    },
    orderBy: { startTime: "desc" },
  });
}

/**
 * Creates a new incident or returns an existing open one of the same type for the website.
 * This prevents duplicate open incidents.
 */
export async function createIncident(
  websiteId: number,
  type: IncidentType,
  confirmedAt: Date,
  initialResultId?: number,
  confirmingResultId?: number,
): Promise<PrismaIncident | null> {
  const logPrefix = `[IncidentService W:${websiteId} T:${type}]`;
  console.log(
    `${logPrefix} Attempting to create/get incident. Confirmed At: ${confirmedAt.toISOString()}`,
  );

  const existingOpenIncident = await getOpenIncident(websiteId, type);
  if (existingOpenIncident) {
    console.log(
      `${logPrefix} Incident creation skipped: An open incident (ID: ${existingOpenIncident.id}) of type '${type}' already exists.`,
    );
    return existingOpenIncident;
  }

  try {
    const incidentStartTime = confirmedAt;
    console.log(
      `${logPrefix} Creating new incident with startTime: ${incidentStartTime.toISOString()}. InitialResult: ${initialResultId ?? "N/A"}, ConfirmingResult: ${confirmingResultId ?? "N/A"}`,
    );
    const newIncident = await prisma.incident.create({
      data: {
        websiteId: websiteId,
        type: type,
        startTime: incidentStartTime,
        endTime: null,
        durationSeconds: null,
        initialResultId: initialResultId,
        confirmingResultId: confirmingResultId,
      },
    });
    console.log(
      `${logPrefix} Successfully created Incident ID: ${newIncident.id}`,
    );
    return newIncident;
  } catch (error) {
    console.error(`${logPrefix} Error creating incident:`, error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.warn(
        `${logPrefix} Potential race condition (P2002) creating incident. Re-checking for open incident.`,
      );
      return getOpenIncident(websiteId, type);
    }
    throw error;
  }
}

/**
 * Resolves an open incident by setting its end time, duration, and resolving result ID.
 * If the incident is already resolved or not found, it takes no action or returns null.
 */
export async function resolveIncident(
  incidentId: number,
  resolvedAt: Date,
  resolvingResultId?: number,
): Promise<PrismaIncident | null> {
  const logPrefix = `[IncidentService I:${incidentId}]`;
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      console.warn(`${logPrefix} Resolve failed: Incident not found.`);
      return null;
    }
    if (incident.endTime !== null) {
      console.log(
        `${logPrefix} Resolve skipped: Incident already resolved at ${incident.endTime.toISOString()}.`,
      );
      return incident;
    }
    const duration = differenceInSeconds(resolvedAt, incident.startTime);
    console.log(
      `${logPrefix} Resolving incident. Resolved At: ${resolvedAt.toISOString()}, ResolvingResult: ${resolvingResultId ?? "N/A"}, Duration: ${duration}s`,
    );
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        endTime: resolvedAt,
        durationSeconds: duration,
        resolvingResultId: resolvingResultId,
      },
    });
    console.log(`${logPrefix} Successfully resolved incident.`);
    return updatedIncident;
  } catch (error) {
    console.error(`${logPrefix} Error resolving incident:`, error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.warn(
        `${logPrefix} Resolve failed: Incident not found during update attempt.`,
      );
      return null;
    }
    throw error;
  }
}


/**
 * Retrieves a list of incidents based on various filter options.
 * It can filter by user, website, type, date range, and status (open/closed).
 */
export async function getIncidents(
  options: IncidentQueryOptions = {},
  requestingUserId?: string,
): Promise<Incident[]> {
  const logPrefix = `[IncidentService.getIncidents] User: ${requestingUserId ?? "N/A"}`;

  const {
    limit = 50,
    type,
    from,
    to,
    userId: optionsUserId,
    websiteId,
    status,
  } = options;
  const userId = optionsUserId as string | undefined;

  console.log(
    `${logPrefix} Received options:`,
    JSON.stringify({ ...options, userId }),
  );

  const whereClause: Prisma.IncidentWhereInput = {};

  if (websiteId !== undefined) {
    whereClause.websiteId = websiteId;
  } else if (userId !== undefined) {

    whereClause.website = {
      websiteUsers: { some: { userId: userId } },
    };
  }

  if (type && VALID_INCIDENT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) {
    whereClause.startTime = {};
    if (from) whereClause.startTime.gte = from;
    if (to) whereClause.startTime.lte = to;
  }
  if (status === "open") whereClause.endTime = null;
  else if (status === "closed") whereClause.endTime = { not: null };

  const needsWebsiteUsers = !!(userId || requestingUserId);
  const targetUserIdForName = userId ?? requestingUserId;

  console.log(
    `${logPrefix} Constructed Prisma Where Clause:`,
    JSON.stringify(whereClause),
  );

  try {
    const incidentsPrisma = await prisma.incident.findMany({
      where: whereClause,
      orderBy: { startTime: "desc" },
      take: limit,
      include: {
        website: {
          select: {
            url: true,
            ...(needsWebsiteUsers &&
              targetUserIdForName && {
                websiteUsers: {
                  where: { userId: targetUserIdForName },
                  select: { name: true, userId: true },
                },
              }),
          },
        },
      },
    });
    console.log(
      `${logPrefix} Prisma findMany returned ${incidentsPrisma.length} raw records.`,
    );


    const mappedIncidents = incidentsPrisma
      .map((inc) =>
        mapPrismaIncidentToShared(
          inc as IncidentWithIncludedWebsite,
          targetUserIdForName,
        ),
      )
      .filter((inc) => inc !== null) as Incident[];
    console.log(
      `${logPrefix} Returning ${mappedIncidents.length} mapped incidents.`,
    );
    return mappedIncidents;
  } catch (error) {
    console.error(`${logPrefix} Error executing Prisma findMany:`, error);
    throw error;
  }
}

/**
 * Counts the number of incidents based on various filter options.
 */
export async function countIncidents(
  options: IncidentQueryOptions = {},
): Promise<number> {

  const { type, from, to, userId: optionsUserId, websiteId, status } = options;
  const userId = optionsUserId as string | undefined;

  const whereClause: Prisma.IncidentWhereInput = {};

  if (websiteId !== undefined) whereClause.websiteId = websiteId;
  else if (userId !== undefined)
    whereClause.website = { websiteUsers: { some: { userId: userId } } };

  if (type && VALID_INCIDENT_TYPES.includes(type)) whereClause.type = type;
  if (from || to) {
    whereClause.startTime = {};
    if (from) whereClause.startTime.gte = from;
    if (to) whereClause.startTime.lte = to;
  }
  if (status === "open") whereClause.endTime = null;
  else if (status === "closed") whereClause.endTime = { not: null };

  return prisma.incident.count({ where: whereClause });
}

/**
 * Retrieves the most recent incident, optionally filtered by user ID.
 */
export async function getMostRecentIncident(
  userId?: string,
): Promise<PrismaIncident | null> {
  const whereClause: Prisma.IncidentWhereInput = {};
  if (userId) {
    whereClause.website = { websiteUsers: { some: { userId: userId } } };
  }

  return prisma.incident.findFirst({
    where: whereClause,
    orderBy: { startTime: "desc" },
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
    },
  });
}

/**
 * Retrieves the current open incident for a specific website, if one exists.
 */
export async function getCurrentOpenIncidentForWebsite(
  websiteId: number,
): Promise<Incident | null> {
  const openIncidentPrisma = await prisma.incident.findFirst({
    where: {
      websiteId: websiteId,
      endTime: null,
    },
    orderBy: { startTime: "desc" },
    include: {
      website: { select: { url: true } },
    },
  });

  return mapPrismaIncidentToShared(
    openIncidentPrisma as IncidentWithIncludedWebsite,
  );
}