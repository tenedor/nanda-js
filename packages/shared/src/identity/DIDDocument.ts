export interface DIDVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
}

export interface DIDDocument {
  '@context': string | string[];
  id: string;
  verificationMethod?: DIDVerificationMethod[];
  authentication?: (string | DIDVerificationMethod)[];
  assertionMethod?: (string | DIDVerificationMethod)[];
}
