// server/src/services/incidentService.ts
import {
  Incident as PrismaIncident,
  Prisma,
} from "@prisma/client";
import prisma from "../prisma/prismaClient";
import { differenceInSeconds } from "date-fns";

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

export async function createIncident(
  websiteId: number,
  type: IncidentType,
  confirmedAt: Date, 
  initialResultId?: number | null, 
  confirmingResultId?: number | null, 
): Promise<PrismaIncident | null> {
  const logPrefix = `[IncidentService W:${websiteId} T:${type}]`;
  console.log(
    `${logPrefix} Attempting to create/get incident. Confirmed At: ${confirmedAt.toISOString()}`,
  );

  const existingOpenIncident = await getOpenIncident(websiteId, type);
  if (existingOpenIncident) {
    console.log(
      `${logPrefix} Incident creation skipped: An open incident (ID: ${existingOpenIncident.id}) of type '${type}' already exists. Returning existing.`,
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

export async function updateIncidentConfirmation(
  incidentId: number,
  confirmingResultId: number,
): Promise<PrismaIncident | null> {
  const logPrefix = `[IncidentService I:${incidentId}]`;
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      console.warn(`${logPrefix} UpdateConfirmation failed: Incident not found.`);
      return null;
    }
    if (incident.endTime !== null) {
      console.warn(`${logPrefix} UpdateConfirmation skipped: Incident ${incidentId} is already resolved.`);
      return incident;
    }
     if (incident.confirmingResultId === confirmingResultId) {
      console.log(`${logPrefix} UpdateConfirmation skipped: confirmingResultId already set to ${confirmingResultId}.`);
      return incident;
    }
     if (incident.confirmingResultId !== null && incident.confirmingResultId !== confirmingResultId) {
      console.warn(`${logPrefix} UpdateConfirmation: overwriting existing confirmingResultId ${incident.confirmingResultId} with ${confirmingResultId}.`);
    }


    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        confirmingResultId: confirmingResultId,
      },
    });
    console.log(`${logPrefix} Successfully updated incident with confirmingResultId: ${confirmingResultId}.`);
    return updatedIncident;
  } catch (error) {
    console.error(`${logPrefix} Error updating incident confirmation:`, error);
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") { 
      console.warn(`${logPrefix} UpdateConfirmation failed: Incident not found during update attempt.`);
      return null;
    }
    throw error;
  }
}


export async function resolveIncident(
  incidentId: number,
  resolvedAt: Date,
  resolvingResultId?: number | null, 
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

    const mappedIncidents = incidentsPrisma
      .map((inc) =>
        mapPrismaIncidentToShared(
          inc as IncidentWithIncludedWebsite,
          targetUserIdForName,
        ),
      )
      .filter((inc) => inc !== null) as Incident[];
    return mappedIncidents;
  } catch (error) {
    console.error(`${logPrefix} Error executing Prisma findMany:`, error);
    throw error;
  }
}

/**
 * Counts the number of incidents based on various filter options.
 * Can be scoped by userId, a specific websiteId, or a list of websiteIds.
 */
export async function countIncidents(
  options: IncidentQueryOptions & { websiteIds?: number[] } = {},
): Promise<number> {
  const { type, from, to, userId: optionsUserId, websiteId, status, websiteIds } = options;
  const userId = optionsUserId as string | undefined;

  const whereClause: Prisma.IncidentWhereInput = {};

  if (websiteId !== undefined) { // Specific websiteId takes precedence
    whereClause.websiteId = websiteId;
  } else if (userId !== undefined) { // Then filter by user
    whereClause.website = { websiteUsers: { some: { userId: userId } } };
  } else if (websiteIds && websiteIds.length > 0) { // Then by a list of website IDs
    whereClause.websiteId = { in: websiteIds };
  }

  if (type && VALID_INCIDENT_TYPES.includes(type)) whereClause.type = type;
  
  if (from && to) {
    whereClause.startTime = { gte: from, lte: to };
  } else if (from) {
    whereClause.startTime = { gte: from };
  } else if (to) {
    whereClause.startTime = { lte: to };
  }

  if (status === "open") whereClause.endTime = null;
  else if (status === "closed") whereClause.endTime = { not: null };

  return prisma.incident.count({ where: whereClause });
}

/**
 * Retrieves the most recent incident, optionally filtered by user ID or a list of website IDs.
 */
export async function getMostRecentIncident(
  userId?: string,
  websiteIds?: number[], 
): Promise<PrismaIncident | null> {
  const whereClause: Prisma.IncidentWhereInput = {};
  if (userId) {
    whereClause.website = { websiteUsers: { some: { userId: userId } } };
  } else if (websiteIds && websiteIds.length > 0) {
    whereClause.websiteId = { in: websiteIds };
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