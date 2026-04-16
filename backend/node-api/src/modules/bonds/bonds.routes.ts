import { Router } from 'express';
import { BondsController } from './bonds.controller';

export function createBondsRouter(ctrl: BondsController): Router {
  const r = Router();
  r.get('/',    ctrl.search);
  r.get('/:id', ctrl.getById);
  return r;
}
