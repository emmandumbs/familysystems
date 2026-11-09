/**
 * offlineSyncEngine.ts
 *
 * Core Offline-First Architecture for FamilyOS:
 * 1. Durable IndexedDB mutation outbox, retry state, dead-letter records, and snapshot cache
 * 2. Network connectivity monitor (online / offline reactive state)
 * 3. Security: Authorization headers, tokens, and cookies are strictly stripped prior to durable storage;
 *    tokens are dynamically injected from the authenticated context only at replay time
 * 4. Conflict & Error Handling:
 *    - HTTP 404/409 errors are NOT treated as successful sync; routed to Dead Letter Queue with conflict metadata
 *    - HTTP 401 triggers re-authentication handling and halts replay to prevent repeated auth failures
 *    - HTTP 5xx and network failures are retryable with exponential backoff / retry counter
 *    - X-Idempotency-Key header is added to all replay requests to prevent duplicate mutation creation
 * 5. Transparent fallback to in-memory & LocalStorage storage when IndexedDB is unavailable (SSR/tests)
 */

export interface QueuedMutation {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  domain: string;
  actionDescription: string;
  createdAt: number;
  retryCount: number;
  idempotencyKey: string;
}

export interface DeadLetterItem {
  id: string;
  mutation: QueuedMutation;
  failedAt: number;
  statusCode?: number;
  statusReason: string;
  conflictMetadata?: any;
}

export interface OfflineSyncStatus {
  isOnline: boolean;
  pendingCount: number;
  deadLetterCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastSyncError: string | null;
  isReauthRequired: boolean;
}

const IDB_DATABASE_NAME = 'familyos_sync_db_v3';
const IDB_DATABASE_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const DEAD_LETTER_STORE = 'dead_letter';
const CACHE_STORE = 'cache';
const META_STORE = 'meta';

const LOCALSTORAGE_OUTBOX_KEY = 'familyos_offline_outbox_v2';
const LOCALSTORAGE_DEADLETTER_KEY = 'familyos_offline_deadletter_v2';
const LOCALSTORAGE_CACHE_PREFIX = 'familyos_offline_cache_';
const LOCALSTORAGE_SYNC_META_KEY = 'familyos_offline_sync_meta_v2';

const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-session-token',
  'x-csrf-token',
];

type Listener = (status: OfflineSyncStatus) => void;
type TokenProvider = () => string | null | undefined;
type ReauthHandler = () => void;

class OfflineSyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private isReauthRequired: boolean = false;
  private listeners: Set<Listener> = new Set();
  private reauthHandlers: Set<ReauthHandler> = new Set();
  private lastSyncedAt: number | null = null;
  private lastSyncError: string | null = null;
  private authTokenProvider: TokenProvider | null = null;

  private memoryOutbox: QueuedMutation[] = [];
  private memoryDeadLetter: DeadLetterItem[] = [];
  private memoryCache: Map<string, { data: any; cachedAt: number }> = new Map();

  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    this.initIdb();
    if (typeof window !== 'undefined') {
      this.initListeners();
      this.loadMeta();
      if (this.isOnline) {
        setTimeout(() => this.processOutbox(), 1200);
      }
    }
  }

  // --- IndexedDB Initialization & Storage Helpers ---

  private initIdb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(IDB_DATABASE_NAME, IDB_DATABASE_VERSION);
          request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
              db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
              db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
              db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
              db.createObjectStore(META_STORE, { keyPath: 'key' });
            }
          };
          request.onsuccess = async () => {
            const db = request.result;
            await this.hydrateFromIdb(db);
            resolve(db);
          };
          request.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  private async hydrateFromIdb(db: IDBDatabase): Promise<void> {
    try {
      const outboxTx = db.transaction(OUTBOX_STORE, 'readonly');
      const outboxStore = outboxTx.objectStore(OUTBOX_STORE);
      const outboxReq = outboxStore.getAll();
      outboxReq.onsuccess = () => {
        if (Array.isArray(outboxReq.result) && outboxReq.result.length > 0) {
          this.memoryOutbox = outboxReq.result;
          this.notifyListeners();
        }
      };

      const dlqTx = db.transaction(DEAD_LETTER_STORE, 'readonly');
      const dlqStore = dlqTx.objectStore(DEAD_LETTER_STORE);
      const dlqReq = dlqStore.getAll();
      dlqReq.onsuccess = () => {
        if (Array.isArray(dlqReq.result) && dlqReq.result.length > 0) {
          this.memoryDeadLetter = dlqReq.result;
          this.notifyListeners();
        }
      };
    } catch {
      // Non-fatal
    }
  }

  public setAuthTokenProvider(provider: TokenProvider): void {
    this.authTokenProvider = provider;
    this.isReauthRequired = false;
    this.notifyListeners();
  }

  public onReauthRequired(handler: ReauthHandler): () => void {
    this.reauthHandlers.add(handler);
    return () => this.reauthHandlers.delete(handler);
  }

  private emitReauthRequired(): void {
    this.isReauthRequired = true;
    this.notifyListeners();
    this.reauthHandlers.forEach((h) => {
      try {
        h();
      } catch {
        // Ignore
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('familyos:reauth_required'));
    }
  }

  private initListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
      console.log('📶 FamilyOS is back online. Replaying offline outbox...');
      this.processOutbox();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
      console.log('🔌 FamilyOS is offline. Switched to local offline cache & outbox.');
    });
  }

  private loadMeta() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_SYNC_META_KEY);
      if (raw) {
        const meta = JSON.parse(raw);
        this.lastSyncedAt = meta.lastSyncedAt || null;
      }
    } catch {
      // Ignore
    }
  }

  private saveMeta() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          LOCALSTORAGE_SYNC_META_KEY,
          JSON.stringify({ lastSyncedAt: this.lastSyncedAt })
        );
      } catch {
        // Ignore
      }
    }
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction(META_STORE, 'readwrite');
          tx.objectStore(META_STORE).put({ key: 'sync_meta', lastSyncedAt: this.lastSyncedAt });
        } catch {
          // Ignore
        }
      });
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  public getStatus(): OfflineSyncStatus {
    return {
      isOnline: this.isOnline,
      pendingCount: this.getOutbox().length,
      deadLetterCount: this.getDeadLetterQueue().length,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      lastSyncError: this.lastSyncError,
      isReauthRequired: this.isReauthRequired,
    };
  }

  // --- Security Sanitization ---

  public sanitizeHeaders(headers?: Record<string, string>): Record<string, string> {
    if (!headers) return {};
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  // --- Outbox Management ---

  public getOutbox(): QueuedMutation[] {
    if (this.memoryOutbox.length > 0) {
      return this.memoryOutbox;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_OUTBOX_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.memoryOutbox = parsed;
            return this.memoryOutbox;
          }
        }
      } catch {
        // Fallback to memory
      }
    }
    return this.memoryOutbox;
  }

  public saveOutbox(outbox: QueuedMutation[]): void {
    this.memoryOutbox = [...outbox];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCALSTORAGE_OUTBOX_KEY, JSON.stringify(outbox));
      } catch {
        // Ignore
      }
    }
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction(OUTBOX_STORE, 'readwrite');
          const store = tx.objectStore(OUTBOX_STORE);
          store.clear();
          for (const item of outbox) {
            store.put(item);
          }
        } catch {
          // Ignore
        }
      });
    }
    this.notifyListeners();
  }

  public getDeadLetterQueue(): DeadLetterItem[] {
    if (this.memoryDeadLetter.length > 0) {
      return this.memoryDeadLetter;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_DEADLETTER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.memoryDeadLetter = parsed;
            return this.memoryDeadLetter;
          }
        }
      } catch {
        // Fallback to memory
      }
    }
    return this.memoryDeadLetter;
  }

  public saveDeadLetterQueue(items: DeadLetterItem[]): void {
    this.memoryDeadLetter = [...items];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCALSTORAGE_DEADLETTER_KEY, JSON.stringify(items));
      } catch {
        // Ignore
      }
    }
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
          const store = tx.objectStore(DEAD_LETTER_STORE);
          store.clear();
          for (const item of items) {
            store.put(item);
          }
        } catch {
          // Ignore
        }
      });
    }
    this.notifyListeners();
  }

  public pushToDeadLetter(
    mutation: QueuedMutation,
    statusCode?: number,
    statusReason = 'SYNC_FAILURE',
    conflictMetadata?: any
  ): void {
    const deadLetters = this.getDeadLetterQueue();
    deadLetters.push({
      id: `dlq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      mutation,
      failedAt: Date.now(),
      statusCode,
      statusReason,
      conflictMetadata,
    });
    this.saveDeadLetterQueue(deadLetters);
  }

  public clearDeadLetterQueue(): void {
    this.memoryDeadLetter = [];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LOCALSTORAGE_DEADLETTER_KEY);
      } catch {
        // Ignore
      }
    }
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
          tx.objectStore(DEAD_LETTER_STORE).clear();
        } catch {
          // Ignore
        }
      });
    }
    this.notifyListeners();
  }

  public enqueueMutation(
    mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retryCount' | 'idempotencyKey'>
  ): QueuedMutation {
    const outbox = this.getOutbox();
    const sanitizedHeaders = this.sanitizeHeaders(mutation.headers);
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const item: QueuedMutation = {
      ...mutation,
      headers: sanitizedHeaders,
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      idempotencyKey,
      createdAt: Date.now(),
      retryCount: 0,
    };
    outbox.push(item);
    this.saveOutbox(outbox);
    console.log(`📦 Enqueued offline mutation: ${item.actionDescription} (${item.method} ${item.url})`);
    return item;
  }

  // --- Cache Snapshot Store ---

  public setCache<T>(key: string, data: T): void {
    this.memoryCache.set(key, { data, cachedAt: Date.now() });
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`${LOCALSTORAGE_CACHE_PREFIX}${key}`, JSON.stringify({ data, cachedAt: Date.now() }));
      } catch {
        // Storage quota or private browsing
      }
    }
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction(CACHE_STORE, 'readwrite');
          tx.objectStore(CACHE_STORE).put({ key, data, cachedAt: Date.now() });
        } catch {
          // Ignore
        }
      });
    }
  }

  public getCache<T>(key: string): T | null {
    const mem = this.memoryCache.get(key);
    if (mem) return mem.data as T;

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${LOCALSTORAGE_CACHE_PREFIX}${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.memoryCache.set(key, parsed);
          return parsed.data as T;
        }
      } catch {
        // Fallback
      }
    }
    return null;
  }

  // --- Outbox Processor ---

  public async processOutbox(): Promise<{ processed: number; errors: number; deadLetters: number }> {
    if (this.isSyncing || !this.isOnline || this.isReauthRequired) {
      return { processed: 0, errors: 0, deadLetters: 0 };
    }

    const outbox = this.getOutbox();
    if (outbox.length === 0) {
      return { processed: 0, errors: 0, deadLetters: 0 };
    }

    this.isSyncing = true;
    this.lastSyncError = null;
    this.notifyListeners();

    let processedCount = 0;
    let errorCount = 0;
    let deadLetterCount = 0;
    const remaining: QueuedMutation[] = [];

    console.log(`🔄 Replaying ${outbox.length} offline mutations to authoritative server...`);

    // Dynamically retrieve active session token
    let activeToken = this.authTokenProvider ? this.authTokenProvider() : null;
    if (!activeToken && typeof localStorage !== 'undefined') {
      activeToken = localStorage.getItem('familyos_auth_token_v1');
    }

    for (const item of outbox) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': item.idempotencyKey || item.id,
          ...(item.headers || {}),
        };

        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken}`;
        }

        const res = await fetch(item.url, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        if (res.ok) {
          // Genuine success (200-299)
          processedCount++;
          console.log(`✓ Replayed mutation: ${item.actionDescription}`);
        } else if (res.status === 401) {
          // HTTP 401: Unauthorized / Session Expired -> trigger re-authentication handler
          console.warn(`🔒 Replay paused: Authentication required (401) for ${item.actionDescription}.`);
          this.emitReauthRequired();
          remaining.push(item);
          errorCount++;
          break; // Stop replaying until user re-authenticates
        } else if (res.status === 404) {
          // Target resource not found — DO NOT treat as success! Route to DLQ
          console.warn(`⚠️ Offline mutation target not found (404): ${item.actionDescription}. Routing to DLQ.`);
          this.pushToDeadLetter(item, 404, 'RESOURCE_NOT_FOUND_404');
          deadLetterCount++;
        } else if (res.status === 409) {
          // Version or unique constraint conflict — DO NOT treat as success! Route to DLQ with conflict details
          const conflictData = await res.json().catch(() => ({}));
          console.warn(`⚠️ Offline mutation conflict (409): ${item.actionDescription}. Routing to DLQ.`, conflictData);
          this.pushToDeadLetter(item, 409, 'VERSION_OR_ENTITY_CONFLICT_409', conflictData);
          deadLetterCount++;
        } else {
          // Server error (5xx) or transient failure: retry up to 5 times
          item.retryCount += 1;
          if (item.retryCount >= 5) {
            console.error(`❌ Max retries reached for mutation: ${item.actionDescription}. Routing to DLQ.`);
            this.pushToDeadLetter(item, res.status, `MAX_RETRIES_EXCEEDED_${res.status}`);
            deadLetterCount++;
          } else {
            remaining.push(item);
          }
          errorCount++;
        }
      } catch (err: any) {
        item.retryCount += 1;
        remaining.push(item);
        errorCount++;
        this.lastSyncError = err?.message || 'Network sync error';
        break; // Stop replaying if network dropped mid-sync
      }
    }

    this.saveOutbox(remaining);
    this.isSyncing = false;
    this.lastSyncedAt = Date.now();
    this.saveMeta();
    this.notifyListeners();

    console.log(
      `✅ Offline sync complete. Processed: ${processedCount}, Remaining: ${remaining.length}, Dead Letters: ${deadLetterCount}`
    );
    return { processed: processedCount, errors: errorCount, deadLetters: deadLetterCount };
  }

  /**
   * Universal offline-first fetch wrapper:
   * 1. Returns cached response immediately if offline or on network error.
   * 2. For mutations (POST, PUT, DELETE), if offline or network fails, queues into outbox and calls optimisticUpdater.
   * 3. When online, updates the cache with fresh authoritative data.
   */
  public async offlineFetch<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    actionDescription?: string,
    optimisticHandler?: () => T
  ): Promise<{ data: T; isFromCache: boolean; isQueuedOffline?: boolean }> {
    const method = (options.method || 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    const effectiveCacheKey = cacheKey || url;

    // A. Read-only GET requests
    if (method === 'GET') {
      if (!this.isOnline) {
        const cached = this.getCache<T>(effectiveCacheKey);
        if (cached !== null) {
          return { data: cached, isFromCache: true };
        }
      }

      try {
        const res = await fetch(url, options);
        if (res.ok) {
          const freshData = await res.json();
          this.setCache(effectiveCacheKey, freshData);
          return { data: freshData, isFromCache: false };
        }
        const cached = this.getCache<T>(effectiveCacheKey);
        if (cached !== null) {
          return { data: cached, isFromCache: true };
        }
        throw new Error(`Request failed with status ${res.status}`);
      } catch (fetchErr) {
        const cached = this.getCache<T>(effectiveCacheKey);
        if (cached !== null) {
          return { data: cached, isFromCache: true };
        }
        throw fetchErr;
      }
    }

    // B. Mutation requests (POST, PUT, DELETE, PATCH)
    if (this.isOnline) {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          const resData = await res.json().catch(() => ({ success: true } as any));
          return { data: resData, isFromCache: false };
        }
      } catch {
        // Network drop during call -> treat as offline mutation below
      }
    }

    // Offline mutation path: sanitize headers before queueing
    let parsedBody: any = undefined;
    if (options.body && typeof options.body === 'string') {
      try {
        parsedBody = JSON.parse(options.body);
      } catch {
        parsedBody = options.body;
      }
    }

    this.enqueueMutation({
      url,
      method,
      body: parsedBody,
      headers: (options.headers as Record<string, string>) || {},
      domain: url.split('/')[3] || 'household',
      actionDescription: actionDescription || `${method} ${url}`,
    });

    let optimisticResult: any = { success: true, offlineQueued: true };
    if (optimisticHandler) {
      optimisticResult = optimisticHandler();
    }

    return {
      data: optimisticResult as T,
      isFromCache: true,
      isQueuedOffline: true,
    };
  }
}

export const offlineSyncEngine = new OfflineSyncEngine();
