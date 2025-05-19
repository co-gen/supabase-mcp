#!/usr/bin/env node

import express, { type Request, type Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { parseArgs } from 'node:util';
import { createSupabaseMcpServer } from './server.js';

// Transport management
const transports: { [sessionId: string]: SSEServerTransport } = {};

// Get configuration from environment variables
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectId = process.env.SUPABASE_PROJECT_ID;
const readOnly = process.env.SUPABASE_READ_ONLY === 'true';
const apiUrl = process.env.SUPABASE_API_URL;
const port = process.env.SUPABASE_PORT || '3000';
const host = process.env.SUPABASE_HOST || 'localhost';

if (!accessToken) {
  console.error('Please set the SUPABASE_ACCESS_TOKEN environment variable');
  process.exit(1);
}

const server = createSupabaseMcpServer({
  platform: {
    accessToken,
    apiUrl,
  },
  projectId,
  readOnly,
});

const app = express();

// SSE endpoint for establishing the connection
app.get('/sse', async (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Create transport
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  
  console.log(`New SSE connection established for session ${transport.sessionId}`);
  
  // Handle transport errors
  if ('on' in transport) {
    (transport as any).on('error', (error: Error) => {
      console.error(`Transport error for session ${transport.sessionId}:`, error);
      delete transports[transport.sessionId];
    });
  }
  
  try {
    await server.connect(transport);
  } catch (error) {
    console.error(`Failed to connect transport for session ${transport.sessionId}:`, error);
    delete transports[transport.sessionId];
    res.end();
    return;
  }
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`Client ${transport.sessionId} disconnected`);
    delete transports[transport.sessionId];
  });
});

// Endpoint for receiving messages from the client
app.post('/messages', async (req: any, res: any) => {
  const sessionId = req.query.sessionId as string;
  
  if (!sessionId) {
    console.warn('Received message without sessionId');
    return res.status(400).json({ error: 'Missing sessionId parameter' });
  }
  
  const transport = transports[sessionId];
  
  if (!transport) {
    console.warn(`No active SSE connection for session ${sessionId}`);
    return res.status(404).json({ error: 'No active SSE connection for this session' });
  }
  
  try {
    await transport.handlePostMessage(req, res);
  } catch (error) {
    console.error(`Error handling message for session ${sessionId}:`, error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
});

// Health check endpoint
app.get('/health', (_: Request, res: Response) => {
  console.debug('Health check request received');
  res.status(200).send('OK');
});

// Start the server
app.listen(parseInt(port, 10), host, () => {
  console.log(`SSE server running at http://${host}:${port}`);
});
