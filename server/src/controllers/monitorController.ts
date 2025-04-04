import { PrismaClient, Prisma } from '@prisma/client'; // Import Prisma Client and types
import { Request, Response, NextFunction } from 'express';
import { ResultsManager, WebsiteMonitor, StatsCalculator } from '../services/monitoringService';
import * as websiteService from '../services/websiteService';
import { WebsiteDetailsData, TimeframeKey} from '../types'; // Ensure UserWebsite is imported
import prisma from '../prisma/prismaClient'; // Adjust the path if needed

// Helper to get start date based on timeframe
const getStartDateForTimeframe = (timeframe: TimeframeKey): Date => {
    const now = new Date();
    switch (timeframe) {
        case 'hour':
            now.setHours(now.getHours() - 1);
            break;
        case 'day':
        default:
            now.setDate(now.getDate() - 1);
            break;
        case 'week':
            now.setDate(now.getDate() - 7);
            break;
        case 'month':
            // Use a more accurate month calculation if needed, this is approx 30 days
            now.setDate(now.getDate() - 30);
            break;
        case 'year':
            // Approximately last year
            now.setFullYear(now.getFullYear() - 1);
            break;
    }
    return now;
};


/**
 * Get all monitoring results with optional filtering (Admin)
 */
export const getAllResults = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = '100', from, to } = req.query;

    const results = await ResultsManager.getAllResults({
      limit: parseInt(limit as string, 10),
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring results for the current user
 */
export const getUserResults = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id; // Assumes authenticate middleware sets req.user
    const { limit = '100', from, to } = req.query;

    const results = await ResultsManager.getResultsForUser(
      userId,
      {
        limit: parseInt(limit as string, 10),
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      }
    );

    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring results for a specific website (requires user access)
 */
export const getResultsByWebsite = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId: websiteIdParam } = req.params;
    const { limit = '100', from, to } = req.query;
    const userId = req.user!.id; // Assumes authenticate middleware sets req.user

    const websiteId = parseInt(websiteIdParam, 10);
     if (isNaN(websiteId) || websiteId <= 0) {
        res.status(400).json({ message: 'Invalid Website ID format.' });
        return;
    }

    // Check if the user has access to this website
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
    }

    const results = await ResultsManager.getFilteredResultsByWebsite(
      websiteId,
      {
        limit: parseInt(limit as string, 10),
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined
      }
    );

    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger an immediate check for a website (requires user access)
 */
export const triggerWebsiteCheck = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId: websiteIdParam } = req.params;
    const userId = req.user!.id; // Assumes authenticate middleware sets req.user

    const websiteId = parseInt(websiteIdParam, 10);
     if (isNaN(websiteId) || websiteId <= 0) {
        res.status(400).json({ message: 'Invalid Website ID format.' });
        return;
    }

    // Check if the user has access to this website
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
    }

    const website = await websiteService.getWebsiteById(websiteId);

    if (!website) {
      // Should not happen if hasUserWebsite passed, but check anyway
      res.status(404).json({ message: 'Website core data not found.' });
      return;
    }

    // Run the check (this is async, but we don't necessarily need to wait for it)
    WebsiteMonitor.checkWebsite(website);

    // Respond immediately to the user
    res.json({ message: 'Check triggered successfully. Results will update shortly.' });

  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for all websites (Admin)
 */
export const getOverallStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = 'week' } = req.query; // Use timeframe keys like 'day', 'week'

    const stats = await StatsCalculator.getOverallStats(
      undefined, // No specific user ID for admin view
      period as string // Cast, maybe add validation later
    );

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for current user's websites
 */
export const getUserStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id; // Assumes authenticate middleware sets req.user
    const { period = 'week' } = req.query; // Use timeframe keys

    const stats = await StatsCalculator.getUserDashboardStats(
      userId,
      period as string // Cast, maybe add validation
    );

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get monitoring statistics for a specific website (requires user access)
 */
export const getWebsiteStats = async (
  req: Request<{ websiteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { websiteId: websiteIdParam } = req.params;
    const userId = req.user!.id; // Assumes authenticate middleware sets req.user
    const { period = 'week' } = req.query; // Use timeframe keys

     const websiteId = parseInt(websiteIdParam, 10);
     if (isNaN(websiteId) || websiteId <= 0) {
        res.status(400).json({ message: 'Invalid Website ID format.' });
        return;
    }

    // Check if the user has access to this website
    const hasAccess = await websiteService.hasUserWebsite(userId, websiteId);
    if (!hasAccess) {
        res.status(404).json({ message: 'Website not found or access denied.' });
        return;
    }

    const stats = await StatsCalculator.getWebsiteStats(
      websiteId,
      userId, // Pass user ID to get user-specific name if available
      period as string // Cast, maybe add validation
    );

    res.json(stats);
  } catch (error) {
    next(error);
  }
};


/**
 * NEW: Get comprehensive details for a specific website view (requires user access)
 */
export const getWebsiteDetails = async (
    req: Request<{ websiteId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { websiteId: websiteIdParam } = req.params;
        const userId = req.user!.id; // Assumes authenticate middleware sets req.user

        // Validate and parse parameters
        const websiteId = parseInt(websiteIdParam, 10);
        if (isNaN(websiteId) || websiteId <= 0) {
            res.status(400).json({ message: 'Invalid Website ID format.' });
            return;
        }

        // Get query params from frontend hook call
        const timeframe = (req.query.timeframe as TimeframeKey) || 'day';
        const limit = parseInt(req.query.limit as string, 10) || 25;
        // Ensure sortBy has a correct type matching allowed frontend values
        const sortBy = (req.query.sortBy as 'timestamp' | 'isAvailable' | 'statusCode' | 'responseTime') || 'timestamp';
        const sortDir = (req.query.sortDir as 'asc' | 'desc') || 'desc';

        // 1. Check User Access & Get Basic Website Info (includes nested website)
        // Ensure websiteService.getUserWebsiteById returns the correct UserWebsite type
        const userWebsite = await websiteService.getUserWebsiteById(userId, websiteId);
        if (!userWebsite || !userWebsite.website) { // Check existence of nested property
            res.status(404).json({ message: 'Website not found or access denied.' });
            return;
        }

        // 2. Prepare date range for charts/uptime
        const startDate = getStartDateForTimeframe(timeframe);

        // 3. Define Sorting for Recent Checks list using Prisma's OrderBy type array
        let orderByClause: Prisma.MonitoringResultOrderByWithRelationInput[] = []; // Initialize as array

        // Determine primary sort condition
        let primarySort: Prisma.MonitoringResultOrderByWithRelationInput = {};
        switch (sortBy) {
            case 'isAvailable':
                primarySort = { isAvailable: sortDir };
                break;
            case 'statusCode':
                // Prisma handles null sorting, might need explicit nulls first/last if default isn't desired
                primarySort = { statusCode: sortDir };
                break;
            case 'responseTime':
                primarySort = { responseTime: sortDir };
                break;
            case 'timestamp': // Default case uses the 'timestamp' value from query/state
            default:
                primarySort = { checkedAt: sortDir }; // Sort by the actual DB field 'checkedAt'
                break;
        }
        orderByClause.push(primarySort); // Add primary sort to the array

        // Add secondary sort by timestamp if the primary sort wasn't timestamp itself
        if (sortBy !== 'timestamp') { // Compare with the query parameter value
            orderByClause.push({ checkedAt: 'desc' }); // Add secondary sort (newest first among equals)
        }

        // 4. Fetch Data in Parallel
        const [latestResult, chartData, recentChecks, uptimePercent] = await Promise.all([
            // Latest Result (fetch only 1, ordered desc by default in service if no options given)
            ResultsManager.getFilteredResultsByWebsite(websiteId, { limit: 1 })
                .then(results => results[0] ?? null), // Take the first or null

            // Chart Data (all results within timeframe, sorted chronologically ASC for charts)
            ResultsManager.getFilteredResultsByWebsite(websiteId, {
                from: startDate,
                limit: 1500, // Fetch a generous amount for charts; adjust based on expected check frequency
            }).then(results => results.sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())), // Client expects time ascending for charts

            // Recent Checks (limited and sorted as requested by the specific orderBy array)
            prisma.monitoringResult.findMany({ // Use imported prisma instance
                 where: { websiteId: websiteId },
                 orderBy: orderByClause, // Apply the constructed orderBy array
                 take: limit,
            }),

            // Uptime Percentage (calculated over the timeframe)
            StatsCalculator.calculateUptime(websiteId, Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))), // Calculate days roughly
        ]);

        // 5. Construct Response Payload matching the Frontend Type `WebsiteDetailsData`
        const responseData: WebsiteDetailsData = {
            websiteId: userWebsite.websiteId,
            name: userWebsite.name || userWebsite.website.url, // Access nested `website` OK due to correct type
            url: userWebsite.website.url,                     // Access nested `website` OK
            latestResult: latestResult,
            chartData: chartData, // Already sorted ascending by time
            recentChecks: recentChecks, // Already sorted by user preference via orderByClause
            uptimePercent: uptimePercent,
        };

        res.json(responseData);

    } catch (error) {
        console.error(`Error fetching website details for ID ${req.params.websiteId}:`, error); // Log the specific error
        next(error); // Pass to global error handling middleware
    }
};