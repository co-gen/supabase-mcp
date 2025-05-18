#!/usr/bin/env node

import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { parseArgs } from 'node:util';
import packageJson from '../package.json' with { type: 'json' };
import { createSupabaseMcpServer } from './server.js';

const { version } = packageJson;

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
    console.log(version);
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

  let transport: SSEServerTransport | null = null;

  // SSE endpoint for establishing the connection
  app.get('/sse', (req, res) => {
    transport = new SSEServerTransport('/messages', res);
    server.connect(transport);
  });

  // Endpoint for receiving messages from the client
  app.post('/messages', (req, res) => {
    if (transport) {
      transport.handlePostMessage(req, res);
    } else {
      res.status(400).json({ error: 'No active SSE connection' });
    }
  });

  // Start the server
  app.listen(parseInt(port, 10), host, () => {
    console.log(`SSE server running at http://${host}:${port}`);
  });
}

main().catch(console.error); 