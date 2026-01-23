/**
 * VOE Proxy Server Entry Point
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { buildApp } from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const app = await buildApp();

    await app.listen({ port: PORT, host: HOST });

    console.log(`
╔════════════════════════════════════════════╗
║   VOE Proxy Service                        ║
║   Powered by FlareSolverr                  ║
╚════════════════════════════════════════════╝

🚀 Server listening on http://${HOST}:${PORT}
📡 FlareSolverr: ${process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191/v1'}
⚡ Ready to bypass Cloudflare!
    `);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n${signal} received, closing server...`);
        await app.close();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
