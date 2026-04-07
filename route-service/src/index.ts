import { initFirebaseAdmin } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';
import { config } from './config';
import { app } from './app';

// Initialize Firebase Admin SDK before the server starts accepting requests
initFirebaseAdmin();

app.listen(config.PORT, () => {
  logger.info({
    port:             config.PORT,
    env:              config.NODE_ENV,
    logLevel:         config.LOG_LEVEL,
    corsOrigins:      config.CORS_ORIGINS,
    mapsConfigured:   Boolean(config.GOOGLE_MAPS_DIRECTIONS_KEY),
  }, 'route-service started');
});

export default app;
