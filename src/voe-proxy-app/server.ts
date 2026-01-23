/**
 * VOE Proxy Server Entry Point
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { buildApp } from './app';
import { VoeProxyAppConfig } from './voe-proxy-app.config';

async function start() {
  try {
    const app = await buildApp();

    await app.listen({
      port: VoeProxyAppConfig.PORT,
      host: VoeProxyAppConfig.HOST,
    });

    console.log(`
╔════════════════════════════════════════════╗
║   VOE Proxy Service                        ║
║   Powered by FlareSolverr                  ║
╚════════════════════════════════════════════╝

🚀 Server listening on http://${VoeProxyAppConfig.HOST}:${VoeProxyAppConfig.PORT}
📡 FlareSolverr: ${VoeProxyAppConfig.FLARESOLVERR_URL}
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
