import type { Request, Response } from 'express';
import app from '../server';

/**
 * Vercel Serverless Function entry point routing all /api/* requests
 * through the canonical FamilyOS Express application.
 */
export default function handler(req: Request, res: Response) {
  return app(req, res);
}
