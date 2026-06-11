# Food Truck Scenario — Agent APIs

All bodies are JSON. All agents serve HTTP/2 with TLS. Implementations use hardcoded auto-approve logic; VCs are issued with real Ed25519 signatures verified against DID documents.

---

## gov-local-support

```
POST /inquire
  body:     { query: string, requesterDID: DID }
  response: { reply: string, recommendedAgents: Array<{ role: string, did: DID }> }
```

---

## gov-business-licensing

```
POST /inquire
  body:     { query: string, requesterDID: DID }
  response: { reply: string, steps: string[], referencedAgent: { role: string, did: DID } }

POST /apply/business-registration
  body:     { applicationStatement: string, requesterDID: DID }
  response: VC<{ type: "BusinessRegistration", status: "granted" | "rejected",
                  recipientDID: DID }>

POST /apply/provisional-license
  body:     { applicationStatement: string, requesterDID: DID,
              businessRegistration: VC<BusinessRegistration> }
  response: VC<{ type: "ProvisionalRestaurantLicense", status: "granted" | "rejected",
                  recipientDID: DID }>

POST /apply/final-license
  body:     { applicationStatement: string, requesterDID: DID,
              provisionalLicense: VC<ProvisionalRestaurantLicense>,
              healthInspection: VC<HealthInspectionApproval> }
  response: VC<{ type: "FinalRestaurantLicense", status: "granted" | "rejected",
                  recipientDID: DID }>
```

Verifications performed:
- `POST /apply/provisional-license`: verifies signature of `businessRegistration`; checks `status === "granted"` and `recipientDID === requesterDID`.
- `POST /apply/final-license`: verifies signatures of `provisionalLicense` (self-issued) and `healthInspection` (issued by health-dept); checks statuses and recipients.

---

## gov-health-dept

```
POST /inquire
  body:     { query: string, requesterDID: DID }
  response: { reply: string }

POST /schedule-inspection
  body:     { inspectionRequest: string, requesterDID: DID,
              foodTruckRental: VC<FoodTruckRental> }
  response: VC<{ type: "HealthInspectionApproval", status: "passed" | "failed",
                  recipientDID: DID, truckId: string }>
```

Verifications performed: verifies signature of `foodTruckRental` (issued by food-truck-vendor); checks `status === "active"` and `recipientDID === requesterDID`.

---

## gov-parking-dept

```
POST /inquire
  body:     { query: string, requesterDID: DID }
  response: { reply: string }

POST /apply/street-vending-permit
  body:     { applicationStatement: string, requesterDID: DID,
              finalLicense: VC<FinalRestaurantLicense>,
              foodTruckRental: VC<FoodTruckRental> }
  response: VC<{ type: "StreetVendingPermit", status: "granted" | "rejected",
                  recipientDID: DID, truckId: string, licensePlate: string }>
```

Verifications performed: verifies signatures of both `finalLicense` (issued by business-licensing) and `foodTruckRental` (issued by food-truck-vendor); checks statuses and recipients. Logs the truck's license plate and vehicle registration number.

---

## food-truck-vendor

```
POST /inquire
  body:     { query: string, requesterDID: DID }
  response: { reply: string }

POST /rent
  body:     { rentalRequest: string, requesterDID: DID,
              businessRegistration: VC<BusinessRegistration> }
  response: VC<{ type: "FoodTruckRental", status: "active" | "rejected",
                  recipientDID: DID, truckId: string,
                  licensePlate: string, vehicleRegistration: string }>
```

Verifications performed: verifies signature of `businessRegistration` (issued by business-licensing); checks `status === "granted"` and `recipientDID === requesterDID`.

---

## personal-rep

```
POST /objective
  body:     { objective: string, contextDIDs: Array<{ role: string, did: DID }> }
  response: { acknowledgement: string }

GET /task-status
  response: { statusUpdate: string, completedGoals: string[], pendingGoals: string[],
              isComplete: boolean, isFailed: boolean }
```

After `POST /objective`, the agent drives the entire workflow autonomously. The citizen polls `GET /status` to observe progress. If any step fails, `isFailed` becomes `true` and `statusUpdate` describes where the workflow halted.
