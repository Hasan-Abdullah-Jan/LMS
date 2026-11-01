// Vercel serverless entry point: the whole Express API runs as one function.
// vercel.json rewrites /api/* here; the built app comes from `npm run build`.
import { createApp } from '../apps/api/dist/app.js';

export default createApp();
