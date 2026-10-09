/**
 * Settings Repository (Layer 3: Repositories)
 * Manages singleton business settings and preferences in SQLite.
 * Repositories must NEVER import React.
 */

import { DbClient } from '../db/client';
import { BusinessSettings } from '../types';
import { createAuditRepo } from './audit';
import { INITIAL_SETTINGS } from '../data/seedData';

export interface SettingsRepo {
  get(): Promise<BusinessSettings>;
  update(updates: Partial<BusinessSettings>): Promise<BusinessSettings>;
}

export function createSettingsRepo(db: DbClient): SettingsRepo {
  const audit = createAuditRepo(db);

  function mapRowToSettings(r: any): BusinessSettings {
    return {
      businessName: r.business_name ?? INITIAL_SETTINGS.businessName,
      gstin: r.gstin ?? INITIAL_SETTINGS.gstin,
      state: r.state ?? INITIAL_SETTINGS.state,
      stateCode: r.state_code ?? INITIAL_SETTINGS.stateCode,
      address: r.address ?? INITIAL_SETTINGS.address,
      phone: r.phone ?? INITIAL_SETTINGS.phone,
      email: r.email ?? INITIAL_SETTINGS.email,
      bankName: r.bank_name ?? INITIAL_SETTINGS.bankName,
      accountName: r.account_name ?? INITIAL_SETTINGS.accountName,
      accountNumber: r.account_number ?? INITIAL_SETTINGS.accountNumber,
      ifscCode: r.ifsc_code ?? INITIAL_SETTINGS.ifscCode,
      branch: r.branch ?? INITIAL_SETTINGS.branch,
      upiId: r.upi_id ?? INITIAL_SETTINGS.upiId,
      logoUrl: r.logo_url || undefined,
      signatureUrl: r.signature_url || undefined,
      pin: r.pin ?? INITIAL_SETTINGS.pin,
      password: r.password || undefined,
      isDarkMode: Boolean(r.is_dark_mode),
      lastBackupDate: r.last_backup_date ?? INITIAL_SETTINGS.lastBackupDate,
      savedCouriers: r.saved_couriers_json ? JSON.parse(r.saved_couriers_json) : INITIAL_SETTINGS.savedCouriers,
      serviceablePincodes: r.serviceable_pincodes_json ? JSON.parse(r.serviceable_pincodes_json) : INITIAL_SETTINGS.serviceablePincodes,
      categories: r.categories_json ? JSON.parse(r.categories_json) : INITIAL_SETTINGS.categories,
      whatsappTemplates: r.whatsapp_templates_json ? JSON.parse(r.whatsapp_templates_json) : INITIAL_SETTINGS.whatsappTemplates,
    };
  }

  return {
    async get(): Promise<BusinessSettings> {
      const rows = await db.query<any>("SELECT * FROM settings WHERE id = 'singleton' LIMIT 1;");
      if (rows.length === 0) {
        return INITIAL_SETTINGS;
      }
      return mapRowToSettings(rows[0]);
    },

    async update(updates: Partial<BusinessSettings>): Promise<BusinessSettings> {
      const current = await this.get();
      const merged: BusinessSettings = { ...current, ...updates };
      const now = new Date().toISOString();

      await db.transaction(async (tx) => {
        await tx.execute(
          `UPDATE settings SET
            business_name = ?,
            gstin = ?,
            state = ?,
            state_code = ?,
            address = ?,
            phone = ?,
            email = ?,
            bank_name = ?,
            account_name = ?,
            account_number = ?,
            ifsc_code = ?,
            branch = ?,
            upi_id = ?,
            logo_url = ?,
            signature_url = ?,
            pin = ?,
            password = ?,
            is_dark_mode = ?,
            last_backup_date = ?,
            saved_couriers_json = ?,
            serviceable_pincodes_json = ?,
            categories_json = ?,
            whatsapp_templates_json = ?,
            updated_at = ?,
            version = version + 1
          WHERE id = 'singleton';`,
          [
            merged.businessName,
            merged.gstin,
            merged.state,
            merged.stateCode,
            merged.address,
            merged.phone,
            merged.email,
            merged.bankName,
            merged.accountName,
            merged.accountNumber,
            merged.ifscCode,
            merged.branch,
            merged.upiId,
            merged.logoUrl || null,
            merged.signatureUrl || null,
            merged.pin,
            merged.password || null,
            merged.isDarkMode ? 1 : 0,
            merged.lastBackupDate,
            JSON.stringify(merged.savedCouriers || []),
            JSON.stringify(merged.serviceablePincodes || []),
            JSON.stringify(merged.categories || []),
            JSON.stringify(merged.whatsappTemplates || []),
            now,
          ]
        );

        await audit.log('UPDATE', 'Settings', `Updated business profile: ${merged.businessName}`);
      });

      return merged;
    },
  };
}
