import { createApp } from './src/app.js';
import { analyzeTraditional } from './src/engines/traditional.js';

// Recognized by Vercel's native Express integration.
export default createApp({ traditionalAnalyzer: analyzeTraditional });
