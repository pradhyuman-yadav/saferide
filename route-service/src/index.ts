import { initFirebaseAdmin } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';
import { config } from './config';
import { app } from './app';

// Initialize Firebase Admin SDK before the server starts accepting requests
initFirebaseAdmin();

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'route-service started');
});

export default app;
