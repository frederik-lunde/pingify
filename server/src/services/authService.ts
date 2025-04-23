// src/services/authService.ts
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'; // Removed JwtPayload import unless needed elsewhere
import { LoginCredentials, RegisterUserData } from '../types';
import prisma from '../prisma/prismaClient'; // Adjust the path if needed
import { securityConfig } from '../config/config'; // Import the validated config

const JWT_SECRET = securityConfig.jwtSecret;
const SALT_ROUNDS = 10;

export async function registerUser(data: RegisterUserData): Promise<{ user: Omit<User, 'password'>, token: string }> {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name
    }
  });

  const token = generateToken(user.id);
  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

export async function loginUser(credentials: LoginCredentials): Promise<{ user: Omit<User, 'password'>, token: string }> {
  const user = await prisma.user.findUnique({ where: { email: credentials.email } });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken(user.id);
  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// Use the improved type guard for verifyToken
export function verifyToken(token: string): { userId: number } {
  try {
    // Verify the token - the return type is string | object | JwtPayload
    const decoded = jwt.verify(token, JWT_SECRET); // JWT_SECRET is known to be a string

    // **Type Guard**: Check if the decoded payload is an object and has the userId property
    if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded && typeof decoded.userId === 'number') {
      // Now TypeScript knows decoded has userId: number within this block
      return { userId: decoded.userId };
    } else {
      throw new Error('Invalid token payload structure');
    }

  } catch (error: any) { // Catch errors from jwt.verify (expired, bad signature, etc.) OR our custom errors
    console.error("Token verification failed:", error.message || error); // Log the actual error message
    // Provide a more generic error to the caller
    throw new Error('Invalid or expired token');
  }
}