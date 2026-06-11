import type { FastifyPluginAsync } from 'fastify';
import type { AgentIdentityManager } from '@nanda/agent';
import { verifyCredential, ValidationError, type VerifiableCredential } from '@nanda/shared';

interface ParkingDeptOptions {
  manager: AgentIdentityManager;
  businessLicensingDid: string;
  foodTruckVendorDid: string;
}

interface FinalLicenseSubject {
  type: 'FinalRestaurantLicense';
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

interface StreetVendingPermitSubject {
  type: 'StreetVendingPermit';
  status: 'granted' | 'rejected';
  recipientDID: string;
  truckId: string;
  licensePlate: string;
}

export const registerRoutes: FastifyPluginAsync<ParkingDeptOptions> = async (
  app,
  { manager, businessLicensingDid, foodTruckVendorDid },
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
        'Submit an application with a valid final restaurant business license and your food truck rental credential. ' +
        'We record the vehicle details at time of permit issuance.',
    }),
  );

  app.post<{
    Body: {
      applicationStatement: string;
      requesterDID: string;
      finalLicense: VerifiableCredential<FinalLicenseSubject>;
      foodTruckRental: VerifiableCredential<FoodTruckRentalSubject>;
    };
  }>(
    '/apply/street-vending-permit',
    {
      schema: {
        body: {
          type: 'object',
          required: ['applicationStatement', 'requesterDID', 'finalLicense', 'foodTruckRental'],
          properties: {
            applicationStatement: { type: 'string' },
            requesterDID: { type: 'string' },
            finalLicense: { type: 'object' },
            foodTruckRental: { type: 'object' },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const { requesterDID, finalLicense, foodTruckRental } = req.body;

      await verifyCredential(finalLicense);
      if (finalLicense.issuer !== businessLicensingDid) {
        throw new ValidationError('FinalRestaurantLicense not issued by authorized licensing office', 422);
      }
      if (finalLicense.credentialSubject.status !== 'granted') {
        throw new ValidationError('FinalRestaurantLicense is not granted', 422);
      }
      if (finalLicense.credentialSubject.recipientDID !== requesterDID) {
        throw new ValidationError('FinalRestaurantLicense recipient does not match requester', 422);
      }

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

      const { truckId, licensePlate, vehicleRegistration } = foodTruckRental.credentialSubject;
      req.log.info(
        { truckId, licensePlate, vehicleRegistration, recipientDID: requesterDID },
        'Street vending permit issued — vehicle details recorded',
      );

      return manager.issueVC<StreetVendingPermitSubject>({
        type: 'StreetVendingPermit',
        status: 'granted',
        recipientDID: requesterDID,
        truckId,
        licensePlate,
      });
    },
  );
};
