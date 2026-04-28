import { Router } from 'express';
import multer from 'multer';
import { KycController }        from './kyc.controller';
import { authenticate }         from '../../middlewares/authenticate';
import { authorize }            from '../../middlewares/authorize';
import { verifyOnfidoSignature } from '../../middlewares/verify-webhook';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createKycRouter(controller: KycController): Router {
  const router = Router();

  // Webhook — unauthenticated; signature verified before handler runs
  router.post('/webhook/onfido', verifyOnfidoSignature, controller.handleWebhook);

  // All other routes require authentication
  router.use(authenticate);

  // Investor routes
  router.get('/status',               controller.getStatus);
  router.post('/start',               controller.startSubmission);
  router.get('/:kycId/documents',     controller.getDocuments);
  router.post('/:kycId/documents',    upload.single('file'), controller.uploadDocument);
  router.post('/:kycId/submit',       controller.submit);

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
