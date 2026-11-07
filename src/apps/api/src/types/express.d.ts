import type { User } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      actor?: User;
    }
  }
}

export {};
