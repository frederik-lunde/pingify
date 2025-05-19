import {
  Website as PrismaWebsite,
  MonitoringResult as PrismaMonitoringResult,
  Prisma,
} from "@prisma/client";
import prisma from "../prisma/prismaClient";
import { StatsCalculator } from "./monitoringService";
import * as IncidentService from "./incidentService";
import { subDays } from "date-fns";
import { monitoringConfig } from "../config/config";

import {
  AddWebsiteUserDTO,
  Website,
  WebsiteUser,
  UpdateWebsiteUserDTO,
  MonitoringResult as SharedMonitoringResult,
  ChartDataPoint,
  TimeframeKey,
  Incident,
} from "../types";

const DEFAULT_GLOBAL_INTERVAL = monitoringConfig.defaultIntervalSeconds;
const CARD_TIMEFRAME: TimeframeKey = "day";
const MAX_CARD_DATA_POINTS = 24;

/**
 * Maps a Prisma Website object to a shared Website DTO.
 */
const mapPrismaWebsiteToShared = (
  website: PrismaWebsite | null,
): Website | null => {
  if (!website) return null;
  return {
    id: website.id,
    url: website.url,
    isActive: website.isActive,
    lastChecked: website.lastChecked?.toISOString() ?? null,
    globalInterval: website.globalInterval,
    createdAt: website.createdAt?.toISOString() ?? undefined,
    updatedAt: website.updatedAt?.toISOString() ?? undefined,
  };
};

/**
 * Maps a Prisma MonitoringResult object to a basic shared MonitoringResult DTO.
 */
const mapPrismaResultToSharedBasic = (
  prismaResult: PrismaMonitoringResult | null,
): SharedMonitoringResult | null => {
  if (!prismaResult) return null;
  const coreData: Omit<SharedMonitoringResult, "website"> = {
    id: prismaResult.id,
    websiteId: prismaResult.websiteId,
    checkedAt: prismaResult.checkedAt.toISOString(),
    responseTime: prismaResult.responseTime,
    isAvailable: prismaResult.isAvailable,
    statusCode: prismaResult.statusCode,
    errorMessage: prismaResult.errorMessage,
  };
  return coreData as SharedMonitoringResult;
};

/**
 * Maps a Prisma WebsiteUser object  to a shared WebsiteUser DTO.
 */
const mapPrismaWebsiteUserToSharedBase = (
  websiteUser: any,
): WebsiteUser | null => {
  if (!websiteUser) return null;
  const sharedWebsiteNested = websiteUser.website
    ? mapPrismaWebsiteToShared(websiteUser.website)
    : undefined;
  return {
    id: websiteUser.id,
    userId: websiteUser.userId,
    websiteId: websiteUser.websiteId,
    name: websiteUser.name,
    interval: websiteUser.interval,
    alertEnabled: websiteUser.alertEnabled,
    alertThreshold: websiteUser.alertThreshold,
    notifyEmail: websiteUser.notifyEmail,
    createdAt: websiteUser.createdAt.toISOString(),
    isPinned: websiteUser.isPinned,
    website: sharedWebsiteNested ?? undefined,
  };
};

/**
 * Retrieves all websites associated with a user, including their latest monitoring status,
 * chart data, uptime, and current incident.
 */
export async function getWebsitesForUser(
  userId: string,
): Promise<WebsiteUser[]> {
  const websiteUsersPrisma = await prisma.websiteUser.findMany({
    where: { userId: userId },
    include: { website: true },
    orderBy: [{ isPinned: "desc" }, { website: { url: "asc" } }],
  });

  if (websiteUsersPrisma.length === 0) return [];

  const websiteIds = websiteUsersPrisma.map((wu) => wu.websiteId);

  const latestResultsPromises = websiteIds.map((id) =>
    prisma.monitoringResult.findFirst({
      where: { websiteId: id },
      orderBy: { checkedAt: "desc" },
      select: {
        id: true,
        websiteId: true,
        checkedAt: true,
        responseTime: true,
        isAvailable: true,
        statusCode: true,
        errorMessage: true,
      },
    }),
  );
  const latestResultsRaw = (await Promise.all(latestResultsPromises)).filter(
    (r) => r !== null,
  ) as PrismaMonitoringResult[];
  const latestResultMap = new Map<number, SharedMonitoringResult | null>();
  latestResultsRaw.forEach((result) => {
    latestResultMap.set(result.websiteId, mapPrismaResultToSharedBasic(result));
  });

  const openIncidentsPromises = websiteIds.map((id) =>
    IncidentService.getCurrentOpenIncidentForWebsite(id),
  );
  const openIncidents = (await Promise.all(openIncidentsPromises)).filter(
    (inc) => inc !== null,
  ) as Incident[];
  const openIncidentMap = new Map<number, Incident>();
  openIncidents.forEach((incident) => {
    openIncidentMap.set(incident.websiteId, incident);
  });

  const chartDataPromises = websiteIds.map((id) =>
    StatsCalculator.getChartDataForWebsite(id, CARD_TIMEFRAME).then((data) => ({
      websiteId: id,
      chartData: data.slice(-MAX_CARD_DATA_POINTS),
    })),
  );
  const chartDataResults = await Promise.all(chartDataPromises);
  const chartDataMap = new Map<number, ChartDataPoint[]>();
  chartDataResults.forEach((result) => {
    chartDataMap.set(result.websiteId, result.chartData);
  });

  const dailyStartDate = subDays(new Date(), 1);
  const uptimePromises = websiteIds.map((id) =>
    StatsCalculator.calculateUptimeBetweenDates(
      id,
      dailyStartDate,
      new Date(),
    ).then((uptime) => ({ websiteId: id, uptimePercent: uptime })),
  );
  const uptimeResults = await Promise.all(uptimePromises);
  const uptimeMap = new Map<number, number>();
  uptimeResults.forEach((result) => {
    uptimeMap.set(result.websiteId, result.uptimePercent);
  });

  const results: WebsiteUser[] = websiteUsersPrisma
    .map((wuPrisma) => {
      const sharedWu = mapPrismaWebsiteUserToSharedBase(wuPrisma);
      if (!sharedWu) return null;

      sharedWu.latestResult = latestResultMap.get(sharedWu.websiteId) ?? null;
      sharedWu.chartData = chartDataMap.get(sharedWu.websiteId) ?? [];
      sharedWu.uptimePercent = uptimeMap.get(sharedWu.websiteId) ?? 100;
      sharedWu.currentIncident =
        openIncidentMap.get(sharedWu.websiteId) ?? null;

      return sharedWu;
    })
    .filter((wu) => wu !== null) as WebsiteUser[];

  return results;
}

/**
 * Retrieves a specific website associated with a user by its ID.
 */
export async function getUserWebsiteById(
  userId: string,
  websiteId: number,
): Promise<WebsiteUser | null> {
  const userWebsitePrisma = await prisma.websiteUser.findUnique({
    where: { userId_websiteId: { userId: userId, websiteId: websiteId } },
    include: { website: true },
  });
  return mapPrismaWebsiteUserToSharedBase(userWebsitePrisma);
}

/**
 * Updates the global monitoring interval for a website based on the minimum
 * interval set by any user monitoring that website.
 */
export async function updateGlobalInterval(websiteId: number): Promise<void> {
  const websiteUsers = await prisma.websiteUser.findMany({
    where: {
      websiteId: websiteId,
      interval: { not: null, gt: 0 },
    },
    select: { interval: true },
  });

  const intervals = websiteUsers
    .map((wu) => wu.interval)
    .filter((i): i is number => i !== null && i > 0);

  let newGlobalInterval: number;
  if (intervals.length > 0) {
    newGlobalInterval = Math.min(...intervals);
  } else {
    newGlobalInterval = DEFAULT_GLOBAL_INTERVAL;
  }

  const currentWebsite = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { globalInterval: true },
  });

  if (currentWebsite && currentWebsite.globalInterval !== newGlobalInterval) {
    try {
      await prisma.website.update({
        where: { id: websiteId },
        data: { globalInterval: newGlobalInterval },
      });
      console.log(
        `[Interval Update] Updated global interval for website ${websiteId} to ${newGlobalInterval} seconds.`,
      );
    } catch (error) {
      console.error(
        `[Interval Update] Failed to update global interval for website ${websiteId}:`,
        error,
      );
    }
  } else if (!currentWebsite) {
    console.warn(
      `[Interval Update] Website with ID ${websiteId} not found during interval update check.`,
    );
  }
}

/**
 * Checks if a website has any associated users. If not (it's orphaned),
 * it deactivates the website.
 */
export async function checkAndDeactivateWebsiteIfOrphaned(
  websiteId: number,
): Promise<void> {
  const logPrefix = `[Orphan Check W:${websiteId}]`;
  try {
    const remainingUsersCount = await prisma.websiteUser.count({
      where: { websiteId: websiteId },
    });

    console.log(`${logPrefix} Found ${remainingUsersCount} remaining users.`);

    if (remainingUsersCount === 0) {
      const currentWebsite = await prisma.website.findUnique({
        where: { id: websiteId },
        select: { isActive: true },
      });

      if (currentWebsite?.isActive) {
        await prisma.website.update({
          where: { id: websiteId },
          data: { isActive: false },
        });
        console.log(
          `${logPrefix} Deactivated website as it has no more users.`,
        );
      } else if (currentWebsite) {
        console.log(`${logPrefix} Website already inactive.`);
      } else {
        console.warn(
          `${logPrefix} Website not found during deactivation check.`,
        );
      }
    }
  } catch (error) {
    console.error(
      `${logPrefix} Error during orphan check/deactivation:`,
      error,
    );
  }
}

/**
 * Updates the settings for a website associated with a specific user.
 */
export async function updateUserWebsite(
  userId: string,
  websiteId: number,
  data: UpdateWebsiteUserDTO,
): Promise<WebsiteUser | null> {
  const prismaUpdateData: Prisma.WebsiteUserUpdateWithoutUserInput = {};

  if (data.name !== undefined) prismaUpdateData.name = data.name;
  if (data.interval !== undefined) prismaUpdateData.interval = data.interval;
  if (data.alertThreshold !== undefined)
    prismaUpdateData.alertThreshold = data.alertThreshold;
  if (data.notifyEmail !== undefined)
    prismaUpdateData.notifyEmail = data.notifyEmail;
  if (typeof data.alertEnabled === "boolean")
    prismaUpdateData.alertEnabled = data.alertEnabled;
  if (typeof data.isPinned === "boolean")
    prismaUpdateData.isPinned = data.isPinned;

  if (Object.keys(prismaUpdateData).length === 0) {
    console.warn(
      `No update data provided for user ${userId}, website ${websiteId}. Skipping update.`,
    );

    return getUserWebsiteById(userId, websiteId);
  }

  try {
    const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
      where: { userId_websiteId: { userId: userId, websiteId: websiteId } },
      data: prismaUpdateData,
      include: { website: true },
    });

    if (data.interval !== undefined) {
      updateGlobalInterval(websiteId).catch((err) =>
        console.error(
          `[Interval Update Post-UserUpdate] Error updating global interval for website ${websiteId}:`,
          err,
        ),
      );
    }

    return mapPrismaWebsiteUserToSharedBase(updatedWebsiteUserPrisma);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.warn(
        `WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for update.`,
      );
      return null;
    }
    console.error(
      `Error updating user website settings for user ${userId}, website ${websiteId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Sets the pinned status for a website associated with a user.
 */
export async function setPinStatusForUser(
  userId: string,
  websiteId: number,
  isPinned: boolean,
): Promise<WebsiteUser | null> {
  try {
    const updatedWebsiteUserPrisma = await prisma.websiteUser.update({
      where: { userId_websiteId: { userId: userId, websiteId: websiteId } },
      data: { isPinned: isPinned },
      include: { website: true },
    });
    return mapPrismaWebsiteUserToSharedBase(updatedWebsiteUserPrisma);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.warn(
        `WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found for pin update.`,
      );
      return null;
    }
    console.error(
      `Error setting pin status for user ${userId}, website ${websiteId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Adds a new website to a user's dashboard or updates an existing association.
 * It also handles the creation or activation of the global website entry.
 */
export async function addWebsiteToUser(
  userId: string,
  websiteData: AddWebsiteUserDTO,
): Promise<WebsiteUser> {
  if (!websiteData.url || !/^https?:\/\/.+/.test(websiteData.url)) {
    throw new Error("Invalid URL format provided.");
  }

  try {
    const websiteUserPrisma = await prisma.$transaction(async (tx) => {
      const website = await tx.website.upsert({
        where: { url: websiteData.url },
        update: { isActive: true },
        create: {
          url: websiteData.url,
          globalInterval: DEFAULT_GLOBAL_INTERVAL,
          isActive: true,
        },
      });

      const websiteUser = await tx.websiteUser.upsert({
        where: { userId_websiteId: { userId: userId, websiteId: website.id } },
        update: {
          name: websiteData.name,
          interval: websiteData.interval,
          alertThreshold: websiteData.alertThreshold,
          alertEnabled: websiteData.alertEnabled ?? false,
          notifyEmail: websiteData.notifyEmail,
          isPinned: websiteData.isPinned ?? false,
        },
        create: {
          userId: userId,
          websiteId: website.id,
          name: websiteData.name,
          interval: websiteData.interval,
          alertThreshold: websiteData.alertThreshold,
          alertEnabled: websiteData.alertEnabled ?? false,
          notifyEmail: websiteData.notifyEmail,
          isPinned: websiteData.isPinned ?? false,
        },
        include: { website: true },
      });

      updateGlobalInterval(website.id).catch((err) =>
        console.error(
          `[Interval Update Post-Add] Error updating global interval for website ${website.id}:`,
          err,
        ),
      );

      return websiteUser;
    });

    return mapPrismaWebsiteUserToSharedBase(websiteUserPrisma)!;
  } catch (error) {
    console.error(
      `Error in addWebsiteToUser transaction for user ${userId}, URL ${websiteData.url}:`,
      error,
    );

    throw new Error(
      `Failed to add website '${websiteData.url}' to your dashboard.`,
    );
  }
}

/**
 * Removes a website from a user's dashboard. If the website becomes orphaned
 * (no users monitoring it), it is deactivated.
 */
export async function removeWebsiteFromUser(
  userId: string,
  websiteId: number,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.websiteUser.delete({
        where: { userId_websiteId: { userId: userId, websiteId: websiteId } },
      });
      console.log(
        `[User Website] Removed website ${websiteId} from user ${userId}`,
      );

      const remainingUsersCount = await tx.websiteUser.count({
        where: { websiteId: websiteId },
      });

      if (remainingUsersCount === 0) {
        const currentWebsite = await tx.website.findUnique({
          where: { id: websiteId },
          select: { isActive: true },
        });
        if (currentWebsite?.isActive) {
          await tx.website.update({
            where: { id: websiteId },
            data: { isActive: false },
          });
          console.log(
            `[User Website] Deactivated website ${websiteId} as it has no more users.`,
          );
        }
      }
    });

    updateGlobalInterval(websiteId).catch((err) =>
      console.error(
        `[Interval Update Post-Remove] Error updating global interval for website ${websiteId}:`,
        err,
      ),
    );
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.warn(
        `[User Website Removal] WebsiteUser relation for userId ${userId} and websiteId ${websiteId} not found (already removed?). Proceeding with orphan check.`,
      );

      try {
        const remainingUsersCount = await prisma.websiteUser.count({
          where: { websiteId: websiteId },
        });

        if (remainingUsersCount === 0) {
          const currentWebsite = await prisma.website.findUnique({
            where: { id: websiteId },
            select: { isActive: true },
          });
          if (currentWebsite?.isActive) {
            await prisma.website.update({
              where: { id: websiteId },
              data: { isActive: false },
            });
            console.log(
              `[User Website Removal] Deactivated website ${websiteId} after P2025 on user link removal.`,
            );
          }
        }

        updateGlobalInterval(websiteId).catch((err) =>
          console.error(
            `[Interval Update Post-Remove P2025] Error updating global interval for website ${websiteId}:`,
            err,
          ),
        );
      } catch (cleanupError) {
        console.error(
          `[User Website Removal] Error during cleanup check after P2025 for user ${userId}, website ${websiteId}:`,
          cleanupError,
        );
      }
    } else {
      console.error(
        `Error removing website ${websiteId} from user ${userId}:`,
        error,
      );
      throw new Error(
        `Failed to remove website from dashboard (User: ${userId}, Website: ${websiteId}).`,
      );
    }
  }
}

/**
 * Checks if a user has a specific website associated with their account.
 */
export async function hasUserWebsite(
  userId: string,
  websiteId: number,
): Promise<boolean> {
  const count = await prisma.websiteUser.count({
    where: { userId: userId, websiteId: websiteId },
  });
  return count > 0;
}

/**
 * Searches for websites by URL containing the search term.
 */
export async function searchWebsites(
  searchTerm: string,
  limit = 10,
): Promise<Website[]> {
  if (!searchTerm || searchTerm.trim().length < 2) return [];
  const websitesPrisma = await prisma.website.findMany({
    where: { url: { contains: searchTerm } },
    take: limit,
    orderBy: { url: "asc" },
  });
  return websitesPrisma.map((w) => mapPrismaWebsiteToShared(w)!);
}
