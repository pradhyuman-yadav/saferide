import { initFirebaseAdmin } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';
import { config } from './config';
import { app } from './app';

// Initialize Firebase Admin SDK before the server starts accepting requests
initFirebaseAdmin({ databaseURL: config.FIREBASE_DATABASE_URL });

app.listen(config.PORT, () => {
  logger.info({
    port:        config.PORT,
    env:         config.NODE_ENV,
    logLevel:    config.LOG_LEVEL,
    corsOrigins: config.CORS_ORIGINS,
    rtdbUrl:     config.FIREBASE_DATABASE_URL,
  }, 'trip-service started');
});

export default app;
