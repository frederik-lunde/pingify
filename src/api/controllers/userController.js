import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getUsers = async (req, res) => {
    try {
        const users = await prisma.users.findMany();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Error fetching users" });
    }
    }

const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.users.findUnique({
            where: {
                id: parseInt(id),
            },
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Error fetching user" });
    }
}

const createUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.users.create({
            data: {
                username,
                password,
            },
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Error creating user" });
    }
}
export default { getUsers, getUserById, createUser };