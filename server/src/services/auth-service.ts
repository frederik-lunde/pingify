import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'b0fd5b5063b01700bb0f13d45f37de17e0c72e1a274cfc3f29df3769c289ae7a'; // Use environment variable in production
const SALT_ROUNDS = 10;

export interface RegisterUserData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function registerUser(data: RegisterUserData): Promise<{ user: Omit<User, 'password'>, token: string }> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name
    }
  });

  // Generate token
  const token = generateToken(user.id);

  // Return user (without password) and token
  const { password, ...userWithoutPassword } = user;
  return { 
    user: userWithoutPassword, 
    token 
  };
}

export async function loginUser(credentials: LoginCredentials): Promise<{ user: Omit<User, 'password'>, token: string }> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: credentials.email }
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Generate token
  const token = generateToken(user.id);

  // Return user (without password) and token
  const { password, ...userWithoutPassword } = user;
  return { 
    user: userWithoutPassword, 
    token 
  };
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { userId: number } {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch (error) {
    throw new Error('Invalid token');
  }
}