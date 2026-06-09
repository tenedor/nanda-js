export interface ProtocolVersion {
  version: string; // e.g. "nanda-0.0.0-index", "nanda-0.0.0-facts|agent"
}

export interface ServerStatus {
  status: 'ok' | 'degraded' | 'unavailable';
}

export interface ErrorResponse {
  error: string;   // machine-readable code
  message: string; // human-readable description
}
