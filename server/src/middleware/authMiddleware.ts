import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService'; 


declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string; 
      };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      
      res.status(401).json({ message: 'Authentication required: Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];

    
    const { userId } = verifyToken(token); 

    
    req.user = { id: userId };

    next(); 
  } catch (error: any) { 
    
    console.error("Authentication error:", error.message);
    
    res.status(401).json({ message: error.message || 'Invalid or expired token' }); 
    return;
  }
};