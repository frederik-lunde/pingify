// server/src/controllers/alertController.ts
import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import * as AlertService from "../services/alertService";
import * as WebsiteService from "../services/websiteService";
import {
  AlertType,
  Alert as SharedAlert,
  AlertQueryOptions,
  AlertStats,
} from "../types";

/**
 * Maps a Prisma Alert (potentially with relations) to the shared Alert type.
 * Note: Assumes relations like 'website', 'user', 'incident' might be included based on the service call.
 */
const mapPrismaAlertToShared = (prismaAlert: any): SharedAlert => {
  const sharedAlert: SharedAlert = {
    id: prismaAlert.id,
    websiteId: prismaAlert.websiteId,
    userId: prismaAlert.userId, // userId is string
    type: prismaAlert.type as AlertType,
    message: prismaAlert.message,
    createdAt: prismaAlert.createdAt.toISOString(),
    incidentId: prismaAlert.incidentId ?? undefined,
  };
  if (prismaAlert.website) {
    sharedAlert.website = {
      id: prismaAlert.website.id,
      url: prismaAlert.website.url,
      // Use the user's custom name if available (depends on how service fetched it)
      name: prismaAlert.website.websiteUsers?.[0]?.name ?? undefined,
    };
  }
  if (prismaAlert.user) {
    // Ensure user ID is string
    sharedAlert.user = {
      id: String(prismaAlert.user.id),
      name: prismaAlert.user.name,
    };
  }
  if (prismaAlert.incident) {
    sharedAlert.incident = {
      id: prismaAlert.incident.id,
      startTime: prismaAlert.incident.startTime?.toISOString(),
      endTime: prismaAlert.incident.endTime?.toISOString() ?? null,
    };
  }
  return sharedAlert;
};

// --- Controller Functions ---

/**
 * GET /api/alerts/user - Get *active* alerts for the authenticated user.
 * Validation handled by middleware.
 */
export const getUserAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;

    // Access validated query parameters directly
    const { limit, type, from, to, websiteId } = req.query;

    const options: AlertQueryOptions = {
      // Cast through unknown for validated number/date types
      limit: limit as unknown as number | undefined,
      type: type as AlertType | undefined,
      from: from as unknown as Date | undefined,
      to: to as unknown as Date | undefined,
      websiteId: websiteId as unknown as number | undefined,
    };

    const alerts = await AlertService.getAlertsForUser(userId, options);
    const responseAlerts: SharedAlert[] = alerts.map(mapPrismaAlertToShared);
    res.json(responseAlerts);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/alerts/:alertId - Dismiss (delete) an alert for the user.
 * Validation handled by middleware.
 */
export const dismissAlert = async (
  req: Request<{ alertId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;

    // Access validated alertId (already parsed to int)
    const alertId = req.params.alertId as unknown as number;

    const deletedAlert = await AlertService.dismissAlert(userId, alertId);

    if (deletedAlert === null) {
      res
        .status(404)
        .json({ message: "Alert not found or already dismissed." });
    } else {
      res.status(204).send(); // Success, no content
    }
  } catch (error) {
    // Handle potential 'Forbidden' error from service
    if (error instanceof Error && error.message.includes("Forbidden")) {
      res.status(403).json({ message: error.message });
    } else {
      next(error);
    }
  }
};

/**
 * GET /api/alerts/website/:websiteId - Get *active* alerts for a specific website.
 * Validation handled by middleware.
 */
export const getAlertsByWebsite = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;

    // Access validated params and query
    const websiteId = req.params.websiteId as unknown as number;
    const { limit, type, from, to } = req.query;

    // Access check
    const hasAccess = await WebsiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
      res.status(404).json({ message: "Website not found or access denied." });
      return;
    }

    const options: AlertQueryOptions = {
      // Cast through unknown for validated number/date types
      limit: limit as unknown as number | undefined,
      type: type as AlertType | undefined,
      from: from as unknown as Date | undefined,
      to: to as unknown as Date | undefined,
    };

    const alerts = await AlertService.getAlertsByWebsite(websiteId, options);
    // Note: The service might include user details here, mapPrismaAlertToShared handles it
    const responseAlerts: SharedAlert[] = alerts.map(mapPrismaAlertToShared);
    res.json(responseAlerts);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alerts/user/stats - Get *active* alert statistics for the authenticated user.
 * Validation handled by middleware.
 */
export const getUserAlertStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const userId = req.user.id;

    // --- CORRECTED CAST ---
    const days = req.query.days as unknown as number;

    const stats: AlertStats = await AlertService.getUserAlertStats(
      userId,
      days,
    );
    res.json(stats);
  } catch (error) {
    next(error);
  }
};
