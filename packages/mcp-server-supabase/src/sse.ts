#!/usr/bin/env node

import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { parseArgs } from 'node:util';
import { createSupabaseMcpServer } from './server.js';
import type { Request, Response } from 'express';

async function main() {
  const {
    values: { ['version']: showVersion },
  } = parseArgs({
    options: {
      ['version']: {
        type: 'boolean',
      },
    },
  });

  if (showVersion) {
    process.exit(0);
  }

  // Get configuration from environment variables
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const readOnly = process.env.SUPABASE_READ_ONLY === 'true';
  const apiUrl = process.env.SUPABASE_API_URL;
  const port = process.env.SUPABASE_PORT || '3000';
  const host = process.env.SUPABASE_HOST || 'localhost';

  if (!accessToken) {
    console.error(
      'Please set the SUPABASE_ACCESS_TOKEN environment variable'
    );
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
  app.use(express.json());

  let connections = new Map<string, SSEServerTransport>();
  
  // SSE endpoint for establishing the connection
  app.get('/sse', (req: Request, res: Response) => {
    const clientId = req.query.clientId?.toString() || Date.now().toString();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const transport = new SSEServerTransport('/messages', res);
    connections.set(clientId, transport);
    server.connect(transport);
    
    req.on('close', () => {
      connections.delete(clientId);
    });
  });

  // Endpoint for receiving messages from the client
  app.post('/messages', (req: any, res: any) => {
    const clientId = req.query.clientId?.toString();
    
    if (!clientId) {
      return res.status(400).json({ error: 'Missing clientId parameter' });
    }
    
    const transport = connections.get(clientId);
    
    if (transport) {
      transport.handlePostMessage(req, res);
    } else {
      res.status(400).json({ error: 'No active SSE connection for this client' });
    }
  });

  // Start the server
  app.listen(parseInt(port, 10), host, () => {
    console.log(`SSE server running at http://${host}:${port}`);
  });
}

main().catch(console.error); 