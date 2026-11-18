import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from './config/database.js';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { default: app } = await import('./app.js');
const port = Number(process.env.PORT) || 5000;

try {
  await connectDatabase();
  const server = app.listen(port, () => {
    console.log(`WorkforceIQ API listening on port ${port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error(`Database startup failed: ${error.message}`);
  process.exit(1);
}
