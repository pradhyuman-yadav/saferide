import { initFirebaseAdmin } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';
import { config } from './config';
import { httpServer } from './app';

initFirebaseAdmin();

httpServer.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'livetrack-gateway started');
});

export default httpServer;
