// server/src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Basic body validation can happen here or via middleware (e.g., express-validator)
    const { email, password, name } = req.body;
    if (!email || !password) {
         res.status(400).json({ message: 'Email and password are required.' });
         return;
    }

    const result = await authService.registerUser({ email, password, name });
    res.status(201).json(result);
  } catch (error) {
    // Handles 'User exists' (409) or other errors via middleware
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
     // Basic body validation
    const { email, password } = req.body;
    if (!email || !password) {
         res.status(400).json({ message: 'Email and password are required.' });
         return;
    }

    const result = await authService.loginUser({ email, password });
    res.json(result);
  } catch (error) {
    // Handles 'Invalid credentials' (401) or other errors via middleware
    next(error);
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Auth middleware should already place req.user
    if (!req.user) {
      // This case should technically be caught by `authenticate` middleware first
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      // If user existed during token validation but not now (edge case)
      res.status(404).json({ message: 'User associated with token not found.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    // Handles DB errors or unexpected issues via middleware
    next(error);
  }
};