import { Request, Response, NextFunction } from "express";
import * as IncidentService from "../services/incidentService";
import * as WebsiteService from "../services/websiteService";
import {
  IncidentQueryOptions,
  Incident,
  IncidentCountResponse,
  IncidentType,
  IncidentStatusFilter,
} from "../types";
import { subHours } from "date-fns";


/**
 * Handles the request to get incidents for the authenticated user.
 * Parses query parameters to filter incidents.
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


    const { limit, type, from, to, websiteId, status } = req.query;

    const options: IncidentQueryOptions = {
      limit: limit as number | undefined,
      type: type as IncidentType | undefined,
      from: from as Date | undefined,
      to: to as Date | undefined,
      userId: userId,
      websiteId: websiteId as number | undefined,
      status: status as IncidentStatusFilter | undefined,
    };


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
 * Handles the request to get incidents for a specific website.
 * Ensures the authenticated user has access to the website before fetching incidents.
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


    const websiteId = req.params.websiteId as unknown as number;
    const { limit, type, from, to, status } = req.query;


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
 * Handles the request to get the count of incidents for the authenticated user
 * that occurred in the last 24 hours.
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