// server/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../types';

const errorMiddleware = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
  console.error(err); // Log the error for debugging

  // Map specific error messages to status codes
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle auth service errors
  if (err.message === 'Invalid credentials') {
    status = 401;
    message = 'Invalid email or password';
  } else if (err.message === 'User with this email already exists') {
    status = 409;
    message = 'An account with this email already exists';
  } else if (err.message === 'Invalid token') {
    status = 401;
    message = 'Your session has expired. Please login again.';
  }

  // Respond with appropriate status and message
  res.status(status).json({
    error: {
      message: process.env.NODE_ENV === 'production' && status === 500 
        ? 'Something went wrong' 
        : message,
    },
  });
};

export default errorMiddleware;