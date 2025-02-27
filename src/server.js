import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();
const app = express();
const port = 3001;
app.use(cors())

app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.users.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});