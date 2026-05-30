/** 
 * Server entry point
 * @author Norayr Petrosyan
 */

import { createApp } from './app.js';
import { config } from './config/config.js';

const start = async () => {
  try {
    const server = await createApp();
    await server.listen({
      port: config.port,
      host: config.host
    });

  } catch (err) {
    console.error('[SERVER] Startup error:', err);
    process.exit(1);
  }
};

start();
