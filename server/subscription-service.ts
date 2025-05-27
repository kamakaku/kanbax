import { db } from "./db";
import { companies, companyPaymentInfo, subscriptionPackages, users, subscriptionAuditLogs, boards } from "../shared/schema";
import { eq, and, sql, inArray, count } from "drizzle-orm";

/**
 * Der Subscription Service ist verantwortlich für die Verwaltung von Abonnements
 * und die Überprüfung von Nutzungsbeschränkungen basierend auf dem Abonnement
 */
export class SubscriptionService {
  /**
   * Liefert die Standard-Pakete mit ihren Einschränkungen
   */
  getDefaultPackages() {
    return [
      {
        name: "free",
        displayName: "Kostenlos",
        description: "Ideal für Einzelpersonen",
        price: 0,
        maxProjects: 1,
        maxBoards: 1,
        maxTeams: 0, // Keine Teams erlaubt
        maxUsersPerCompany: 1,
        maxTasks: 10, // Aktualisiert von 20 auf 10, um mit taskLimitMiddleware.ts übereinzustimmen
        maxOkrs: 0, // Keine OKRs erlaubt
        hasGanttView: false,
        hasAdvancedReporting: false,
        hasApiAccess: false,
        hasCustomBranding: false,
        hasPrioritySupport: false,
        requiresCompany: false,
        hasTeamFeatures: false, // Teams-Funktionalität deaktiviert
        hasOkrFeatures: false, // OKR-Funktionalität deaktiviert
        isActive: true
      },
      {
        name: "freelancer",
        displayName: "Freelancer",
        description: "Für Selbstständige",
        price: 900, // 9€ pro Monat in Cent
        maxProjects: 3,
        maxBoards: 5,
        maxTeams: 0, // Keine Teams erlaubt
        maxUsersPerCompany: 1,
        maxTasks: 50,
        maxOkrs: 0, // Keine OKRs erlaubt
        hasGanttView: true,
        hasAdvancedReporting: false,
        hasApiAccess: false,
        hasCustomBranding: false,
        hasPrioritySupport: false,
        requiresCompany: false,
        hasTeamFeatures: false, // Teams-Funktionalität deaktiviert
        hasOkrFeatures: false, // OKR-Funktionalität deaktiviert
        isActive: true
      },
      {
        name: "organisation",
        displayName: "Organisation",
        description: "Für kleine Teams",
        price: 4900, // 49€ pro Jahr in Cent (jährliche Abrechnung)
        maxProjects: 10,
        maxBoards: 20,
        maxTeams: 5,
        maxUsersPerCompany: 10,
        maxTasks: 500,
        maxOkrs: 10,
        hasGanttView: true,
        hasAdvancedReporting: true,
        hasApiAccess: true,
        hasCustomBranding: false,
        hasPrioritySupport: false,
        requiresCompany: true,
        isActive: true
      },
      {
        name: "enterprise",
        displayName: "Enterprise",
        description: "Für große Unternehmen",
        price: 9900, // 99€ pro Jahr in Cent (jährliche Abrechnung)
        maxProjects: 50,
        maxBoards: 100,
        maxTeams: 20,
        maxUsersPerCompany: 30,
        maxTasks: 2000,
        maxOkrs: 50,
        hasGanttView: true,
        hasAdvancedReporting: true,
        hasApiAccess: true,
        hasCustomBranding: true,
        hasPrioritySupport: true,
        requiresCompany: true,
        isActive: true
      },
      {
        name: "kanbax",
        displayName: "kanbax",
        description: "Internes Paket für kanbax-Mitarbeiter",
        price: 0, // Kostenlos für interne Nutzung
        maxProjects: 999999, // Praktisch unbegrenzt
        maxBoards: 999999, // Praktisch unbegrenzt
        maxTeams: 999999, // Praktisch unbegrenzt
        maxUsersPerCompany: 999999, // Praktisch unbegrenzt
        maxTasks: 999999, // Praktisch unbegrenzt
        maxOkrs: 999999, // Praktisch unbegrenzt
        hasGanttView: true,
        hasAdvancedReporting: true,
        hasApiAccess: true,
        hasCustomBranding: true,
        hasPrioritySupport: true,
        requiresCompany: true,
        hasTeamFeatures: true,
        hasOkrFeatures: true,
        isActive: true
      }
    ];
  }

  /**
   * Prüft, ob eine Firma die maximale Anzahl an Aufgaben erreicht hat
   */
  async hasReachedTaskLimit(companyId: number): Promise<boolean> {
    try {
      // 1. Benutzer des Unternehmens finden
      const usersResult = await db.query.users.findMany({
        where: eq(users.companyId, companyId)
      });
      const userIds = usersResult.map(user => user.id);

      if (userIds.length === 0) return false;

      // 2. Anzahl der Tasks für das Unternehmen abrufen
      const userIdsStr = userIds.join(',');
      const taskCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM tasks WHERE assigned_user_ids && ARRAY[${sql.raw(userIdsStr)}]`
      );
      const taskCount = parseInt(String(taskCountResult.rows[0]?.count) || "0");

      // 3. Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 4. Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";

      // 5. Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      if (!packageLimits) {
        // Standardlimit für "free" Abonnement
        const DEFAULT_FREE_MAX_TASKS = 10; // 10 Tasks für kostenlose Nutzer (muss mit taskLimitMiddleware.ts übereinstimmen)
        console.log(`Tasklimit-Prüfung: Keine Paketlimits gefunden, verwende Standard (${DEFAULT_FREE_MAX_TASKS})`);
        return taskCount >= DEFAULT_FREE_MAX_TASKS;
      }

      // "999999" oder ähnlich hohe Werte bedeuten "unbegrenzt"
      if (packageLimits.maxTasks >= 999999) {
        return false;
      }

      return taskCount >= packageLimits.maxTasks;
    } catch (error) {
      console.error("Fehler bei der Überprüfung des Task-Limits:", error);
      return false; // Im Fehlerfall erlauben wir die Erstellung
    }
  }

  /**
   * Prüft, ob eine Firma die maximale Anzahl an OKRs erreicht hat
   */
  async hasReachedOkrLimit(companyId: number): Promise<boolean> {
    try {
      // 1. Benutzer des Unternehmens finden
      const usersResult = await db.query.users.findMany({
        where: eq(users.companyId, companyId)
      });
      const userIds = usersResult.map(user => user.id);

      if (userIds.length === 0) return false;

      // 2. Anzahl der Objectives für das Unternehmen abrufen
      const userIdsStr = userIds.join(',');
      const objectiveCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM objectives WHERE creator_id IN (${sql.raw(userIdsStr)}) AND archived = false`
      );
      const objectiveCount = parseInt(String(objectiveCountResult.rows[0]?.count) || "0");

      // 3. Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 4. Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";

      // 5. Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      if (!packageLimits) {
        // Standardlimit für "free" Abonnement
        return objectiveCount >= 0; // 0 OKRs für kostenlose Nutzer
      }

      // "999999" oder ähnlich hohe Werte bedeuten "unbegrenzt"
      if (packageLimits.maxOkrs >= 999999) {
        return false;
      }

      return objectiveCount >= packageLimits.maxOkrs;
    } catch (error) {
      console.error("Fehler bei der Überprüfung des OKR-Limits:", error);
      return false; // Im Fehlerfall erlauben wir die Erstellung
    }
  }

  /**
   * Prüft, ob eine Firma die maximale Anzahl an Projekten erreicht hat
   */
  async hasReachedProjectLimit(companyId: number): Promise<boolean> {
    try {
      // 1. Anzahl der Projekte für das Unternehmen abrufen
      const projectCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM projects WHERE company_id = ${sql.raw(companyId.toString())} AND archived = false`
      );
      const projectCount = parseInt(String(projectCountResult.rows[0]?.count) || "0");
      console.log(`Projektlimit-Prüfung: Unternehmen ${companyId} hat ${projectCount} Projekte`);

      // 2. Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 3. Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";
      console.log(`Projektlimit-Prüfung: Abonnement-Stufe ist "${subscriptionTier}"`);

      // 4. Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      // Die Standardwerte aus getDefaultPackages() verwenden
      const DEFAULT_FREE_MAX_PROJECTS = 1; // Muss mit getDefaultPackages() übereinstimmen
      
      if (!packageLimits) {
        console.log(`Projektlimit-Prüfung: Keine Paketlimits gefunden, verwende Standard (${DEFAULT_FREE_MAX_PROJECTS})`);
        // Standardlimit für "free" Abonnement
        return projectCount >= DEFAULT_FREE_MAX_PROJECTS; 
      }
      
      console.log(`Projektlimit-Prüfung: Paketlimit ist ${packageLimits.maxProjects}, aktuelle Anzahl: ${projectCount}`);
      
      // "999999" oder ähnlich hohe Werte bedeuten "unbegrenzt"
      if (packageLimits.maxProjects >= 999999) {
        return false;
      }

      const hasReachedLimit = projectCount >= packageLimits.maxProjects;
      console.log(`Projektlimit-Prüfung: Limit erreicht? ${hasReachedLimit}`);
      return hasReachedLimit;
    } catch (error) {
      console.error("Fehler bei der Überprüfung des Projektlimits:", error);
      return false; // Im Fehlerfall erlauben wir die Erstellung
    }
  }

  /**
   * Prüft, ob eine Firma die maximale Anzahl an Boards erreicht hat
   */
  async hasReachedBoardLimit(companyId: number): Promise<boolean> {
    try {
      // 1. Benutzer des Unternehmens finden
      const usersResult = await db.query.users.findMany({
        where: eq(users.companyId, companyId)
      });
      const userIds = usersResult.map(user => user.id);

      if (userIds.length === 0) return false;

      // 2. Anzahl der Boards für das Unternehmen abrufen (Boards, die von Benutzern des Unternehmens erstellt wurden)
      // Verwende Drizzle-Query-Builder statt Raw-SQL für bessere Typsicherheit
      const boardCountResult = await db.select({
        count: count()
      })
      .from(boards)
      .where(
        and(
          inArray(boards.creator_id, userIds),
          eq(boards.archived, false)
        )
      );
      
      const boardCount = parseInt(String(boardCountResult[0]?.count) || "0");
      console.log(`Boardlimit-Prüfung: Unternehmen ${companyId} hat ${boardCount} Boards`);

      // 3. Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 4. Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";
      console.log(`Boardlimit-Prüfung: Abonnement-Stufe ist "${subscriptionTier}"`);

      // 5. Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      // Die Standardwerte aus getDefaultPackages() verwenden
      const DEFAULT_FREE_MAX_BOARDS = 1; // Muss mit getDefaultPackages() übereinstimmen
      
      if (!packageLimits) {
        console.log(`Boardlimit-Prüfung: Keine Paketlimits gefunden, verwende Standard (${DEFAULT_FREE_MAX_BOARDS})`);
        // Standardlimit für "free" Abonnement
        return boardCount >= DEFAULT_FREE_MAX_BOARDS;
      }
      
      console.log(`Boardlimit-Prüfung: Paketlimit ist ${packageLimits.maxBoards}, aktuelle Anzahl: ${boardCount}`);
      
      // "999999" oder ähnlich hohe Werte bedeuten "unbegrenzt"
      if (packageLimits.maxBoards >= 999999) {
        return false;
      }

      const hasReachedLimit = boardCount >= packageLimits.maxBoards;
      console.log(`Boardlimit-Prüfung: Limit erreicht? ${hasReachedLimit}`);
      return hasReachedLimit;
    } catch (error) {
      console.error("Fehler bei der Überprüfung des Board-Limits:", error);
      return false; // Im Fehlerfall erlauben wir die Erstellung
    }
  }

  /**
   * Prüft, ob eine Firma die maximale Anzahl an Teams erreicht hat
   */
  async hasReachedTeamLimit(companyId: number): Promise<boolean> {
    try {
      // 1. Anzahl der Teams für das Unternehmen abrufen
      const teamCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM teams WHERE company_id = ${sql.raw(companyId.toString())}`
      );
      const teamCount = parseInt(String(teamCountResult.rows[0]?.count) || "0");

      // 2. Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 3. Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";

      // 4. Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      if (!packageLimits) {
        // Standardlimit für "free" Abonnement
        return teamCount >= 2; // 2 Teams für kostenlose Nutzer
      }

      return teamCount >= packageLimits.maxTeams;
    } catch (error) {
      console.error("Fehler bei der Überprüfung des Team-Limits:", error);
      return false; // Im Fehlerfall erlauben wir die Erstellung
    }
  }

  /**
   * Prüft, ob eine Firma die maximale Anzahl an Aufgaben erreicht hat
   */
  async hasReachedTaskLimit(companyId: number): Promise<boolean> {
    try {
      // 1. Benutzer des Unternehmens finden
      const usersResult = await db.query.users.findMany({
        where: eq(users.companyId, companyId)
      });
      const userIds = usersResult.map(user => user.id);

      if (userIds.length === 0) return false;

      // 2. Anzahl der Aufgaben abrufen, die von Benutzern des Unternehmens erstellt wurden
      const taskCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM tasks WHERE assigned_user_ids && ARRAY[${sql.join(userIds, sql`, `)}]`
      );
      const taskCount = parseInt(String(taskCountResult.rows[0]?.count) || "0");
      console.log(`Tasklimit-Prüfung: Unternehmen ${companyId} hat ${taskCount} Aufgaben`);

      // 3. Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 4. Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";
      console.log(`Tasklimit-Prüfung: Abonnement-Stufe ist "${subscriptionTier}"`);

      // 5. Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      if (!packageLimits) {
        // Standardlimit für "free" Abonnement
        const DEFAULT_FREE_MAX_TASKS = 10; // Muss mit getDefaultPackages() und taskLimitMiddleware.ts übereinstimmen
        console.log(`Tasklimit-Prüfung: Keine Paketlimits gefunden, verwende Standard (${DEFAULT_FREE_MAX_TASKS})`);
        return taskCount >= DEFAULT_FREE_MAX_TASKS;
      }

      console.log(`Tasklimit-Prüfung: Paketlimit ist ${packageLimits.maxTasks}, aktuelle Anzahl: ${taskCount}`);

      // "999999" oder ähnlich hohe Werte bedeuten "unbegrenzt"
      if (packageLimits.maxTasks >= 999999) {
        return false;
      }

      const hasReachedLimit = taskCount >= packageLimits.maxTasks;
      console.log(`Tasklimit-Prüfung: Limit erreicht? ${hasReachedLimit}`);
      return hasReachedLimit;
    } catch (error) {
      console.error("Fehler bei der Überprüfung des Aufgabenlimits:", error);
      return false; // Im Fehlerfall erlauben wir die Erstellung
    }
  }
  
  /**
   * Gibt den Namen des aktuellen Abonnements für ein Unternehmen zurück
   */
  async getCurrentSubscriptionName(companyId: number): Promise<string | null> {
    try {
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });
      
      return paymentInfo?.subscriptionTier || "free";
    } catch (error) {
      console.error("Fehler beim Abrufen des Abonnementnamens:", error);
      return "free"; // Im Fehlerfall gehen wir vom kostenlosen Plan aus
    }
  }

  /**
   * Prüft, ob eine Firma die maximale Anzahl an Benutzern erreicht hat
   */
  async hasReachedUserLimit(companyId: number): Promise<boolean> {
    try {
      // 1. Anzahl der aktiven Benutzer für das Unternehmen abrufen
      const userCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM users WHERE company_id = ${sql.raw(companyId.toString())} AND is_active = true`
      );
      const userCount = parseInt(String(userCountResult.rows[0]?.count) || "0");

      // 2. Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 3. Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";

      // 4. Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      if (!packageLimits) {
        // Standardlimit für "free" Abonnement
        return userCount >= 5; // 5 Benutzer für kostenlose Nutzer
      }

      return userCount >= packageLimits.maxUsersPerCompany;
    } catch (error) {
      console.error("Fehler bei der Überprüfung des Benutzer-Limits:", error);
      return false; // Im Fehlerfall erlauben wir die Erstellung
    }
  }

  /**
   * Prüft, ob ein Benutzer Teams oder zusätzliche Benutzer hinzufügen darf
   * In den Paketen "Free" und "Freelancer" ist dies nicht erlaubt
   */
  async canAddTeamMembers(userId: number): Promise<boolean> {
    try {
      // Benutzerinformationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) return false;
      
      // In Free und Freelancer-Paketen ist das Hinzufügen von Team-Mitgliedern nicht erlaubt
      if (user.subscriptionTier === "free" || user.subscriptionTier === "freelancer") {
        return false;
      }
      
      // Für alle anderen Pakete ist es erlaubt
      return true;
    } catch (error) {
      console.error("Fehler bei der Überprüfung der Team-Mitglieder-Berechtigung:", error);
      return false; // Im Fehlerfall verweigern wir den Zugriff
    }
  }
  
  /**
   * Prüft, ob ein Benutzer Teams zuweisen darf
   * In den Paketen "Free" und "Freelancer" ist dies nicht erlaubt
   */
  async canAssignTeams(userId: number): Promise<boolean> {
    try {
      // Benutzerinformationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) return false;
      
      // In Free und Freelancer-Paketen ist das Zuweisen von Teams nicht erlaubt
      if (user.subscriptionTier === "free" || user.subscriptionTier === "freelancer") {
        return false;
      }
      
      // Für alle anderen Pakete ist es erlaubt
      return true;
    } catch (error) {
      console.error("Fehler bei der Überprüfung der Team-Zuweisung-Berechtigung:", error);
      return false; // Im Fehlerfall verweigern wir den Zugriff
    }
  }
  
  /**
   * Prüft, ob eine Firma Zugriff auf eine bestimmte Funktion hat
   */
  async hasFeatureAccess(companyId: number, featureName: string): Promise<boolean> {
    try {
      // Abonnement-Stufe des Unternehmens abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // Wenn kein Zahlungsinfo, dann Standard-Tier "free" verwenden
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";

      // Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      if (!packageLimits) {
        // Für "free" sind nur Basis-Features verfügbar
        return featureName === "basicFeatures";
      }

      // Prüfe anhand des Feature-Namens, ob die Funktion verfügbar ist
      switch (featureName) {
        case "teams":
          return packageLimits.hasTeamFeatures === true;
        case "okrs":
          return packageLimits.hasOkrFeatures === true;
        case "ganttView":
          return packageLimits.hasGanttView === true;
        case "advancedReporting":
          return packageLimits.hasAdvancedReporting === true;
        case "apiAccess":
          return packageLimits.hasApiAccess === true;
        case "customBranding":
          return packageLimits.hasCustomBranding === true;
        case "prioritySupport":
          return packageLimits.hasPrioritySupport === true;
        case "basicFeatures":
          return true; // Basis-Features sind in allen Paketen verfügbar
        default:
          return false;
      }
    } catch (error) {
      console.error(`Fehler bei der Überprüfung des Zugriffs auf Feature "${featureName}":`, error);
      return false; // Im Fehlerfall verweigern wir den Zugriff
    }
  }

  /**
   * Aktualisiert das Abonnement einer Firma (intern, nicht für Stripe)
   * @param companyId Die ID des Unternehmens
   * @param newTier Das neue Abonnement-Tier
   * @param userId Die ID des Benutzers, der die Änderung durchführt
   * @param billingCycle Der Abrechnungszyklus (monatlich oder jährlich)
   */
  async updateSubscription(companyId: number, newTier: string, userId?: number, billingCycle: string = 'monthly'): Promise<boolean> {
    try {
      console.log(`Aktualisiere Abonnement für Unternehmen ${companyId} auf ${newTier} durch Benutzer ${userId} mit Abrechnungszyklus ${billingCycle}`);
      
      // Billingzyklus normalisieren
      const normalizedBillingCycle = billingCycle && billingCycle.toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
      
      // Berechne Ablaufdatum basierend auf Abrechnungszyklus
      const expirationPeriod = normalizedBillingCycle === 'yearly'
        ? 365 * 24 * 60 * 60 * 1000  // 1 Jahr in Millisekunden
        : 30 * 24 * 60 * 60 * 1000;  // 30 Tage in Millisekunden
      
      // Ablaufdatum (null für Free-Tier)
      const subscriptionEndDate = newTier.toLowerCase() === 'free'
        ? null
        : new Date(Date.now() + expirationPeriod);
      
      // 1. Aktuelles Abonnement abrufen
      const currentPaymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, companyId)
      });

      // 2. Wenn es kein aktuelles Abonnement gibt, ein neues erstellen
      if (!currentPaymentInfo) {
        // Firmeninformationen abrufen
        const company = await db.query.companies.findFirst({
          where: eq(companies.id, companyId)
        });

        if (!company) {
          throw new Error("Firma nicht gefunden");
        }

        // Werte mit korrektem Abrechnungszyklus eintragen
        await db.insert(companyPaymentInfo).values({
          companyId,
          subscriptionTier: newTier,
          subscriptionStatus: "active",
          subscriptionStartDate: new Date(),
          subscriptionEndDate,
          billingCycle: normalizedBillingCycle, // Abrechnungszyklus explizit speichern
          billingEmail: "billing@example.com", // Default
          billingName: company.name
        });

        // Audit-Log erstellen
        await db.insert(subscriptionAuditLogs).values({
          companyId,
          userId,
          action: "create",
          newTier,
          details: `Abonnement erstellt (${normalizedBillingCycle})`
        });

        return true;
      }

      // 3. Abonnement aktualisieren
      const oldTier = currentPaymentInfo.subscriptionTier;
      await db.update(companyPaymentInfo)
        .set({
          subscriptionTier: newTier,
          billingCycle: normalizedBillingCycle, // Abrechnungszyklus explizit aktualisieren
          subscriptionEndDate,
          updatedAt: new Date()
        })
        .where(eq(companyPaymentInfo.companyId, companyId));

      // 4. Audit-Log erstellen
      await db.insert(subscriptionAuditLogs).values({
        companyId,
        userId,
        action: newTier === "free" ? "downgrade" : oldTier === "free" ? "upgrade" : "change_tier",
        oldTier,
        newTier,
        details: `Abonnement von ${oldTier} auf ${newTier} geändert`
      });

      return true;
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Abonnements:", error);
      return false;
    }
  }
  
  /**
   * Aktualisiert das Abonnement-Tier eines Benutzers
   * @param userId Die ID des Benutzers
   * @param newTier Das neue Abonnement-Tier
   * @param adminUserId Die ID des Administrators, der die Änderung durchführt (optional)
   * @param billingCycle Der Abrechnungszyklus (monatlich oder jährlich)
   */
  async updateUserSubscriptionTier(userId: number, newTier: string, adminUserId?: number, billingCycle: string = 'monthly'): Promise<boolean> {
    try {
      console.log(`Aktualisiere Benutzer-Abonnement für Benutzer ${userId} auf ${newTier} durch Admin ${adminUserId} mit Abrechnungszyklus ${billingCycle}`);
      
      // Billingzyklus normalisieren
      const normalizedBillingCycle = billingCycle && billingCycle.toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
      
      // Berechne Ablaufdatum basierend auf Abrechnungszyklus
      const expirationPeriod = normalizedBillingCycle === 'yearly'
        ? 365 * 24 * 60 * 60 * 1000  // 1 Jahr in Millisekunden
        : 30 * 24 * 60 * 60 * 1000;  // 30 Tage in Millisekunden
      
      // Ablaufdatum (nur für kostenpflichtige Tiers)
      const subscriptionExpiresAt = newTier.toLowerCase() === 'free'
        ? null
        : new Date(Date.now() + expirationPeriod);
      
      // User-Informationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        throw new Error("Benutzer nicht gefunden");
      }

      const oldTier = user.subscriptionTier || "free";
      
      // Update des Benutzerprofils
      await db.update(users)
        .set({
          subscriptionTier: newTier,
          subscriptionBillingCycle: normalizedBillingCycle,
          subscriptionExpiresAt: subscriptionExpiresAt
        })
        .where(eq(users.id, userId));

      // Audit-Log erstellen
      await db.insert(subscriptionAuditLogs).values({
        userId,
        action: "user_subscription_change",
        oldTier,
        newTier,
        changedByUserId: adminUserId,
        details: `Benutzer-Abonnement von ${oldTier} auf ${newTier} geändert`
      });

      return true;
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Benutzer-Abonnements:", error);
      return false;
    }
  }

  /**
   * Gibt die Standard-Paket-Definition zurück für die Initialisierung der Datenbank
   * (Diese Version ist für die Datenbank-Initialisierung)
   */
  getDefaultPackagesForDb() {
    return [
      {
        name: "free",
        displayName: "Kostenlos",
        description: "Grundlegende Funktionen für Einzelpersonen",
        price: 0,
        maxProjects: 1, // Nur 1 Projekt erlaubt für Free-Benutzer
        maxBoards: 1,   // 1 Board für Free-Benutzer
        maxTeams: 0,
        maxUsersPerCompany: 1,
        maxTasks: 10,   // 10 Tasks um mit der Hauptkonfiguration übereinzustimmen
        maxOkrs: 0,
        hasGanttView: false,
        hasAdvancedReporting: false,
        hasApiAccess: false,
        hasCustomBranding: false,
        hasPrioritySupport: false,
        requiresCompany: false
      },
      {
        name: "freelancer",
        displayName: "Freelancer",
        description: "Erweitertes Paket für Einzelpersonen",
        price: 800, // 8,00 € (monatliche oder jährliche Abrechnung möglich)
        maxProjects: 5,
        maxBoards: 5,
        maxTeams: 0,
        maxUsersPerCompany: 1,
        maxTasks: 999999, // unbegrenzt
        maxOkrs: 0,
        hasGanttView: true,
        hasAdvancedReporting: false,
        hasApiAccess: false,
        hasCustomBranding: false,
        hasPrioritySupport: false,
        requiresCompany: false
      },
      {
        name: "organisation",
        displayName: "Organisation",
        description: "Umfassende Funktionen für kleine und mittelgroße Teams",
        price: 2900, // 29,00 € (monatliche oder jährliche Abrechnung möglich)
        maxProjects: 10,
        maxBoards: 999999, // unbegrenzt
        maxTeams: 4,
        maxUsersPerCompany: 10,
        maxTasks: 999999, // unbegrenzt
        maxOkrs: 3,
        hasGanttView: true,
        hasAdvancedReporting: true,
        hasApiAccess: false,
        hasCustomBranding: false,
        hasPrioritySupport: false,
        requiresCompany: true
      },
      {
        name: "enterprise",
        displayName: "Enterprise",
        description: "Unbegrenzte Funktionen für große Unternehmen",
        price: 7900, // 79,00 € (monatliche oder jährliche Abrechnung möglich)
        maxProjects: 999999, // unbegrenzt
        maxBoards: 999999, // unbegrenzt
        maxTeams: 999999, // unbegrenzt
        maxUsersPerCompany: 30,
        maxTasks: 999999, // unbegrenzt
        maxOkrs: 999999, // unbegrenzt
        hasGanttView: true,
        hasAdvancedReporting: true,
        hasApiAccess: true,
        hasCustomBranding: true,
        hasPrioritySupport: true,
        requiresCompany: true
      },
      {
        name: "kanbax",
        displayName: "kanbax",
        description: "Spezialpaket mit unbegrenzten Funktionen",
        price: 0,
        maxProjects: 999999, // unbegrenzt
        maxBoards: 999999, // unbegrenzt
        maxTeams: 999999, // unbegrenzt
        maxUsersPerCompany: 999999, // unbegrenzt
        maxTasks: 999999, // unbegrenzt
        maxOkrs: 999999, // unbegrenzt
        hasGanttView: true,
        hasAdvancedReporting: true,
        hasApiAccess: true,
        hasCustomBranding: true,
        hasPrioritySupport: true,
        requiresCompany: false
      }
    ];
  }
}

export const subscriptionService = new SubscriptionService();

// SQL-Helper entfernt, da wir sql aus drizzle-orm importieren