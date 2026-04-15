import { Router } from 'express';
import multer from 'multer';
import { KycController }  from './kyc.controller';
import { authenticate }   from '../../middlewares/authenticate';
import { authorize }      from '../../middlewares/authorize';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createKycRouter(controller: KycController): Router {
  const router = Router();

  // All routes require authentication
  router.use(authenticate);

  // Investor routes
  router.get('/status',               controller.getStatus);
  router.post('/start',               controller.startSubmission);
  router.post('/:kycId/documents',    upload.single('file'), controller.uploadDocument);
  router.post('/:kycId/submit',       controller.submit);

  // Webhook — unauthenticated (Onfido calls this directly)
  router.post('/webhook/onfido', controller.handleWebhook);

  // Admin routes
  router.get('/admin/queue',
    authorize('ADMIN', 'L2_ADMIN', 'KYC_OFFICER'),
    controller.getQueue,
  );
  router.post('/admin/:kycId/approve',
    authorize('ADMIN', 'L2_ADMIN', 'KYC_OFFICER'),
    controller.approve,
  );
  router.post('/admin/:kycId/reject',
    authorize('ADMIN', 'L2_ADMIN', 'KYC_OFFICER'),
    controller.reject,
  );

  return router;
}
