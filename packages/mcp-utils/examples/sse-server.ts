import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '../src/sse-transport.js';

const app = express();

// Enable JSON body parsing
app.use(express.json());

const server = new Server(
  {
    name: 'example-server',
    version: '1.0.0',
  },
  {
    capabilities: {},
  }
);

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
const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 