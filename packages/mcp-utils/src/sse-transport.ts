import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';

/**
 * An MCP transport built on top of Server-Sent Events (SSE).
 * It uses Express.js to handle HTTP requests and responses.
 */
export class SSEServerTransport implements Transport {
  #response: Response;
  #messagePath: string;
  #onMessage?: (message: JSONRPCMessage) => void;
  #onClose?: () => void;
  #onError?: (error: Error) => void;

  constructor(messagePath: string, response: Response) {
    this.#response = response;
    this.#messagePath = messagePath;

    // Set up SSE headers
    this.#response.setHeader('Content-Type', 'text/event-stream');
    this.#response.setHeader('Cache-Control', 'no-cache');
    this.#response.setHeader('Connection', 'keep-alive');

    // Handle client disconnect
    this.#response.on('close', () => {
      this.#onClose?.();
    });
  }

  /**
   * Handles incoming POST messages from the client.
   */
  handlePostMessage(req: Request, res: Response) {
    try {
      const message = req.body as JSONRPCMessage;
      this.#onMessage?.(message);
      res.status(200).end();
    } catch (error) {
      this.#onError?.(error instanceof Error ? error : new Error(String(error)));
      res.status(400).end();
    }
  }

  async start() {
    // Send initial connection message
    this.#response.write('event: connected\ndata: {}\n\n');
  }

  async send(message: JSONRPCMessage) {
    this.#response.write(`data: ${JSON.stringify(message)}\n\n`);
  }

  async close() {
    this.#response.end();
    this.#onClose?.();
  }

  set onmessage(callback: (message: JSONRPCMessage) => void) {
    this.#onMessage = callback;
  }

  set onclose(callback: () => void) {
    this.#onClose = callback;
  }

  set onerror(callback: (error: Error) => void) {
    this.#onError = callback;
  }
} 