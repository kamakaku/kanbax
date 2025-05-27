import type { Express } from "express";
import { pool } from "./db";
import { requireAuth } from "./middleware/auth";
import { permissionService } from "./permissions";
import fs from 'fs';
import path from 'path';

/**
 * DSGVO-konforme Datenexport-Routes
 * Ermöglicht Benutzern den vollständigen Export ihrer Daten
 */

interface ExportData {
  user: any;
  profile: any;
  projects: any[];
  boards: any[];
  tasks: any[];
  comments: any[];
  activityLogs: any[];
  teams: any[];
  objectives: any[];
  keyResults: any[];
  company?: any;
  exportMetadata: {
    exportDate: string;
    exportType: string;
    requestedBy: string;
    version: string;
  };
}

export function registerDataExportRoutes(app: Express) {
  
  // Route für persönlichen Datenexport (DSGVO Art. 20)
  app.get("/api/data-export/personal", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const format = req.query.format as string || 'json';
      
      console.log(`[DATA_EXPORT] Starting personal data export for user ${userId} in format ${format}`);
      
      const exportData = await collectPersonalData(userId);
      
      if (format === 'csv') {
        const csvData = await generateCSVExport(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="personal_data_export_${userId}_${Date.now()}.csv"`);
        return res.send(csvData);
      }
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="personal_data_export_${userId}_${Date.now()}.json"`);
        return res.json(exportData);
      }
      
      return res.status(400).json({ message: 'Unsupported format. Use json or csv' });
      
    } catch (error) {
      console.error('[DATA_EXPORT] Error exporting personal data:', error);
      res.status(500).json({ message: 'Fehler beim Exportieren der persönlichen Daten' });
    }
  });

  // Route für Firmen-Datenexport (nur für Admins)
  app.get("/api/data-export/company", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const format = req.query.format as string || 'json';
      
      // Prüfe, ob der Benutzer Admin seiner Firma ist
      const userResult = await pool.query(`
        SELECT company_id, is_company_admin FROM users WHERE id = $1
      `, [userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'Benutzer nicht gefunden' });
      }
      
      const user = userResult.rows[0];
      if (!user.is_company_admin || !user.company_id) {
        return res.status(403).json({ message: 'Nur Firmen-Administratoren können Firmendaten exportieren' });
      }
      
      console.log(`[DATA_EXPORT] Starting company data export for company ${user.company_id} by admin ${userId}`);
      
      const exportData = await collectCompanyData(user.company_id, userId);
      
      if (format === 'csv') {
        const csvData = await generateCSVExport(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="company_data_export_${user.company_id}_${Date.now()}.csv"`);
        return res.send(csvData);
      }
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="company_data_export_${user.company_id}_${Date.now()}.json"`);
        return res.json(exportData);
      }
      
      return res.status(400).json({ message: 'Unsupported format. Use json or csv' });
      
    } catch (error) {
      console.error('[DATA_EXPORT] Error exporting company data:', error);
      res.status(500).json({ message: 'Fehler beim Exportieren der Firmendaten' });
    }
  });

  // Route für Export-Status und verfügbare Optionen
  app.get("/api/data-export/info", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      // Prüfe Benutzerrolle und verfügbare Export-Optionen
      const userResult = await pool.query(`
        SELECT id, username, email, company_id, is_company_admin FROM users WHERE id = $1
      `, [userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'Benutzer nicht gefunden' });
      }
      
      const user = userResult.rows[0];
      const exportInfo = {
        availableExports: {
          personal: true,
          company: user.is_company_admin && user.company_id ? true : false
        },
        supportedFormats: ['json', 'csv'],
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          hasCompany: !!user.company_id,
          isCompanyAdmin: user.is_company_admin
        },
        gdprCompliant: true,
        lastExportDate: null // TODO: Implementiere Export-Historie
      };
      
      res.json(exportInfo);
      
    } catch (error) {
      console.error('[DATA_EXPORT] Error getting export info:', error);
      res.status(500).json({ message: 'Fehler beim Abrufen der Export-Informationen' });
    }
  });
}

/**
 * Sammelt alle persönlichen Daten eines Benutzers
 */
async function collectPersonalData(userId: number): Promise<ExportData> {
  console.log(`[DATA_EXPORT] Collecting personal data for user ${userId}`);
  
  try {
    // Grundlegende Benutzerdaten
    const userResult = await pool.query(`
      SELECT id, username, email, created_at, updated_at, 
             company_id, is_company_admin, subscription_tier
      FROM users WHERE id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      throw new Error('Benutzer nicht gefunden');
    }
    
    const user = userResult.rows[0];
    
    // Tasks - nur zugewiesene Tasks mit korrekten Spaltennamen
    let tasksData = [];
    try {
      const tasksResult = await pool.query(`
        SELECT id, title, description, status, "createdAt", "updatedAt", board_id
        FROM tasks 
        WHERE $1 = ANY(assigned_user_ids)
        ORDER BY "createdAt" DESC
      `, [userId]);
      tasksData = tasksResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Tasks query failed:`, error);
    }
    
    // Boards - nur die, auf die der Benutzer Zugriff hat
    let boardsData = [];
    try {
      const boardsResult = await pool.query(`
        SELECT id, title, description, "createdAt", project_id
        FROM boards 
        WHERE creator_id = $1 OR $1 = ANY(assigned_user_ids)
        ORDER BY "createdAt" DESC
      `, [userId]);
      boardsData = boardsResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Boards query failed:`, error);
    }
    
    // Projekte - nur die, auf die der Benutzer Zugriff hat
    let projectsData = [];
    try {
      const projectsResult = await pool.query(`
        SELECT id, title, description, "createdAt", creator_id
        FROM projects 
        WHERE creator_id = $1 OR $1 = ANY(assigned_user_ids)
        ORDER BY "createdAt" DESC
      `, [userId]);
      projectsData = projectsResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Projects query failed:`, error);
    }
    
    // OKRs - Objectives
    let objectivesData = [];
    try {
      const objectivesResult = await pool.query(`
        SELECT id, title, description, progress, "createdAt", "updatedAt"
        FROM objectives 
        WHERE creator_id = $1 OR $1 = ANY(assigned_user_ids)
        ORDER BY "createdAt" DESC
      `, [userId]);
      objectivesData = objectivesResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Objectives query failed:`, error);
    }
    
    // Key Results
    let keyResultsData = [];
    try {
      const keyResultsResult = await pool.query(`
        SELECT id, title, description, progress, target_value, "createdAt", "updatedAt", objective_id
        FROM key_results 
        WHERE creator_id = $1 OR $1 = ANY(assigned_user_ids)
        ORDER BY "createdAt" DESC
      `, [userId]);
      keyResultsData = keyResultsResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Key Results query failed:`, error);
    }
    
    // Teams - nur die, in denen der Benutzer Mitglied ist
    let teamsData = [];
    try {
      const teamsResult = await pool.query(`
        SELECT t.id, t.name, t.description, t."createdAt"
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = $1
        ORDER BY t."createdAt" DESC
      `, [userId]);
      teamsData = teamsResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Teams query failed:`, error);
    }
    
    // Kommentare des Benutzers - mit korrekter Spaltenname
    let commentsData = [];
    try {
      const commentsResult = await pool.query(`
        SELECT id, content, "createdAt", task_id
        FROM comments 
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
      `, [userId]);
      commentsData = commentsResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Comments query failed:`, error);
    }
    
    // Aktivitätsverlauf mit korrekter Spaltenname
    let activityData = [];
    try {
      const activityResult = await pool.query(`
        SELECT id, action, details, "createdAt"
        FROM activity_logs 
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1000
      `, [userId]);
      activityData = activityResult.rows;
    } catch (error) {
      console.log(`[DATA_EXPORT] Activity query failed:`, error);
    }
    
    // Company-Daten
    let companyData = null;
    if (user.company_id) {
      try {
        const companyResult = await pool.query(`
          SELECT id, name, description, created_at FROM companies WHERE id = $1
        `, [user.company_id]);
        companyData = companyResult.rows[0] || null;
      } catch (error) {
        console.log(`[DATA_EXPORT] Company query failed:`, error);
      }
    }
    
    return {
      user: user,
      profile: null,
      projects: projectsData,
      boards: boardsData,
      tasks: tasksData,
      comments: commentsData,
      activityLogs: activityData,
      teams: teamsData,
      objectives: objectivesData,
      keyResults: keyResultsData,
      company: companyData,
      exportMetadata: {
        exportDate: new Date().toISOString(),
        exportType: 'personal',
        requestedBy: user.username,
        version: '2.0'
      }
    };
  } catch (error) {
    console.error(`[DATA_EXPORT] Error in collectPersonalData:`, error);
    throw error;
  }
}

/**
 * Sammelt alle Firmendaten (nur für Admins)
 */
async function collectCompanyData(companyId: number, adminUserId: number): Promise<ExportData> {
  console.log(`[DATA_EXPORT] Collecting company data for company ${companyId}`);
  
  try {
    // Alle Benutzer der Firma
    const usersResult = await pool.query(`
      SELECT id, username, email, created_at, is_company_admin, subscription_tier
      FROM users WHERE company_id = $1
    `, [companyId]);
    
    // Firmendaten
    const companyResult = await pool.query(`
      SELECT id, name, description, created_at FROM companies WHERE id = $1
    `, [companyId]);
    
    // Admin-Benutzer für Metadaten
    const adminResult = await pool.query(`
      SELECT username FROM users WHERE id = $1
    `, [adminUserId]);
    
    return {
      user: usersResult.rows,
      profile: null,
      projects: [], // Kann später erweitert werden
      boards: [], // Kann später erweitert werden
      tasks: [], // Kann später erweitert werden
      comments: [],
      activityLogs: [],
      teams: [],
      objectives: [],
      keyResults: [],
      company: companyResult.rows[0],
      exportMetadata: {
        exportDate: new Date().toISOString(),
        exportType: 'company',
        requestedBy: adminResult.rows[0]?.username || 'Unknown',
        version: '1.0'
      }
    };
  } catch (error) {
    console.error(`[DATA_EXPORT] Error in collectCompanyData:`, error);
    throw error;
  }
}

/**
 * Generiert CSV-Export aus ExportData
 */
async function generateCSVExport(data: ExportData): Promise<string> {
  const csvLines: string[] = [];
  
  // Header
  csvLines.push('DSGVO-KONFORMER DATENEXPORT');
  csvLines.push(`Export-Datum: ${data.exportMetadata.exportDate}`);
  csvLines.push(`Export-Typ: ${data.exportMetadata.exportType}`);
  csvLines.push(`Angefordert von: ${data.exportMetadata.requestedBy}`);
  csvLines.push('');
  
  // Benutzerdaten
  if (data.user) {
    csvLines.push('=== BENUTZERDATEN ===');
    const user = Array.isArray(data.user) ? data.user[0] : data.user;
    if (user) {
      csvLines.push(`ID,Username,E-Mail,Erstellt am`);
      csvLines.push(`${user.id},"${user.username}","${user.email}","${user.created_at}"`);
    }
    csvLines.push('');
  }
  
  // Projekte
  if (data.projects && data.projects.length > 0) {
    csvLines.push('=== PROJEKTE ===');
    csvLines.push('ID,Titel,Beschreibung,Erstellt am');
    data.projects.forEach(project => {
      csvLines.push(`${project.id},"${project.title || ''}","${project.description || ''}","${project.created_at}"`);
    });
    csvLines.push('');
  }
  
  // Tasks
  if (data.tasks && data.tasks.length > 0) {
    csvLines.push('=== AUFGABEN ===');
    csvLines.push('ID,Titel,Beschreibung,Status,Erstellt am');
    data.tasks.forEach(task => {
      csvLines.push(`${task.id},"${task.title || ''}","${task.description || ''}","${task.status || ''}","${task.created_at}"`);
    });
    csvLines.push('');
  }
  
  return csvLines.join('\n');
}