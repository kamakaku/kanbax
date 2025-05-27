import { Request, Response } from 'express';
import { pool } from './db';
import { subscriptionService } from './subscription-service';
import { storage } from './storage';
import { guaranteedSubscriptionUpdate } from './automated-subscription-service';

/**
 * Diese Datei enthält direkten Datenbankzugriff für Abonnement-Updates,
 * die aus irgendwelchen Gründen nicht über die normale API funktionieren.
 * 
 * WICHTIG: Dies ist ein Notfallmechanismus, der nur verwendet werden sollte,
 * wenn alle anderen Ansätze fehlgeschlagen sind.
 */

/**
 * Direktes Update eines Benutzerabonnements in der Datenbank
 * Umgeht alle Geschäftslogik und Validierungen, sollte nur für Notfälle verwendet werden
 */
export async function directDbSubscriptionUpdate(
  userId: number,
  packageName: string,
  billingCycle: string
): Promise<boolean> {
  // Normalisierung des billingCycle-Parameters, um sicherzustellen, dass nur gültige Werte verwendet werden
  // Stellen Sie sicher, dass billingCycle ein String ist und konvertiere zu einem der beiden gültigen Werte
  const rawBillingCycle = billingCycle || 'monthly';
  const normalizedBillingCycle = (typeof rawBillingCycle === 'string' && rawBillingCycle.toLowerCase() === 'yearly') 
    ? 'yearly' 
    : 'monthly';
  
  // Debug-Ausgabe für besseres Tracing
  console.log(`[DIRECT-DB] Beginne direktes DB-Update für User ${userId}, Paket ${packageName}`);
  console.log(`[DIRECT-DB] Zyklus normalisiert: ${normalizedBillingCycle} (Original: ${rawBillingCycle}, Typ: ${typeof rawBillingCycle})`);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Package-ID anhand des Namens abrufen
    const packageResult = await client.query(
      `SELECT id FROM subscription_packages WHERE name = $1`,
      [packageName.toLowerCase()]
    );
    
    if (packageResult.rows.length === 0) {
      logger.error(`Paket mit Namen ${packageName} nicht gefunden`);
      await client.query('ROLLBACK');
      return false;
    }
    
    const packageId = packageResult.rows[0].id;
    
    // 2. Überprüfen, ob für diesen Benutzer ein Abonnement existiert
    const subscriptionCheckResult = await client.query(
      `SELECT id FROM subscriptions WHERE user_id = $1`,
      [userId]
    );
    
    if (subscriptionCheckResult.rows.length === 0) {
      // Neues Abonnement erstellen
      await client.query(
        `INSERT INTO subscriptions 
         (user_id, package_id, status, billing_cycle, created_at, updated_at)
         VALUES ($1, $2, 'active', $3, NOW(), NOW())`,
        [userId, packageId, normalizedBillingCycle]
      );
    } else {
      // Bestehendes Abonnement aktualisieren
      await client.query(
        `UPDATE subscriptions 
         SET package_id = $1, billing_cycle = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [packageId, normalizedBillingCycle, userId]
      );
    }
    
    // 3. Einen Audit-Log-Eintrag erstellen
    await client.query(
      `INSERT INTO subscription_audit_log
       (user_id, action, package_id, billing_cycle, created_at)
       VALUES ($1, 'direct_db_update', $2, $3, NOW())`,
      [userId, packageId, normalizedBillingCycle]
    );
    
    // 4. Den Benutzer aktualisieren, um die Abonnementinformationen zu speichern
    await client.query(
      `UPDATE users
       SET subscription_tier = $1, subscription_billing_cycle = $2, updated_at = NOW()
       WHERE id = $3`,
      [packageName.toLowerCase(), normalizedBillingCycle, userId]
    );
    
    await client.query('COMMIT');
    logger.info(`Direktes DB-Update für Benutzer ${userId} erfolgreich: Paket=${packageName}, Zyklus=${normalizedBillingCycle} (Original: ${billingCycle})`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Fehler beim direkten DB-Update eines Abonnements:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * API-Handler für garantierte Abonnement-Updates
 * Diese Methode bietet einen letzten Ausweg, wenn alle anderen Update-Mechanismen fehlschlagen
 */
export async function guaranteedSubscriptionUpdate(req: Request, res: Response) {
  try {
    const { tier, billingCycle, userId: requestUserId } = req.body;
    
    // Entweder den angegebenen Benutzer oder den aktuell eingeloggten Benutzer verwenden
    const userId = requestUserId || (req.user && req.user.id);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Kein Benutzer angegeben oder eingeloggt'
      });
    }
    
    if (!tier) {
      return res.status(400).json({
        success: false,
        message: 'Kein Paket angegeben'
      });
    }
    
    // Verwende den angegebenen Billing-Cycle oder Fallback zu "monthly"
    // Normalisiere auch den Billing-Cycle, um sicherzustellen, dass nur gültige Werte verwendet werden
    const rawBillingCycle = billingCycle || 'monthly';
    const normalizedBillingCycle = (typeof rawBillingCycle === 'string' && rawBillingCycle.toLowerCase() === 'yearly') 
      ? 'yearly' 
      : 'monthly';
    
    logger.info(`GUARANTEED UPDATE: Starte für Benutzer ${userId}, Paket ${tier}`);
    logger.info(`Billing-Zyklus normalisiert: ${normalizedBillingCycle} (Original: ${rawBillingCycle}, Typ: ${typeof rawBillingCycle})`);
    
    // 1. Versuche zuerst mit dem Standard-Subscriptionservice
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Benutzer nicht gefunden'
        });
      }
      
      const result = await subscriptionService.updateUserSubscription(
        user,
        tier.toLowerCase(),
        normalizedBillingCycle,
        true // Force downgrade
      );
      
      if (result.success) {
        logger.info(`Garantiertes Update über subscriptionService erfolgreich: ${JSON.stringify(result)}`);
        return res.status(200).json({
          success: true,
          message: `Abonnement erfolgreich aktualisiert auf ${tier} (${normalizedBillingCycle})`,
          method: 'subscription_service'
        });
      }
      
      logger.warn(`subscriptionService Update fehlgeschlagen, versuche direktes DB-Update: ${result.message}`);
    } catch (serviceError) {
      logger.error(`Fehler im subscriptionService, versuche direktes DB-Update:`, serviceError);
    }
    
    // 2. Wenn der Subscriptionservice fehlschlägt, verwende direktes DB-Update
    const dbUpdateResult = await directDbSubscriptionUpdate(
      userId,
      tier.toLowerCase(),
      normalizedBillingCycle
    );
    
    if (dbUpdateResult) {
      logger.info(`✅ GUARANTEED UPDATE: Erfolgreich via direktes DB-Update für Benutzer ${userId}`);
      
      return res.status(200).json({
        success: true,
        message: `Abonnement erfolgreich aktualisiert auf ${tier} (${normalizedBillingCycle})`,
        method: 'direct_db_update'
      });
    } else {
      logger.error(`❌ GUARANTEED UPDATE: Alle Methoden fehlgeschlagen für Benutzer ${userId}`);
      
      return res.status(500).json({
        success: false,
        message: 'Alle Update-Methoden sind fehlgeschlagen'
      });
    }
  } catch (error) {
    logger.error('Unerwarteter Fehler im garantierten Update:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ein unerwarteter Fehler ist aufgetreten',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}