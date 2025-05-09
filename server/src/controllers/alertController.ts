import { Request, Response, NextFunction } from "express";
import * as AlertService from "../services/alertService";
import * as WebsiteService from "../services/websiteService";
import {
  AlertType,
  Alert as SharedAlert,
  AlertQueryOptions,
  AlertStats,
} from "../types";


const mapPrismaAlertToShared = (prismaAlert: any): SharedAlert => {
  const sharedAlert: SharedAlert = {
    id: prismaAlert.id,
    websiteId: prismaAlert.websiteId,
    userId: prismaAlert.userId,
    type: prismaAlert.type as AlertType,
    message: prismaAlert.message,
    createdAt: prismaAlert.createdAt.toISOString(),
    incidentId: prismaAlert.incidentId ?? undefined,
  };
  if (prismaAlert.website) {
    sharedAlert.website = {
      id: prismaAlert.website.id,
      url: prismaAlert.website.url,

      name: prismaAlert.website.websiteUsers?.[0]?.name ?? undefined,
    };
  }
  if (prismaAlert.user) {

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


/**
 * Handles the request to get alerts for the authenticated user.
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


    const { limit, type, from, to, websiteId } = req.query;

    const options: AlertQueryOptions = {

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
 * Handles the request to dismiss (delete) an alert for the authenticated user.
 * Ensures the user owns the alert.
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


    const alertId = req.params.alertId as unknown as number;

    const deletedAlert = await AlertService.dismissAlert(userId, alertId);

    if (deletedAlert === null) {
      res
        .status(404)
        .json({ message: "Alert not found or already dismissed." });
    } else {
      res.status(204).send();
    }
  } catch (error) {

    if (error instanceof Error && error.message.includes("Forbidden")) {
      res.status(403).json({ message: error.message });
    } else {
      next(error);
    }
  }
};

/**
 * Handles the request to get alerts for a specific website.
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


    const websiteId = req.params.websiteId as unknown as number;
    const { limit, type, from, to } = req.query;


    const hasAccess = await WebsiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
      res.status(404).json({ message: "Website not found or access denied." });
      return;
    }

    const options: AlertQueryOptions = {

      limit: limit as unknown as number | undefined,
      type: type as AlertType | undefined,
      from: from as unknown as Date | undefined,
      to: to as unknown as Date | undefined,
    };

    const alerts = await AlertService.getAlertsByWebsite(websiteId, options);

    const responseAlerts: SharedAlert[] = alerts.map(mapPrismaAlertToShared);
    res.json(responseAlerts);
  } catch (error) {
    next(error);
  }
};

/**
 * Handles the request to get alert statistics for the authenticated user.
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