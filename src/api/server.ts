// server.ts - HTTP API server for React Native client communication

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

import { WorldModel } from '../knowledge/WorldModel.js';
import { AutonomousController } from '../ai/AutonomousController.js';
import { LearningSystem } from '../learning/LearningSystem.js';
import { getDatabaseConfig } from '../config/database.js';
import { Logger } from '../monitoring/Logger.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const logger = Logger.getInstance();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Global instances
let worldModel: WorldModel;
let autonomousController: AutonomousController;

// Active scraping sessions
interface ScrapingSession {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  url: string;
  goal: string;
  startTime: number;
  maxSteps: number;
  timeout: number;
  endTime?: number;
  result?: any;
  error?: string;
  socketId?: string;
}

const activeSessions = new Map<string, ScrapingSession>();

// Initialize components
async function initializeComponents() {
  if (!worldModel) {
    worldModel = new WorldModel(getDatabaseConfig());
    await worldModel.initialize();
  }
  
  if (!autonomousController) {
    const learningSystem = new LearningSystem();
    autonomousController = new AutonomousController(learningSystem);
  }
  
  return { worldModel, autonomousController };
}

// API Routes

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get system status
app.get('/api/status', async (req: Request, res: Response) => {
  try {
    const { worldModel } = await initializeComponents();
    const stats = await worldModel.getStatistics();
    
    res.json({
      success: true,
      data: {
        totalEntities: stats.entities,
        totalRelationships: stats.relationships,
        totalFacts: stats.facts,
        domains: stats.domains,
        activeSessions: activeSessions.size,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get system status', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
});

// Start a new scraping session
app.post('/api/scrape', async (req: Request, res: Response) => {
  try {
    const { url, goal, maxSteps = 10, timeout = 60000 } = req.body;
    
    // Validate input
    if (!url || !goal) {
      return res.status(400).json({
        success: false,
        error: 'URL and goal are required'
      });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }
    
    // Create session
    const sessionId = uuidv4();
    const session: ScrapingSession = {
      sessionId,
      status: 'pending' as const,
      url,
      goal,
      startTime: Date.now(),
      maxSteps,
      timeout
    };
    
    activeSessions.set(sessionId, session);
    
    // Start scraping asynchronously
    processScrapingSession(sessionId).catch(error => {
      logger.error('Scraping session failed', error as Error, { sessionId });
      const session = activeSessions.get(sessionId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.endTime = Date.now();
        
        // Emit error to client
        if (session.socketId) {
          io.to(session.socketId).emit('scraping-error', {
            sessionId,
            error: error.message
          });
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        sessionId,
        status: 'pending',
        message: 'Scraping session started'
      }
    });
    
  } catch (error) {
    logger.error('Failed to start scraping session', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scraping session'
    });
  }
});

// Get session status
app.get('/api/scrape/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      sessionId: session.sessionId,
      status: session.status,
      url: session.url,
      goal: session.goal,
      startTime: session.startTime,
      endTime: session.endTime,
      result: session.result,
      error: session.error,
      duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime
    }
  });
});

// Get recent scraping sessions
app.get('/api/sessions', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const sessions = Array.from(activeSessions.values())
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, limit)
    .map(session => ({
      sessionId: session.sessionId,
      status: session.status,
      url: session.url,
      goal: session.goal,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime,
      hasResult: !!session.result
    }));
  
  res.json({
    success: true,
    data: sessions
  });
});

// Get scraping context for a URL
app.post('/api/context', async (req: Request, res: Response) => {
  try {
    const { url, goal } = req.body;
    
    if (!url || !goal) {
      return res.status(400).json({
        success: false,
        error: 'URL and goal are required'
      });
    }
    
    const { worldModel } = await initializeComponents();
    const context = await worldModel.getScrapingContext(url, goal);
    
    res.json({
      success: true,
      data: context
    });
    
  } catch (error) {
    logger.error('Failed to get scraping context', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scraping context'
    });
  }
});

// Process scraping session
async function processScrapingSession(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  session.status = 'running';
  logger.info('Starting scraping session', { sessionId, url: session.url, goal: session.goal });
  
  // Emit status update
  if (session.socketId) {
    io.to(session.socketId).emit('scraping-status', {
      sessionId,
      status: 'running',
      message: 'Initializing browser...'
    });
  }
  
  let browser;
  let page;
  
  try {
    // Initialize components
    const { worldModel, autonomousController } = await initializeComponents();
    
    // Launch browser
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    
    // Emit progress update
    if (session.socketId) {
      io.to(session.socketId).emit('scraping-status', {
        sessionId,
        status: 'running',
        message: 'Navigating to website...'
      });
    }
    
    // Navigate to URL
    await page.goto(session.url, { waitUntil: 'networkidle' });
    
    // Emit progress update
    if (session.socketId) {
      io.to(session.socketId).emit('scraping-status', {
        sessionId,
        status: 'running',
        message: 'AI is analyzing the page...'
      });
    }
    
    // Execute autonomous scraping
    const result = await autonomousController.executeAutonomousGoal(
      page,
      session.goal,
      session.maxSteps || 10,
      session.timeout || 60000
    );
    
    // Update session
    session.status = result.success ? 'completed' : 'failed';
    session.result = result;
    session.endTime = Date.now();
    session.error = result.success ? undefined : result.reasoning;
    
    // Emit completion
    if (session.socketId) {
      io.to(session.socketId).emit('scraping-complete', {
        sessionId,
        success: result.success,
        result: result,
        duration: session.endTime - session.startTime
      });
    }
    
    logger.info('Scraping session completed', { 
      sessionId, 
      success: result.success,
      duration: session.endTime - session.startTime
    });
    
  } catch (error) {
    session.status = 'failed';
    session.error = error instanceof Error ? error.message : 'Unknown error';
    session.endTime = Date.now();
    
    logger.error('Scraping session failed', error as Error, { sessionId });
    
    // Emit error
    if (session.socketId) {
      io.to(session.socketId).emit('scraping-error', {
        sessionId,
        error: session.error
      });
    }
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });
  
  // Join session room
  socket.on('join-session', (sessionId: string) => {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.socketId = socket.id;
      socket.join(sessionId);
      logger.info('Client joined session', { socketId: socket.id, sessionId });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// Start server
async function startServer() {
  try {
    // Initialize components
    await initializeComponents();
    
    server.listen(PORT, () => {
      logger.info(`CodeSight API server running on port ${PORT}`);
      console.log(`🚀 CodeSight API Server`);
      console.log(`📡 HTTP API: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  if (worldModel) {
    await worldModel.disconnect();
  }
  process.exit(0);
});

// Start the server
startServer();