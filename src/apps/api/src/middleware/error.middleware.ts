import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested API route does not exist.' } });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error && typeof error === 'object') {
    const requestError = error as { status?: unknown; type?: unknown };
    if (requestError.status === 400 && requestError.type === 'entity.parse.failed') {
      response.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'The request body must contain valid JSON.' } });
      return;
    }
    if (requestError.status === 413) {
      response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body exceeds the 32 KB limit.' } });
      return;
    }
  }
  console.error(error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
};
