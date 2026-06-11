# Food Truck Scenario — Script

Each entry shows: the API route and type signature; the caller and data sent; the responder and data returned; and the status message the personal rep would report at that point.

## DID legend

| Symbol | Agent |
|---|---|
| `DID_PERSONAL_REP` | personal-rep (did:web:personal-rep%3A8469) |
| `DID_LOCAL_SUPPORT` | gov-local-support — known to citizen |
| `DID_BUSINESS_LICENSING` | gov-business-licensing — discovered from local-support |
| `DID_PARKING_DEPT` | gov-parking-dept — discovered from local-support |
| `DID_FOOD_TRUCK_VENDOR` | food-truck-vendor — discovered from local-support |
| `DID_HEALTH_DEPT` | gov-health-dept — discovered from business-licensing |

---

## Step 1 — Citizen sets objective

```
POST /objective
  body: { objective: string, contextDIDs: Array<{ role: string, did: DID }> }
  → { acknowledgement: string }
```

*Citizen →* `objective: "I want to start a food truck business. Please figure out what I need and complete the process."` / `contextDIDs: [{ role: "local-government-support", did: DID_LOCAL_SUPPORT }]`

*personal-rep →* `{ acknowledgement: "Understood. I have one contact to start with. I will research requirements and proceed on your behalf." }`

*Status:* "Received objective. Resolving local government support agent via NANDA..."

---

## Step 2 — personal-rep resolves gov-local-support

```
GET /agents/:id  →  AgentAddr                       (lean-index)
GET <primaryFactsUrl>  →  VC<AgentFacts>            (government-facts)
```

*personal-rep → lean-index:* `id: DID_LOCAL_SUPPORT` → `AgentAddr { agentId, primaryFactsUrl, ttl, signature }`

*personal-rep → government-facts:* fetches `primaryFactsUrl` → `VC<AgentFacts>` with `endpoints.static: ["https://gov-local-support:8464"]`

*Status:* "Received objective. Resolving local government support agent via NANDA..."

---

## Step 3 — personal-rep inquires with gov-local-support

```
POST /inquire
  body: { query: string, requesterDID: DID }
  → { reply: string, recommendedAgents: Array<{ role: string, did: DID }> }
```

*personal-rep →* `query: "My client wants to start a food truck business. Which agencies and services should they engage with?"` / `requesterDID: DID_PERSONAL_REP`

*gov-local-support →* `reply: "To start a food truck business you need a business license from the licensing office, a street vending permit from the parking department, and I recommend contacting a licensed food truck vendor for your vehicle."` / `recommendedAgents: [{ role: "business-licensing", did: DID_BUSINESS_LICENSING }, { role: "parking-department", did: DID_PARKING_DEPT }, { role: "food-truck-vendor", did: DID_FOOD_TRUCK_VENDOR }]`

*Status:* "Received agency contacts from local business support. Researching requirements with business licensing office..."

---

## Steps 4a–4b — personal-rep resolves and inquires gov-business-licensing

*Resolves DID_BUSINESS_LICENSING via lean-index → government-facts → endpoint https://gov-business-licensing:8465*

```
POST /inquire
  body: { query: string, requesterDID: DID }
  → { reply: string, steps: string[], referencedAgent: { role: string, did: DID } }
```

*personal-rep →* `query: "What is required to obtain a business license for a food truck restaurant operation?"` / `requesterDID: DID_PERSONAL_REP`

*gov-business-licensing →* `reply: "Licensing has three steps: (1) business registration — application only, (2) provisional restaurant license — application only, (3) final restaurant license — requires a health inspection from the health department."` / `steps: ["business-registration", "provisional-restaurant-license", "final-restaurant-license"]` / `referencedAgent: { role: "health-department", did: DID_HEALTH_DEPT }`

*Status:* "Licensing requires 3 steps: registration, provisional license, and a final license requiring a health inspection. I now have the health department's contact. Contacting parking department..."

---

## Steps 5a–5b — personal-rep resolves and inquires gov-parking-dept

*Resolves DID_PARKING_DEPT via lean-index → government-facts → endpoint https://gov-parking-dept:8467*

```
POST /inquire
  body: { query: string, requesterDID: DID } → { reply: string }
```

*personal-rep →* `query: "What is required to obtain a street vending permit for a food truck?"` / `requesterDID: DID_PERSONAL_REP`

*gov-parking-dept →* `reply: "Submit an application with a valid final restaurant business license and your food truck rental credential. We record the vehicle details at time of permit issuance."`

*Status:* "Street vending permit requires a final restaurant license and truck rental credential. Contacting food truck vendor..."

---

## Steps 6a–6b — personal-rep resolves and inquires food-truck-vendor

*Resolves DID_FOOD_TRUCK_VENDOR via lean-index → vendor-facts → endpoint https://food-truck-vendor:8468*

```
POST /inquire
  body: { query: string, requesterDID: DID } → { reply: string }
```

*personal-rep →* `query: "What is required to rent a food truck?"` / `requesterDID: DID_PERSONAL_REP`

*food-truck-vendor →* `reply: "Rental requires a valid business registration credential. We will issue a FoodTruckRental credential including the truck ID, license plate, and vehicle registration."`

*Status:* "Truck rental requires business registration. Contacting health department..."

---

## Steps 7a–7b — personal-rep resolves and inquires gov-health-dept

*Resolves DID_HEALTH_DEPT via lean-index → government-facts → endpoint https://gov-health-dept:8466*

```
POST /inquire
  body: { query: string, requesterDID: DID } → { reply: string }
```

*personal-rep →* `query: "What is required to schedule a food truck health inspection?"` / `requesterDID: DID_PERSONAL_REP`

*gov-health-dept →* `reply: "An inspection requires an active food truck rental credential. Provide a FoodTruckRental credential and we will conduct and issue results same-day."`

*Status:* "Research complete. Plan: (1) register business, (2) provisional license, (3) rent truck, (4) health inspection, (5) final license, (6) street vending permit. Executing..."

---

## Step 8 — Apply for business registration

```
POST /apply/business-registration
  body: { applicationStatement: string, requesterDID: DID }
  → VC<{ type: "BusinessRegistration", status: "granted", recipientDID: DID }>
```

*personal-rep →* `applicationStatement: "Citizen represented by agent DID_PERSONAL_REP requests a business registration."` / `requesterDID: DID_PERSONAL_REP`

*gov-business-licensing →* `VC<BusinessRegistration> { credentialSubject: { type: "BusinessRegistration", status: "granted", recipientDID: DID_PERSONAL_REP }, proof: { type: "DataIntegrityProof", cryptosuite: "eddsa-jcs-2022", ... } }`

*Status:* "Business registration approved. Applying for provisional license and arranging truck rental..."

---

## Step 9 — Apply for provisional restaurant license

```
POST /apply/provisional-license
  body: { applicationStatement: string, requesterDID: DID, businessRegistration: VC<BusinessRegistration> }
  → VC<{ type: "ProvisionalRestaurantLicense", status: "granted", recipientDID: DID }>
```

*personal-rep →* `applicationStatement: "Agent DID_PERSONAL_REP applies for a provisional restaurant business license."` / `requesterDID: DID_PERSONAL_REP` / `businessRegistration: <BusinessRegistration VC>`

*gov-business-licensing verifies:* signature on BusinessRegistration VC, `status === "granted"`, `recipientDID === requesterDID`

*gov-business-licensing →* `VC<ProvisionalRestaurantLicense> { credentialSubject: { type: "ProvisionalRestaurantLicense", status: "granted", recipientDID: DID_PERSONAL_REP }, proof: { ... } }`

*Status:* "Provisional restaurant license granted. Renting food truck..."

---

## Step 10 — Rent a food truck

```
POST /rent
  body: { rentalRequest: string, requesterDID: DID, businessRegistration: VC<BusinessRegistration> }
  → VC<{ type: "FoodTruckRental", status: "active", recipientDID: DID,
          truckId: string, licensePlate: string, vehicleRegistration: string }>
```

*personal-rep →* `rentalRequest: "Agent DID_PERSONAL_REP requests a food truck rental on behalf of their client."` / `requesterDID: DID_PERSONAL_REP` / `businessRegistration: <BusinessRegistration VC>`

*food-truck-vendor verifies:* signature on BusinessRegistration VC, `status === "granted"`, `recipientDID === requesterDID`

*food-truck-vendor →* `VC<FoodTruckRental> { credentialSubject: { type: "FoodTruckRental", status: "active", recipientDID: DID_PERSONAL_REP, truckId: "TRUCK-001", licensePlate: "NANDA-001", vehicleRegistration: "CA-REG-2024-NANDA001" }, proof: { ... } }`

*Status:* "Food truck TRUCK-001 (plate: NANDA-001) rented. Scheduling health inspection..."

---

## Step 11 — Schedule health inspection

```
POST /schedule-inspection
  body: { inspectionRequest: string, requesterDID: DID, foodTruckRental: VC<FoodTruckRental> }
  → VC<{ type: "HealthInspectionApproval", status: "passed", recipientDID: DID, truckId: string }>
```

*personal-rep →* `inspectionRequest: "Agent DID_PERSONAL_REP requests a health inspection for truck TRUCK-001."` / `requesterDID: DID_PERSONAL_REP` / `foodTruckRental: <FoodTruckRental VC>`

*gov-health-dept verifies:* signature on FoodTruckRental VC (issued by food-truck-vendor), `status === "active"`, `recipientDID === requesterDID`

*gov-health-dept →* `VC<HealthInspectionApproval> { credentialSubject: { type: "HealthInspectionApproval", status: "passed", recipientDID: DID_PERSONAL_REP, truckId: "TRUCK-001" }, proof: { ... } }`

*Status:* "Health inspection passed for TRUCK-001. Applying for final restaurant business license..."

---

## Step 12 — Apply for final restaurant license

```
POST /apply/final-license
  body: { applicationStatement: string, requesterDID: DID,
          provisionalLicense: VC<ProvisionalRestaurantLicense>,
          healthInspection: VC<HealthInspectionApproval> }
  → VC<{ type: "FinalRestaurantLicense", status: "granted", recipientDID: DID }>
```

*personal-rep →* `applicationStatement: "Agent DID_PERSONAL_REP applies for a final restaurant business license."` / `requesterDID: DID_PERSONAL_REP` / `provisionalLicense: <ProvisionalRestaurantLicense VC>` / `healthInspection: <HealthInspectionApproval VC>`

*gov-business-licensing verifies:* signature on provisionalLicense (self-issued), `status === "granted"`, `recipientDID === requesterDID`; signature on healthInspection (issued by gov-health-dept), `status === "passed"`, `recipientDID === requesterDID`

*gov-business-licensing →* `VC<FinalRestaurantLicense> { credentialSubject: { type: "FinalRestaurantLicense", status: "granted", recipientDID: DID_PERSONAL_REP }, proof: { ... } }`

*Status:* "Final restaurant business license granted. Applying for street vending permit..."

---

## Step 13 — Apply for street vending permit

```
POST /apply/street-vending-permit
  body: { applicationStatement: string, requesterDID: DID,
          finalLicense: VC<FinalRestaurantLicense>,
          foodTruckRental: VC<FoodTruckRental> }
  → VC<{ type: "StreetVendingPermit", status: "granted", recipientDID: DID,
          truckId: string, licensePlate: string }>
```

*personal-rep →* `applicationStatement: "Agent DID_PERSONAL_REP applies for a street vending permit for truck TRUCK-001."` / `requesterDID: DID_PERSONAL_REP` / `finalLicense: <FinalRestaurantLicense VC>` / `foodTruckRental: <FoodTruckRental VC>`

*gov-parking-dept verifies:* signature on finalLicense (issued by business-licensing), `status === "granted"`, `recipientDID === requesterDID`; signature on foodTruckRental (issued by food-truck-vendor), `status === "active"`, `recipientDID === requesterDID`

*gov-parking-dept logs:* `license plate: NANDA-001, vehicle registration: CA-REG-2024-NANDA001`

*gov-parking-dept →* `VC<StreetVendingPermit> { credentialSubject: { type: "StreetVendingPermit", status: "granted", recipientDID: DID_PERSONAL_REP, truckId: "TRUCK-001", licensePlate: "NANDA-001" }, proof: { ... } }`

*Status:* "All tasks complete! Food truck business is fully authorized. Credentials: business registration, provisional and final restaurant licenses, food truck rental (TRUCK-001, plate: NANDA-001), health inspection approval, and street vending permit. Ready to operate."
