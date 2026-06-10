// Placeholder — full implementation in commit 2.
export interface AgentFactsStorage {
  ping(timeoutMillis?: number): Promise<void>;
  close(): Promise<void>;
}
