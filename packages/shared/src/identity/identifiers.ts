// Ontological type aliases. TypeScript does not enforce nominal distinction
// between these and plain strings, but they signal intent across the codebase.

export type AgentID = string;   // machine-readable ID, e.g. "did:web:translator.salesforce.com"
export type AgentName = string; // human-readable URN, e.g. "urn:agent:salesforce:translator"
