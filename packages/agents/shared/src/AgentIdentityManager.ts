import {
  generateKeyPair,
  publicKeyToBase64url,
  sign,
  canonicalize,
  issueCredential,
  ValidationError,
  HttpClientError,
  type AgentID,
  type AgentName,
  type Endpoint,
  type Signature,
  type DIDDocument,
  type KeyPair,
} from '@nanda/shared';
import type { LeanIndexClient, AgentAddr } from '@nanda/lean-index';
import type { AgentFactsClient, AgentFacts } from '@nanda/agent-facts';
import { HttpLeanIndexClient } from './clients/HttpLeanIndexClient.js';
import { HttpAgentFactsClient } from './clients/HttpAgentFactsClient.js';

const DEFAULT_TTL = 3600;

export interface AgentIdentityManagerOptions {
  did: AgentID;                        // immutable
  keyPair: KeyPair;
  agentName: AgentName;
  leanIndexUrl: Endpoint;              // immutable
  primaryFactsServerUrl: Endpoint;     // mutable — base URL of the public facts server
  privateFactsServerUrl?: Endpoint;    // mutable
  adaptiveResolverUrl?: Endpoint;      // mutable
  ttl?: number;                        // default: 3600s
}

export interface AgentAddrUpdate {
  agentName?: AgentName;
  primaryFactsServerUrl?: Endpoint;
  /** Set to null to remove the private facts server. */
  privateFactsServerUrl?: Endpoint | null;
  /** Set to null to remove the adaptive resolver. */
  adaptiveResolverUrl?: Endpoint | null;
  ttl?: number;
}

export class AgentIdentityManager {
  readonly did: AgentID;
  readonly leanIndexUrl: Endpoint;
  readonly publicKey: Uint8Array;
  private readonly privateKey: Uint8Array;

  agentName: AgentName;
  primaryFactsServerUrl: Endpoint;
  privateFactsServerUrl: Endpoint | undefined;
  adaptiveResolverUrl: Endpoint | undefined;
  ttl: number;

  /** True after registerFactsOnly or registerFactsAndIndex; false after invalidateFacts. */
  isFactsRegistered: boolean = false;
  /** True after registerIndexOnly or registerFactsAndIndex; false after deregister. */
  isIndexRegistered: boolean = false;

  private _leanIndexClient: LeanIndexClient;
  private _primaryFactsClient: AgentFactsClient;
  private _privateFactsClient: AgentFactsClient | undefined;

  private constructor(
    opts: AgentIdentityManagerOptions,
    _leanClient?: LeanIndexClient,
    _primaryFactsClient?: AgentFactsClient,
  ) {
    this.did = opts.did;
    this.leanIndexUrl = opts.leanIndexUrl;
    this.publicKey = opts.keyPair.publicKey;
    this.privateKey = opts.keyPair.privateKey;
    this.agentName = opts.agentName;
    this.primaryFactsServerUrl = opts.primaryFactsServerUrl;
    this.privateFactsServerUrl = opts.privateFactsServerUrl;
    this.adaptiveResolverUrl = opts.adaptiveResolverUrl;
    this.ttl = opts.ttl ?? DEFAULT_TTL;

    this._leanIndexClient = _leanClient ?? new HttpLeanIndexClient(opts.leanIndexUrl);
    this._primaryFactsClient = _primaryFactsClient ?? new HttpAgentFactsClient(opts.primaryFactsServerUrl);
    if (opts.privateFactsServerUrl) {
      this._privateFactsClient = new HttpAgentFactsClient(opts.privateFactsServerUrl);
    }
  }

  // ── Static builders ──────────────────────────────────────────────────────────

  /** Creates a manager and immediately registers facts and the lean-index entry. */
  static async createAndRegister(
    opts: Omit<AgentIdentityManagerOptions, 'keyPair'>,
    facts: AgentFacts,
    registrationOpts: { validUntil?: string } = {},
  ): Promise<AgentIdentityManager> {
    const manager = new AgentIdentityManager({ ...opts, keyPair: generateKeyPair() });
    await manager.registerFactsAndIndex(facts, registrationOpts);
    return manager;
  }

  /** Creates a manager without registering. Register explicitly when ready. */
  static createWithoutRegistering(
    opts: Omit<AgentIdentityManagerOptions, 'keyPair'>,
  ): AgentIdentityManager {
    return new AgentIdentityManager({ ...opts, keyPair: generateKeyPair() });
  }

  /** @internal testing only — constructs with injected mock clients. */
  static _build(
    opts: AgentIdentityManagerOptions,
    _leanClient?: LeanIndexClient,
    _primaryFactsClient?: AgentFactsClient,
  ): AgentIdentityManager {
    return new AgentIdentityManager(opts, _leanClient, _primaryFactsClient);
  }

  // ── Identity ─────────────────────────────────────────────────────────────────

  getDIDDocument(): DIDDocument {
    return {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: this.did,
      verificationMethod: [{
        id: `${this.did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: this.did,
        publicKeyMultibase: 'u' + publicKeyToBase64url(this.publicKey),
      }],
      assertionMethod: [`${this.did}#key-1`],
    };
  }

  // ── Registration ─────────────────────────────────────────────────────────────

  async registerFactsAndIndex(facts: AgentFacts, opts: { validUntil?: string } = {}): Promise<void> {
    await this.registerFactsOnly(facts, opts);
    await this.registerIndexOnly();
  }

  async registerFactsOnly(facts: AgentFacts, opts: { validUntil?: string } = {}): Promise<void> {
    this.validateFacts(facts);
    const vc = issueCredential(facts, {
      issuerDid: this.did,
      verificationMethodId: `${this.did}#key-1`,
      privateKey: this.privateKey,
      validUntil: opts.validUntil,
    });
    await this._primaryFactsClient.registerFacts(vc);
    this.isFactsRegistered = true;
  }

  async registerIndexOnly(): Promise<void> {
    await this._leanIndexClient.registerAgent(this.buildAgentAddr());
    this.isIndexRegistered = true;
  }

  async updateFacts(facts: AgentFacts, opts: { validUntil?: string } = {}): Promise<void> {
    this.validateFacts(facts);
    const vc = issueCredential(facts, {
      issuerDid: this.did,
      verificationMethodId: `${this.did}#key-1`,
      privateKey: this.privateKey,
      validUntil: opts.validUntil,
    });
    await this._primaryFactsClient.updateFacts(vc);
  }

  async invalidateFacts(): Promise<void> {
    const base = {
      agentId: this.did,
      action: 'invalidate-facts' as const,
      issuedAt: new Date().toISOString(),
    };
    const signature: Signature = sign(this.privateKey, canonicalize(base as Record<string, unknown>));
    await this._primaryFactsClient.invalidateFacts(this.did, { ...base, signature });
    this.isFactsRegistered = false;
  }

  async deregister(): Promise<void> {
    const base = {
      agentId: this.did,
      action: 'delete-agent' as const,
      issuedAt: new Date().toISOString(),
    };
    const signature: Signature = sign(this.privateKey, canonicalize(base as Record<string, unknown>));
    await this._leanIndexClient.deleteAgent(this.did, { ...base, signature });
    this.isIndexRegistered = false;
  }

  async updateIndexRegistration(): Promise<void> {
    await this._leanIndexClient.updateAgent(this.did, this.buildAgentAddr());
  }

  // Transitions the agent to a new facts-server configuration.
  // Registers on servers that are new to the config (with PUT fallback if a prior record
  // exists), invalidates servers that are being removed, then updates lean-index.
  // Pass undefined for newPrivateServerUrl to leave the private server unchanged.
  // Pass null to explicitly remove it.
  async migrateFactsServers(
    newPrimaryServerUrl: Endpoint,
    newPrivateServerUrl: Endpoint | null | undefined,
    facts: AgentFacts,
  ): Promise<void> {
    const oldPrimaryUrl = this.primaryFactsServerUrl;
    const oldPrivateUrl = this.privateFactsServerUrl;
    const effectiveNewPrivate: Endpoint | undefined = newPrivateServerUrl === undefined
      ? oldPrivateUrl
      : (newPrivateServerUrl ?? undefined);

    const oldUrls = new Set([oldPrimaryUrl, ...(oldPrivateUrl ? [oldPrivateUrl] : [])]);
    const newUrls = new Set([newPrimaryServerUrl, ...(effectiveNewPrivate ? [effectiveNewPrivate] : [])]);

    const toRegister = [...newUrls].filter(url => !oldUrls.has(url));
    const toInvalidate = [...oldUrls].filter(url => !newUrls.has(url));

    const vc = issueCredential(facts, {
      issuerDid: this.did,
      verificationMethodId: `${this.did}#key-1`,
      privateKey: this.privateKey,
    });

    // Step 1: register on new servers; fall back to update if a prior record already exists.
    for (const serverUrl of toRegister) {
      const client = new HttpAgentFactsClient(serverUrl);
      try {
        await client.registerFacts(vc);
      } catch (e) {
        if (e instanceof HttpClientError && e.status === 409) {
          await client.updateFacts(vc);
        } else {
          throw e;
        }
      }
    }

    // Update manager state before syncing lean-index.
    this.primaryFactsServerUrl = newPrimaryServerUrl;
    this._primaryFactsClient = new HttpAgentFactsClient(newPrimaryServerUrl);
    if (newPrivateServerUrl !== undefined) {
      this.privateFactsServerUrl = effectiveNewPrivate;
      this._privateFactsClient = effectiveNewPrivate
        ? new HttpAgentFactsClient(effectiveNewPrivate)
        : undefined;
    }
    this.isFactsRegistered = true;

    // Step 2: sync lean-index with the updated AgentAddr.
    await this.updateIndexRegistration();

    // Step 3: invalidate on removed servers.
    for (const serverUrl of toInvalidate) {
      const base = {
        agentId: this.did,
        action: 'invalidate-facts' as const,
        issuedAt: new Date().toISOString(),
      };
      const signature: Signature = sign(this.privateKey, canonicalize(base as Record<string, unknown>));
      const client = new HttpAgentFactsClient(serverUrl);
      await client.invalidateFacts(this.did, { ...base, signature });
    }
  }

  async updateAgentAddr(
    changes: AgentAddrUpdate,
    opts: { dontSyncIndex?: boolean } = {},
    /** @internal testing only — inject mock client for new primaryFactsServerUrl */
    _newPrimaryFactsClient?: AgentFactsClient,
    /** @internal testing only — inject mock client for new privateFactsServerUrl */
    _newPrivateFactsClient?: AgentFactsClient,
  ): Promise<void> {
    if (changes.agentName !== undefined) this.agentName = changes.agentName;
    if (changes.ttl !== undefined) this.ttl = changes.ttl;
    if ('adaptiveResolverUrl' in changes) {
      this.adaptiveResolverUrl = changes.adaptiveResolverUrl ?? undefined;
    }
    if (changes.primaryFactsServerUrl !== undefined) {
      this.primaryFactsServerUrl = changes.primaryFactsServerUrl;
      this._primaryFactsClient =
        _newPrimaryFactsClient ?? new HttpAgentFactsClient(changes.primaryFactsServerUrl);
    }
    if ('privateFactsServerUrl' in changes) {
      this.privateFactsServerUrl = changes.privateFactsServerUrl ?? undefined;
      this._privateFactsClient = this.privateFactsServerUrl
        ? (_newPrivateFactsClient ?? new HttpAgentFactsClient(this.privateFactsServerUrl))
        : undefined;
    }
    if (!opts.dontSyncIndex) {
      await this.updateIndexRegistration();
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private factsUrl(serverUrl: Endpoint): Endpoint {
    return `${serverUrl}/facts/${encodeURIComponent(this.did)}`;
  }

  private buildAgentAddr(): AgentAddr {
    const unsigned: Omit<AgentAddr, 'signature'> = {
      agentId: this.did,
      agentName: this.agentName,
      primaryFactsUrl: this.factsUrl(this.primaryFactsServerUrl),
      ...(this.privateFactsServerUrl && { privateFactsUrl: this.factsUrl(this.privateFactsServerUrl) }),
      ...(this.adaptiveResolverUrl && { adaptiveResolverUrl: this.adaptiveResolverUrl }),
      ttl: this.ttl,
    };
    const signature: Signature = sign(
      this.privateKey,
      canonicalize(unsigned as Record<string, unknown>),
    );
    return { ...unsigned, signature };
  }

  private validateFacts(facts: AgentFacts): void {
    if (facts.id !== this.did) {
      throw new ValidationError(
        `AgentFacts.id "${facts.id}" does not match agent DID "${this.did}"`,
      );
    }
    if (facts.agentName !== this.agentName) {
      throw new ValidationError(
        `AgentFacts.agentName "${facts.agentName}" does not match agent name "${this.agentName}"`,
      );
    }
  }
}
