// server/src/app.ts
import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes';


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
// app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Global error handler (should be the last middleware)
//app.use(errorMiddleware);

export default app;
