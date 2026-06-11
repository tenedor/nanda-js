import type { FastifyPluginAsync } from 'fastify';
import type { AgentIdentityManager } from '@nanda/agent';
import { verifyCredential, ValidationError, type VerifiableCredential } from '@nanda/shared';

interface VendorOptions {
  manager: AgentIdentityManager;
  businessLicensingDid: string;
}

interface BusinessRegistrationSubject {
  type: 'BusinessRegistration';
  status: 'granted' | 'rejected';
  recipientDID: string;
}

interface FoodTruckRentalSubject {
  type: 'FoodTruckRental';
  status: 'active' | 'rejected';
  recipientDID: string;
  truckId: string;
  licensePlate: string;
  vehicleRegistration: string;
}

export const registerRoutes: FastifyPluginAsync<VendorOptions> = async (
  app,
  { manager, businessLicensingDid },
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
        'Rental requires a valid business registration credential. We will issue a FoodTruckRental ' +
        'credential including the truck ID, license plate, and vehicle registration.',
    }),
  );

  app.post<{
    Body: {
      rentalRequest: string;
      requesterDID: string;
      businessRegistration: VerifiableCredential<BusinessRegistrationSubject>;
    };
  }>(
    '/rent',
    {
      schema: {
        body: {
          type: 'object', required: ['rentalRequest', 'requesterDID', 'businessRegistration'],
          properties: {
            rentalRequest: { type: 'string' },
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
      if (businessRegistration.issuer !== businessLicensingDid) {
        throw new ValidationError('BusinessRegistration not issued by authorized licensing office', 422);
      }
      if (businessRegistration.credentialSubject.status !== 'granted') {
        throw new ValidationError('BusinessRegistration is not granted', 422);
      }
      if (businessRegistration.credentialSubject.recipientDID !== requesterDID) {
        throw new ValidationError('BusinessRegistration recipient does not match requester', 422);
      }

      return manager.issueVC<FoodTruckRentalSubject>({
        type: 'FoodTruckRental',
        status: 'active',
        recipientDID: requesterDID,
        truckId: 'TRUCK-001',
        licensePlate: 'NANDA-001',
        vehicleRegistration: 'CA-REG-2024-NANDA001',
      });
    },
  );
};
