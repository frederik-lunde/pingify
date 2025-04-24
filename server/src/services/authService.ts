// src/services/authService.ts
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { LoginCredentials, RegisterUserData } from '../types'; // Assuming User type here might need update if not from Prisma directly
import prisma from '../prisma/prismaClient';
import { securityConfig } from '../config/config';

const JWT_SECRET = securityConfig.jwtSecret;
const SALT_ROUNDS = 10;

// Define UserWithoutPassword based on Prisma's User model
// If you have a shared types file, ensure the User type there reflects id: string
type UserWithoutPassword = Omit<User, 'password'>;

export async function registerUser(data: RegisterUserData): Promise<{ user: UserWithoutPassword, token: string }> {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
  // Prisma now generates a CUID for the id automatically
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name
    }
  });

  const token = generateToken(user.id); // Pass the string ID
  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

export async function loginUser(credentials: LoginCredentials): Promise<{ user: UserWithoutPassword, token: string }> {
  const user = await prisma.user.findUnique({ where: { email: credentials.email } });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken(user.id); // Pass the string ID
  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

// Changed userId type to string
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// Changed expected userId type to string
export function verifyToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Type Guard: Check if the decoded payload is an object and has the userId property of type string
    if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded && typeof decoded.userId === 'string') {
      return { userId: decoded.userId };
    } else {
      throw new Error('Invalid token payload structure');
    }

  } catch (error: any) {
    console.error("Token verification failed:", error.message || error);
    throw new Error('Invalid or expired token');
  }
}