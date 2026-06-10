import {
  generateKeyPair,
  publicKeyToBase64url,
  sign,
  canonicalize,
  issueCredential,
  ValidationError,
  type AgentID,
  type AgentName,
  type Endpoint,
  type Signature,
  type DIDDocument,
  type SignedAttestation,
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

  private _leanIndexClient: LeanIndexClient;
  private _primaryFactsClient: AgentFactsClient;
  private _privateFactsClient: AgentFactsClient | undefined;

  constructor(
    opts: AgentIdentityManagerOptions,
    /** @internal testing only — inject mock lean-index client */
    _leanClient?: LeanIndexClient,
    /** @internal testing only — inject mock primary facts client */
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

  static generate(opts: Omit<AgentIdentityManagerOptions, 'keyPair'>): AgentIdentityManager {
    return new AgentIdentityManager({ ...opts, keyPair: generateKeyPair() });
  }

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

  async register(facts: AgentFacts, opts: { validUntil?: string } = {}): Promise<void> {
    this.validateFacts(facts);
    const vc = issueCredential(facts, {
      issuerDid: this.did,
      verificationMethodId: `${this.did}#key-1`,
      privateKey: this.privateKey,
      validUntil: opts.validUntil,
    });
    await this._primaryFactsClient.registerFacts(vc);
    await this._leanIndexClient.registerAgent(this.buildAgentAddr());
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
  }

  async deregister(): Promise<void> {
    const base = {
      agentId: this.did,
      action: 'delete-agent' as const,
      issuedAt: new Date().toISOString(),
    };
    const signature: Signature = sign(this.privateKey, canonicalize(base as Record<string, unknown>));
    await this._leanIndexClient.deleteAgent(this.did, { ...base, signature });
  }

  async syncRegistration(): Promise<void> {
    await this._leanIndexClient.updateAgent(this.did, this.buildAgentAddr());
  }

  async updateAgentAddr(
    changes: AgentAddrUpdate,
    opts: { syncRegistration?: boolean } = {},
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
    if (opts.syncRegistration ?? true) {
      await this.syncRegistration();
    }
  }
}
