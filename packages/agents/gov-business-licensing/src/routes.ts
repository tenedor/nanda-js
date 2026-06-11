import type { FastifyPluginAsync } from 'fastify';
import type { AgentIdentityManager } from '@nanda/agent';
import { verifyCredential, ValidationError, type VerifiableCredential } from '@nanda/shared';

interface BusinessLicensingOptions {
  manager: AgentIdentityManager;
  healthDeptDid: string;
}

interface BusinessRegistrationSubject {
  type: 'BusinessRegistration';
  status: 'granted' | 'rejected';
  recipientDID: string;
}

interface ProvisionalLicenseSubject {
  type: 'ProvisionalRestaurantLicense';
  status: 'granted' | 'rejected';
  recipientDID: string;
}

interface HealthInspectionSubject {
  type: 'HealthInspectionApproval';
  status: 'passed' | 'failed';
  recipientDID: string;
  truckId: string;
}

interface FinalLicenseSubject {
  type: 'FinalRestaurantLicense';
  status: 'granted' | 'rejected';
  recipientDID: string;
}

function assertGranted(vc: VerifiableCredential<{ status: string; recipientDID: string }>, requesterDID: string, label: string): void {
  if (vc.credentialSubject.status !== 'granted') {
    throw new ValidationError(`${label} is not granted`, 422);
  }
  if (vc.credentialSubject.recipientDID !== requesterDID) {
    throw new ValidationError(`${label} recipient does not match requester`, 422);
  }
}

export const registerRoutes: FastifyPluginAsync<BusinessLicensingOptions> = async (
  app,
  { manager, healthDeptDid },
) => {
  app.post<{ Body: { query: string; requesterDID: string } }>(
    '/inquire',
    {
      schema: {
        body: {
          type: 'object', required: ['query', 'requesterDID'],
          properties: { query: { type: 'string' }, requesterDID: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    async () => ({
      reply:
        'Licensing has three steps: (1) business registration — application only, ' +
        '(2) provisional restaurant license — application only, ' +
        '(3) final restaurant license — requires a health inspection from the health department.',
      steps: ['business-registration', 'provisional-restaurant-license', 'final-restaurant-license'],
      referencedAgent: { role: 'health-department', did: healthDeptDid },
    }),
  );

  app.post<{ Body: { applicationStatement: string; requesterDID: string } }>(
    '/apply/business-registration',
    {
      schema: {
        body: {
          type: 'object', required: ['applicationStatement', 'requesterDID'],
          properties: { applicationStatement: { type: 'string' }, requesterDID: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const { requesterDID } = req.body;
      return manager.issueVC<BusinessRegistrationSubject>({
        type: 'BusinessRegistration',
        status: 'granted',
        recipientDID: requesterDID,
      });
    },
  );

  app.post<{
    Body: {
      applicationStatement: string;
      requesterDID: string;
      businessRegistration: VerifiableCredential<BusinessRegistrationSubject>;
    };
  }>(
    '/apply/provisional-license',
    {
      schema: {
        body: {
          type: 'object', required: ['applicationStatement', 'requesterDID', 'businessRegistration'],
          properties: {
            applicationStatement: { type: 'string' },
            requesterDID: { type: 'string' },
            businessRegistration: { type: 'object' },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const { requesterDID, businessRegistration } = req.body;
      await verifyCredential(businessRegistration);
      assertGranted(businessRegistration as VerifiableCredential<{ status: string; recipientDID: string }>, requesterDID, 'BusinessRegistration');
      return manager.issueVC<ProvisionalLicenseSubject>({
        type: 'ProvisionalRestaurantLicense',
        status: 'granted',
        recipientDID: requesterDID,
      });
    },
  );

  app.post<{
    Body: {
      applicationStatement: string;
      requesterDID: string;
      provisionalLicense: VerifiableCredential<ProvisionalLicenseSubject>;
      healthInspection: VerifiableCredential<HealthInspectionSubject>;
    };
  }>(
    '/apply/final-license',
    {
      schema: {
        body: {
          type: 'object',
          required: ['applicationStatement', 'requesterDID', 'provisionalLicense', 'healthInspection'],
          properties: {
            applicationStatement: { type: 'string' },
            requesterDID: { type: 'string' },
            provisionalLicense: { type: 'object' },
            healthInspection: { type: 'object' },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const { requesterDID, provisionalLicense, healthInspection } = req.body;

      await verifyCredential(provisionalLicense);
      if (provisionalLicense.issuer !== manager.did) {
        throw new ValidationError('ProvisionalRestaurantLicense not issued by this licensing office', 422);
      }
      assertGranted(provisionalLicense as VerifiableCredential<{ status: string; recipientDID: string }>, requesterDID, 'ProvisionalRestaurantLicense');

      await verifyCredential(healthInspection);
      if (healthInspection.issuer !== healthDeptDid) {
        throw new ValidationError(`HealthInspectionApproval not issued by health department`, 422);
      }
      if (healthInspection.credentialSubject.status !== 'passed') {
        throw new ValidationError('HealthInspectionApproval did not pass', 422);
      }
      if (healthInspection.credentialSubject.recipientDID !== requesterDID) {
        throw new ValidationError('HealthInspectionApproval recipient does not match requester', 422);
      }

      return manager.issueVC<FinalLicenseSubject>({
        type: 'FinalRestaurantLicense',
        status: 'granted',
        recipientDID: requesterDID,
      });
    },
  );
};
