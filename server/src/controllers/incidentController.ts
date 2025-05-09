// server/src/controllers/incidentController.ts
import { Request, Response, NextFunction } from "express";
import * as IncidentService from "../services/incidentService";
import * as WebsiteService from "../services/websiteService"; // For access checks
import {
  IncidentQueryOptions,
  Incident,
  IncidentCountResponse,
  IncidentType,
  IncidentStatusFilter,
} from "../types";
import { subHours } from "date-fns";

// --- Controller Functions ---

/**
 * GET /api/incidents/user - Get incidents for websites monitored by the authenticated user.
 * Validation handled by middleware.
 */
export const getUserIncidents = async (
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

    // Access validated query parameters
    const { limit, type, from, to, websiteId, status } = req.query;

    const options: IncidentQueryOptions = {
      limit: limit as number | undefined,
      type: type as IncidentType | undefined,
      from: from as Date | undefined,
      to: to as Date | undefined,
      userId: userId, // Add authenticated user ID
      websiteId: websiteId as number | undefined,
      status: status as IncidentStatusFilter | undefined,
    };

    // Pass userId again for potential name mapping in the service
    const incidents: Incident[] = await IncidentService.getIncidents(
      options,
      userId,
    );
    res.json(incidents);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/incidents/website/:websiteId - Get incidents for a specific website.
 * Validation handled by middleware.
 */
export const getWebsiteIncidents = async (
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
    const { limit, type, from, to, status } = req.query;

    // Access Check
    const hasAccess = await WebsiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
      res.status(404).json({ message: "Website not found or access denied." });
      return;
    }

    const options: IncidentQueryOptions = {
      limit: limit as number | undefined,
      type: type as IncidentType | undefined,
      from: from as Date | undefined,
      to: to as Date | undefined,
      websiteId: websiteId,
      status: status as IncidentStatusFilter | undefined,
    };

    // Pass userId for potential name mapping in the service
    const incidents: Incident[] = await IncidentService.getIncidents(
      options,
      userId,
    );
    res.json(incidents);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/incidents/user/count/last24h - Get count of incidents started in last 24h for user.
 * No specific input validation needed beyond authentication.
 */
export const getUserIncidentCountLast24h = async (
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

    const twentyFourHoursAgo = subHours(new Date(), 24);
    const count = await IncidentService.countIncidents({
      userId: userId,
      from: twentyFourHoursAgo,
    });
    const response: IncidentCountResponse = { incidentCount: count };
    res.json(response);
  } catch (error) {
    next(error);
  }
};
