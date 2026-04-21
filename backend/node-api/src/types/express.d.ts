// ---------------------------------------------------------------------------
// Global Express type augmentations
// ---------------------------------------------------------------------------

import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user from JWT middleware */
      user?: {
        id:     string;
        email:  string;
        role:   string;
        status: string;
      };
      /** Request correlation ID (set by requestId middleware) */
      requestId: string;
      /** Raw body buffer — populated by express.json verify callback for webhook HMAC */
      rawBody?: Buffer;
    }
  }
}
