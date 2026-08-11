import { cloudSyncService } from "./CloudSyncService";
import { localDatabaseService } from "./LocalDatabaseService";
import { isCloudConfigured } from "./supabaseClient";

export class UnitSyncQueue {
  constructor({
    local = localDatabaseService,
    cloud = cloudSyncService,
  } = {}) {
    this.local = local;
    this.cloud = cloud;
    this.processing = new Set();
  }

  async pendingCount(ownerKey) {
    if (!ownerKey || ownerKey === "guest") return 0;
    return (await this.local.listPendingUnitSync(ownerKey, { includeDeferred: true })).length;
  }

  async process(ownerKey) {
    if (!ownerKey || ownerKey === "guest" || !isCloudConfigured) {
      return { processed: 0, failed: 0, pending: await this.pendingCount(ownerKey) };
    }
    if (this.processing.has(ownerKey)) {
      return { processed: 0, failed: 0, pending: await this.pendingCount(ownerKey) };
    }
    this.processing.add(ownerKey);
    let processed = 0;
    let failed = 0;
    try {
      const entries = await this.local.listPendingUnitSync(ownerKey);
      for (const entry of entries) {
        try {
          if (entry.entityType === "unit_profile") {
            await this.cloud.saveUnitProfile(ownerKey, entry.payload);
          } else if (entry.entityType === "unit_configuration") {
            await this.cloud.saveUnitUserData(ownerKey, entry.payload);
            await this.cloud.saveUnitConfiguration(ownerKey, entry.payload);
          } else {
            throw new Error(`Unsupported sync entity: ${entry.entityType}.`);
          }
          await this.local.completeUnitSync(entry.queueId);
          processed += 1;
        } catch (error) {
          failed += 1;
          const attempts = (entry.attempts ?? 0) + 1;
          const delayMs = Math.min(24 * 60 * 60 * 1000, 30_000 * (2 ** (attempts - 1)));
          await this.local.updateUnitSync(entry.queueId, {
            attempts,
            lastError: error.message,
            lastAttemptAt: new Date().toISOString(),
            nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
          });
        }
      }
      return {
        processed,
        failed,
        pending: await this.pendingCount(ownerKey),
      };
    } finally {
      this.processing.delete(ownerKey);
    }
  }
}

export const unitSyncQueue = new UnitSyncQueue();
