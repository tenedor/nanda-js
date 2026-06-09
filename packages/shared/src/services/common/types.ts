export interface ProtocolVersion {
  version: string; // e.g. "nanda-0.0.0-index", "nanda-0.0.0-facts|agent"
}

export interface ServerStatus {
  status: 'ok' | 'degraded' | 'unavailable';
}
