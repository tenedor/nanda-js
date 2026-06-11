import { fetchJson, type VerifiableCredential } from '@nanda/shared';
import { NandaResolver } from '@nanda/agent';
import type { AgentIdentityManager } from '@nanda/agent';

export interface WorkflowState {
  statusUpdate: string;
  completedGoals: string[];
  pendingGoals: string[];
  isComplete: boolean;
  isFailed: boolean;
}

export const INITIAL_STATE: WorkflowState = {
  statusUpdate: 'Awaiting objective.',
  completedGoals: [],
  pendingGoals: [],
  isComplete: false,
  isFailed: false,
};

const ALL_GOALS = [
  'research-requirements',
  'business-registration',
  'provisional-license',
  'food-truck-rental',
  'health-inspection',
  'final-license',
  'street-vending-permit',
];

// ── Local VC subject types ────────────────────────────────────────────────────

interface BusinessRegistrationSubject {
  type: 'BusinessRegistration';
  status: string;
  recipientDID: string;
}

interface ProvisionalLicenseSubject {
  type: 'ProvisionalRestaurantLicense';
  status: string;
  recipientDID: string;
}

interface FoodTruckRentalSubject {
  type: 'FoodTruckRental';
  status: string;
  recipientDID: string;
  truckId: string;
  licensePlate: string;
  vehicleRegistration: string;
}

interface HealthInspectionSubject {
  type: 'HealthInspectionApproval';
  status: string;
  recipientDID: string;
  truckId: string;
}

interface FinalLicenseSubject {
  type: 'FinalRestaurantLicense';
  status: string;
  recipientDID: string;
}

interface StreetVendingPermitSubject {
  type: 'StreetVendingPermit';
  status: string;
  recipientDID: string;
  truckId: string;
  licensePlate: string;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export async function runWorkflow(
  localSupportDid: string,
  manager: AgentIdentityManager,
  leanIndexUrl: string,
  setState: (update: Partial<WorkflowState>) => void,
): Promise<void> {
  const resolver = new NandaResolver(leanIndexUrl);
  const requesterDID = manager.did;

  const update = (statusUpdate: string, extra: Partial<WorkflowState> = {}) => {
    setState({ statusUpdate, ...extra });
  };

  update('Received objective. Resolving local government support agent via NANDA...', {
    completedGoals: [],
    pendingGoals: [...ALL_GOALS],
  });

  // ── Phase 1: Discovery ────────────────────────────────────────────────────

  const localSupportEndpoint = await resolver.resolveEndpoint(localSupportDid);
  const localSupport = await fetchJson<{
    reply: string;
    recommendedAgents: { role: string; did: string }[];
  }>(`${localSupportEndpoint}/inquire`, {
    method: 'POST',
    body: JSON.stringify({
      query: 'My client wants to start a food truck business. Which agencies and services should they engage with?',
      requesterDID,
    }),
  });

  const find = (role: string) => localSupport.recommendedAgents.find((a) => a.role === role)?.did;
  const businessLicensingDid = find('business-licensing');
  const parkingDeptDid = find('parking-department');
  const foodTruckVendorDid = find('food-truck-vendor');
  if (!businessLicensingDid || !parkingDeptDid || !foodTruckVendorDid) {
    throw new Error('Local support did not provide all required agent DIDs');
  }

  update('Received agency contacts from local business support. Researching requirements with business licensing office...');

  const businessLicensingEndpoint = await resolver.resolveEndpoint(businessLicensingDid);
  const licensingInfo = await fetchJson<{
    reply: string;
    steps: string[];
    referencedAgent: { role: string; did: string };
  }>(`${businessLicensingEndpoint}/inquire`, {
    method: 'POST',
    body: JSON.stringify({
      query: 'What is required to obtain a business license for a food truck restaurant operation?',
      requesterDID,
    }),
  });
  const healthDeptDid = licensingInfo.referencedAgent.did;

  update('Licensing requires 3 steps: registration, provisional license, and a final license requiring a health inspection. Contacting parking department...');

  const parkingDeptEndpoint = await resolver.resolveEndpoint(parkingDeptDid);
  await fetchJson<{ reply: string }>(`${parkingDeptEndpoint}/inquire`, {
    method: 'POST',
    body: JSON.stringify({ query: 'What is required to obtain a street vending permit for a food truck?', requesterDID }),
  });

  update('Street vending permit requires a final restaurant license and truck rental credential. Contacting food truck vendor...');

  const foodTruckVendorEndpoint = await resolver.resolveEndpoint(foodTruckVendorDid);
  await fetchJson<{ reply: string }>(`${foodTruckVendorEndpoint}/inquire`, {
    method: 'POST',
    body: JSON.stringify({ query: 'What is required to rent a food truck?', requesterDID }),
  });

  update('Truck rental requires business registration. Contacting health department...');

  const healthDeptEndpoint = await resolver.resolveEndpoint(healthDeptDid);
  await fetchJson<{ reply: string }>(`${healthDeptEndpoint}/inquire`, {
    method: 'POST',
    body: JSON.stringify({ query: 'What is required to schedule a food truck health inspection?', requesterDID }),
  });

  update(
    'Research complete. Plan: (1) register business, (2) provisional license, (3) rent truck, (4) health inspection, (5) final license, (6) street vending permit. Executing...',
    { completedGoals: ['research-requirements'], pendingGoals: ALL_GOALS.slice(1) },
  );

  // ── Phase 2: Execution ────────────────────────────────────────────────────

  // Step 1: Business registration
  const businessRegVC = await fetchJson<VerifiableCredential<BusinessRegistrationSubject>>(
    `${businessLicensingEndpoint}/apply/business-registration`,
    {
      method: 'POST',
      body: JSON.stringify({
        applicationStatement: `Citizen represented by agent ${requesterDID} requests a business registration.`,
        requesterDID,
      }),
    },
  );
  if (businessRegVC.credentialSubject.status !== 'granted') {
    throw new Error('Business registration was not granted');
  }
  update('Business registration approved. Applying for provisional license and arranging truck rental...', {
    completedGoals: ['research-requirements', 'business-registration'],
    pendingGoals: ALL_GOALS.slice(2),
  });

  // Step 2: Provisional restaurant license
  const provisionalVC = await fetchJson<VerifiableCredential<ProvisionalLicenseSubject>>(
    `${businessLicensingEndpoint}/apply/provisional-license`,
    {
      method: 'POST',
      body: JSON.stringify({
        applicationStatement: `Agent ${requesterDID} applies for a provisional restaurant business license.`,
        requesterDID,
        businessRegistration: businessRegVC,
      }),
    },
  );
  if (provisionalVC.credentialSubject.status !== 'granted') {
    throw new Error('Provisional restaurant license was not granted');
  }
  update('Provisional restaurant license granted. Renting food truck...', {
    completedGoals: ['research-requirements', 'business-registration', 'provisional-license'],
    pendingGoals: ALL_GOALS.slice(3),
  });

  // Step 3: Food truck rental
  const rentalVC = await fetchJson<VerifiableCredential<FoodTruckRentalSubject>>(
    `${foodTruckVendorEndpoint}/rent`,
    {
      method: 'POST',
      body: JSON.stringify({
        rentalRequest: `Agent ${requesterDID} requests a food truck rental on behalf of their client.`,
        requesterDID,
        businessRegistration: businessRegVC,
      }),
    },
  );
  if (rentalVC.credentialSubject.status !== 'active') {
    throw new Error('Food truck rental was not approved');
  }
  const { truckId, licensePlate } = rentalVC.credentialSubject;
  update(`Food truck ${truckId} (plate: ${licensePlate}) rented. Scheduling health inspection...`, {
    completedGoals: ['research-requirements', 'business-registration', 'provisional-license', 'food-truck-rental'],
    pendingGoals: ALL_GOALS.slice(4),
  });

  // Step 4: Health inspection
  const healthVC = await fetchJson<VerifiableCredential<HealthInspectionSubject>>(
    `${healthDeptEndpoint}/schedule-inspection`,
    {
      method: 'POST',
      body: JSON.stringify({
        inspectionRequest: `Agent ${requesterDID} requests a health inspection for truck ${truckId}.`,
        requesterDID,
        foodTruckRental: rentalVC,
      }),
    },
  );
  if (healthVC.credentialSubject.status !== 'passed') {
    throw new Error('Health inspection did not pass');
  }
  update(`Health inspection passed for ${truckId}. Applying for final restaurant business license...`, {
    completedGoals: ['research-requirements', 'business-registration', 'provisional-license', 'food-truck-rental', 'health-inspection'],
    pendingGoals: ALL_GOALS.slice(5),
  });

  // Step 5: Final restaurant license
  const finalLicenseVC = await fetchJson<VerifiableCredential<FinalLicenseSubject>>(
    `${businessLicensingEndpoint}/apply/final-license`,
    {
      method: 'POST',
      body: JSON.stringify({
        applicationStatement: `Agent ${requesterDID} applies for a final restaurant business license.`,
        requesterDID,
        provisionalLicense: provisionalVC,
        healthInspection: healthVC,
      }),
    },
  );
  if (finalLicenseVC.credentialSubject.status !== 'granted') {
    throw new Error('Final restaurant license was not granted');
  }
  update('Final restaurant business license granted. Applying for street vending permit...', {
    completedGoals: ['research-requirements', 'business-registration', 'provisional-license', 'food-truck-rental', 'health-inspection', 'final-license'],
    pendingGoals: ALL_GOALS.slice(6),
  });

  // Step 6: Street vending permit
  const permitVC = await fetchJson<VerifiableCredential<StreetVendingPermitSubject>>(
    `${parkingDeptEndpoint}/apply/street-vending-permit`,
    {
      method: 'POST',
      body: JSON.stringify({
        applicationStatement: `Agent ${requesterDID} applies for a street vending permit for truck ${truckId}.`,
        requesterDID,
        finalLicense: finalLicenseVC,
        foodTruckRental: rentalVC,
      }),
    },
  );
  if (permitVC.credentialSubject.status !== 'granted') {
    throw new Error('Street vending permit was not granted');
  }
  update(
    `All tasks complete! Food truck business is fully authorized. Credentials: business registration, ` +
    `provisional and final restaurant licenses, food truck rental (${truckId}, plate: ${licensePlate}), ` +
    `health inspection approval, and street vending permit. Ready to operate.`,
    {
      completedGoals: [...ALL_GOALS],
      pendingGoals: [],
      isComplete: true,
    },
  );
}
