/**
 * First-run bootstrap and migration runner (Layer 2: Database)
 * Creates tables, runs migrations, and initializes singleton settings.
 */

import { db } from './client';
import initialMigrationSql from './migrations/001-initial.sql?raw';
import { INITIAL_SETTINGS } from '../data/seedData';

let initPromise: Promise<void> | null = null;

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Create migrations tracking table if not present
      await db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // 2. Check if initial migration has run
      const applied = await db.query<{ version: number }>(
        'SELECT version FROM schema_migrations WHERE version = 1;'
      );

      if (applied.length === 0) {
        // Execute initial schema
        await db.exec(initialMigrationSql);

        // Record migration
        await db.execute(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          [1, '001-initial', new Date().toISOString()]
        );
      }

      // 3. Ensure settings singleton row exists
      const settingsRow = await db.query(
        "SELECT id FROM settings WHERE id = 'singleton';"
      );

      if (settingsRow.length === 0) {
        const now = new Date().toISOString();
        await db.execute(
          `INSERT INTO settings (
            id, business_name, gstin, state, state_code, address, phone, email,
            bank_name, account_name, account_number, ifsc_code, branch, upi_id,
            logo_url, signature_url, pin, is_dark_mode, last_backup_date,
            saved_couriers_json, serviceable_pincodes_json, categories_json, whatsapp_templates_json,
            device_id, version, sync_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            'singleton',
            INITIAL_SETTINGS.businessName,
            INITIAL_SETTINGS.gstin,
            INITIAL_SETTINGS.state,
            INITIAL_SETTINGS.stateCode,
            INITIAL_SETTINGS.address,
            INITIAL_SETTINGS.phone,
            INITIAL_SETTINGS.email,
            INITIAL_SETTINGS.bankName,
            INITIAL_SETTINGS.accountName,
            INITIAL_SETTINGS.accountNumber,
            INITIAL_SETTINGS.ifscCode,
            INITIAL_SETTINGS.branch,
            INITIAL_SETTINGS.upiId,
            INITIAL_SETTINGS.logoUrl || null,
            INITIAL_SETTINGS.signatureUrl || null,
            INITIAL_SETTINGS.pin,
            INITIAL_SETTINGS.isDarkMode ? 1 : 0,
            INITIAL_SETTINGS.lastBackupDate || now,
            JSON.stringify(INITIAL_SETTINGS.savedCouriers || []),
            JSON.stringify(INITIAL_SETTINGS.serviceablePincodes || []),
            JSON.stringify(INITIAL_SETTINGS.categories || []),
            JSON.stringify(INITIAL_SETTINGS.whatsappTemplates || []),
            'client_device',
            1,
            'local',
            now,
            now,
          ]
        );
      }
    } catch (err) {
      console.error('[SQLite Init] Database bootstrap failed:', err);
      throw err;
    }
  })();

  return initPromise;
}
