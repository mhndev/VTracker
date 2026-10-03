import { Router } from 'express';

export const healthRouter = Router();
healthRouter.get('/', (_request, response) => {
  response.json({ status: 'ok', time: new Date(), highRiskCommandsEnabled: false });
});
