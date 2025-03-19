import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateUserBody {
  username: string;
  password: string;
}

export const getUsers = async () => {
  return await prisma.user.findMany();
};

export const getUserById = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id: parseInt(id, 10) },
  });
};

export const createUser = async (data: CreateUserBody) => {
  return await prisma.user.create({
    data: {
      email: data.username,
      password: data.password,
    },
  });
};
