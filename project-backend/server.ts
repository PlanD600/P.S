import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { errorHandler } from './src/middleware/error.middleware';

// Import routes
import authRoutes from './src/api/auth/auth.routes';
import usersRoutes from './src/api/users/users.routes';
import teamsRoutes from './src/api/teams/teams.routes';
import projectsRoutes from './src/api/projects/projects.routes';
import tasksRoutes from './src/api/tasks/tasks.routes';
import financesRoutes from './src/api/finances/finances.routes';
import bootstrapRoutes from './src/api/bootstrap/bootstrap.routes';


// Load environment variables from .env file
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // To parse JSON bodies

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/bootstrap', bootstrapRoutes);


// A simple health check endpoint
app.get('/api', (req: Request, res: Response) => {
  res.send('Smart Project Manager API is running!');
});

// Central Error Handler
app.use(errorHandler);
