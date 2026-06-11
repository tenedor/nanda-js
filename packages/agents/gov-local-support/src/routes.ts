import type { FastifyPluginAsync } from 'fastify';

interface LocalSupportOptions {
  businessLicensingDid: string;
  parkingDeptDid: string;
  foodTruckVendorDid: string;
}

const inquireSchema = {
  body: {
    type: 'object',
    required: ['query', 'requesterDID'],
    properties: {
      query: { type: 'string' },
      requesterDID: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const registerRoutes: FastifyPluginAsync<LocalSupportOptions> = async (
  app,
  { businessLicensingDid, parkingDeptDid, foodTruckVendorDid },
) => {
  app.post<{ Body: { query: string; requesterDID: string } }>(
    '/inquire',
    { schema: inquireSchema },
    async () => ({
      reply:
        'To start a food truck business, you need a business license from the licensing office, ' +
        'a street vending permit from the parking department, and I recommend contacting a licensed ' +
        'food truck vendor to arrange your vehicle.',
      recommendedAgents: [
        { role: 'business-licensing', did: businessLicensingDid },
        { role: 'parking-department', did: parkingDeptDid },
        { role: 'food-truck-vendor', did: foodTruckVendorDid },
      ],
    }),
  );
};
