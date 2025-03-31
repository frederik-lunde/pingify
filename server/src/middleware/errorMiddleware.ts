// server/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
// Assuming CustomError has status and potentially an 'origin' or 'type' property
interface CustomError extends Error {
    status?: number;
    // Add other properties if your errors have them (e.g., code, field)
}

const errorMiddleware = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
  // Log the original, detailed error for server-side debugging FIRST
  console.error(`Error caught: [${req.method}] ${req.originalUrl} - Status: ${err.status || 'N/A'} - Message: ${err.message}`, err.stack);

  let statusCode = err.status || 500;
  let responseMessage = err.message || 'An unexpected error occurred.'; // Start with the original message or default

  // --- Centralized Message & Status Mapping ---
  // Use specific error codes or types if available, otherwise rely on message matching
  // Example: if (err.code === 'INVALID_CREDENTIALS')
  if (err.message === 'Invalid credentials') {
      statusCode = 401;
      responseMessage = 'Invalid email or password.'; // Final user message
  } else if (err.message === 'User with this email already exists') {
      statusCode = 409; // Conflict
      responseMessage = 'An account with this email already exists.'; // Final user message
  } else if (err.message === 'Invalid token' || err.message === 'No token provided' || err.message === 'jwt expired') { // Handle various token issues
      statusCode = 401;
      responseMessage = 'Your session is invalid or has expired. Please log in again.'; // Final user message
  }
  // Add more mappings for validation errors, not found errors, etc.
  // else if (err.name === 'ValidationError') { statusCode = 400; responseMessage = 'Invalid input data.'; }
  // else if (err.name === 'NotFoundError') { statusCode = 404; responseMessage = 'Resource not found.'; }

  // --- Production Safety Net for 500s ---
  // For truly unexpected internal errors, hide details in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
      responseMessage = 'An internal server error occurred. Please try again later.';
  }

  // --- Send Consistent JSON Response ---
  res.status(statusCode).json({
      // Keep the nested structure as the frontend expects it
      error: {
          message: responseMessage,
          // Optionally include an error code if useful for the frontend
          // code: err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR')
      },
      // Optionally include a timestamp or request ID
      // timestamp: new Date().toISOString(),
      // requestId: req.id // if using request ID middleware
  });
};

export default errorMiddleware;