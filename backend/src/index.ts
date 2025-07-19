import "reflect-metadata";
import express from 'express';
import cors from 'cors'; // Import cors
import { AppDataSource } from './database/data-source';
import tradeRoutes from './routes/tradeRoutes'; // Import our new routes
import configurationRoutes from './routes/configurationRoutes';
import optimizationRoutes from './routes/optimizationRoutes';
import resultRoutes from './routes/resultRoutes';
import archiveRoutes from './routes/archiveRoutes';
import tagRoutes from './routes/tagRoutes';

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Use cors
app.use(express.json({ limit: '50mb' })); // Increase body limit and use express.json

// API Routes
app.use('/api/trades', tradeRoutes); // Use the trade routes for any /api/trades path
app.use('/api/configurations', configurationRoutes);
app.use('/api/optimize', optimizationRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/archive', archiveRoutes); // Add this
app.use('/api/tags', tagRoutes);

// A simple test route
app.get('/', (req, res) => {
    res.send('Hello from the DAX Optimizer Backend!');
});

// Initialize database connection and start the server
AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
        app.listen(port, () => {
            console.log(`Server is running at http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error("Error during Data Source initialization:", err);
    });