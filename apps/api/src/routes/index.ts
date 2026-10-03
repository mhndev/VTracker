import { Router } from 'express';
import { adminRouter } from './admin.routes.js';
import { auditRouter } from './audit.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { grantRouter } from './grant.routes.js';
import { sessionRouter } from './session.routes.js';
import { telemetryRouter } from './telemetry.routes.js';

export const apiRouter = Router();
apiRouter.use('/session', sessionRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/grants', grantRouter);
apiRouter.use('/telemetry', telemetryRouter);
apiRouter.use('/audit', auditRouter);
