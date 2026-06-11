import type { FastifyPluginAsync } from 'fastify';
import type { AgentIdentityManager } from '@nanda/agent';
import { verifyCredential, ValidationError, type VerifiableCredential } from '@nanda/shared';

interface HealthDeptOptions {
  manager: AgentIdentityManager;
  foodTruckVendorDid: string;
}

interface FoodTruckRentalSubject {
  type: 'FoodTruckRental';
  status: 'active' | 'rejected';
  recipientDID: string;
  truckId: string;
  licensePlate: string;
  vehicleRegistration: string;
}

interface HealthInspectionSubject {
  type: 'HealthInspectionApproval';
  status: 'passed' | 'failed';
  recipientDID: string;
  truckId: string;
}

export const registerRoutes: FastifyPluginAsync<HealthDeptOptions> = async (
  app,
  { manager, foodTruckVendorDid },
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
        'A health inspection requires an active food truck rental credential. ' +
        'Provide a FoodTruckRental credential and we will conduct and issue results same-day.',
    }),
  );

  app.post<{
    Body: {
      inspectionRequest: string;
      requesterDID: string;
      foodTruckRental: VerifiableCredential<FoodTruckRentalSubject>;
    };
  }>(
    '/schedule-inspection',
    {
      schema: {
        body: {
          type: 'object', required: ['inspectionRequest', 'requesterDID', 'foodTruckRental'],
          properties: {
            inspectionRequest: { type: 'string' },
            requesterDID: { type: 'string' },
            foodTruckRental: { type: 'object' },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const { requesterDID, foodTruckRental } = req.body;

      await verifyCredential(foodTruckRental);
      if (foodTruckRental.issuer !== foodTruckVendorDid) {
        throw new ValidationError('FoodTruckRental not issued by authorized vendor', 422);
      }
      if (foodTruckRental.credentialSubject.status !== 'active') {
        throw new ValidationError('FoodTruckRental is not active', 422);
      }
      if (foodTruckRental.credentialSubject.recipientDID !== requesterDID) {
        throw new ValidationError('FoodTruckRental recipient does not match requester', 422);
      }

      return manager.issueVC<HealthInspectionSubject>({
        type: 'HealthInspectionApproval',
        status: 'passed',
        recipientDID: requesterDID,
        truckId: foodTruckRental.credentialSubject.truckId,
      });
    },
  );
};
