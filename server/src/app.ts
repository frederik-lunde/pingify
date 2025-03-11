import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import testRoutes from './routes/testRoutes';
import errorMiddleware from './middleware/errorMiddleware';

const app = express();

// Global middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Your API routes
app.use('/api/users', userRoutes);
app.use('/api', testRoutes);

// Global error handler (should be the last middleware)
app.use(errorMiddleware);

export default app;
