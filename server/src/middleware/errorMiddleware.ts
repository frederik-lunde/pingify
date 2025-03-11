// server/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

// Optional: Define a custom error interface
interface CustomError extends Error {
  status?: number;
}

const errorMiddleware = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
  console.error(err); // Log the error for debugging

  // Determine the status code and error message
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Optionally, hide error details in production
  res.status(status).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message,
    },
  });
};

export default errorMiddleware;
