import { User } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { LoginCredentials, RegisterUserData } from "../types";
import prisma from "../prisma/prismaClient";
import { securityConfig } from "../config/config";

const JWT_SECRET = securityConfig.jwtSecret;
const SALT_ROUNDS = 10;



type UserWithoutPassword = Omit<User, "password">;

/**
 * Registers a new user.
 */
export async function registerUser(
  data: RegisterUserData,
): Promise<{ user: UserWithoutPassword; token: string }> {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
    },
  });

  const token = generateToken(user.id);
  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

/**
 * Logs in an existing user.
 */
export async function loginUser(
  credentials: LoginCredentials,
): Promise<{ user: UserWithoutPassword; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
  });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(
    credentials.password,
    user.password,
  );
  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken(user.id);
  const { password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

/**
 * Generates a JWT for a given user ID.
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
}

/**
 * Verifies a JWT and returns the decoded user ID.
 */
export function verifyToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);


    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded &&
      typeof decoded.userId === "string"
    ) {
      return { userId: decoded.userId };
    } else {
      throw new Error("Invalid token payload structure");
    }
  } catch (error: any) {
    console.error("Token verification failed:", error.message || error);
    throw new Error("Invalid or expired token");
  }
}