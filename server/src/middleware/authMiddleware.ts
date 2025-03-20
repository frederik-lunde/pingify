import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth-service';

// Extend the Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: number };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  // console.log('Authentication headers:', req.headers);
  // console.log('Authorization header:', req.headers.authorization);
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required' });
      return; 
    }
    
    const token = authHeader.split(' ')[1];
    const { userId } = verifyToken(token);
    
    // Add user ID to request object
    req.user = { id: userId };
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return; 
  }
};