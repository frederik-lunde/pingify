
**12. Update Server Entry Point (e.g., `server/src/server.ts` or `app.ts`)**

Register the new incident routes.

```typescript
// Example: server/src/server.ts (adjust path/structure as needed)
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorMiddleware';
import { authenticateTokenOptional } from './middleware/authMiddleware'; // Or your auth middleware

// Import Routes
import authRoutes from './routes/authRoutes';
import websiteRoutes from './routes/websiteRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import alertRoutes from './routes/alertRoutes';
import incidentRoutes from './routes/incidentRoutes'; // Import new incident routes
import { scheduleMonitoring } from './utils/scheduler'; // Import scheduler

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors()); // Configure CORS appropriately for production
app.use(morgan('dev')); // Logging
app.use(express.json()); // Body parsing

// Optional Authentication (applied before specific routes need it)
app.use(authenticateTokenOptional); // Makes req.user available if token exists

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/websites', websiteRoutes); // Requires auth via authenticate middleware inside routes
app.use('/api/monitoring', monitoringRoutes); // Requires auth via authenticate middleware inside routes
app.use('/api/alerts', alertRoutes); // Requires auth via authenticate middleware inside routes
app.use('/api/incidents', incidentRoutes); // Requires auth via authenticate middleware inside routes // Register new routes

// Root/Health Check
app.get('/', (req, res) => {
  res.send(`Pingify API is running! User: ${req.user ? req.user.email : 'Guest'}`);
});

// Error Handling Middleware (Must be last)
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // Initialize and start cron jobs
  scheduleMonitoring();
});

export default app; // Export for testing or other purposes
```

**Summary of Changes:**

1.  **Database:** Added `Incident` model with relations.
2.  **Types:** Added `Incident`, `IncidentQueryOptions`, `IncidentType`. Updated `WebsiteUser`, `WebsiteDetailsData`, `OverallStats`, `WebsiteStatsData`. Removed `DownWebsite`, `DowntimeInfo`.
3.  **IncidentService:** Created service to manage incident lifecycle (create, resolve, query).
4.  **AlertService:** Refactored heavily.
    *   Added `handleResultProcessing` to check for recoveries and potential incidents after each check.
    *   Removed old `handlePotentialAlertCondition`.
    *   Modified recheck logic (`scheduleIncidentConfirmationCheck`, `handleIncidentConfirmation`) to confirm *incidents* first, then trigger alerts if needed.
    *   Added `dismissAlertsByType` for recovery cleanup.
5.  **MonitoringService:**
    *   `checkWebsite` now calls `handleResultProcessing` after saving a result.
    *   `StatsCalculator` updated: removed redundant functions, `getWebsiteStats` and `getOverallStats` now use the `Incident` table for incident counts/data.
6.  **WebsiteService:** `getWebsitesForUser` now fetches and includes `currentIncident`.
7.  **IncidentController:** Created controller for incident-related API endpoints.
8.  **IncidentRoutes:** Created routes file for the incident controller.
9.  **MonitoringController:** Removed old incident count endpoint, updated `getWebsiteDetails` to include incident data.
10. **MonitoringRoutes:** Removed old incident count/down website endpoints.
11. **AlertController/Routes:** Remain focused on user alerts, old incident count route removed.
12. **Server Entry:** Registered new `incidentRoutes`.

This structure separates the tracking of actual website incidents (`Incident` model and service) from user-specific notifications about those incidents (`Alert` model and service), providing a more robust and scalable approach. Remember to replace the `setTimeout` in `alertService` with a proper queue system for production reliability.