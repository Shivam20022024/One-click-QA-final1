import 'dotenv/config';

import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';

const PORT = process.env.PORT || 8080;

process.on('uncaughtException', (err) => {
  console.error('[Global] Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Global] Unhandled Rejection at:', promise, 'reason:', reason);
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

import { initExecutionWorker } from './queue/executionWorker';

app.set('io', io);

// Initialize BullMQ background worker
initExecutionWorker(io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (executionId: string) => {
    socket.join(executionId);
    console.log(`TELEMETRY_CONNECTED: Socket ${socket.id} subscribed to execution ${executionId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Novalantis Backend running on port ${PORT}`);
});

