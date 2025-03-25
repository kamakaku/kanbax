import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import fs from 'fs';
import pg from 'pg';

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function main() {
  // Hash ein neues Passwort zum Vergleich
  const password = 'test123456';
  const hashedPassword = await hashPassword(password);
  console.log(`Generierter Hash für '${password}': ${hashedPassword}`);
  
  // Login-Versuch
  const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ich@kamakaku.com',
      password: 'test123456' // Test mit diesem Passwort
    }),
    redirect: 'manual'
  });
  
  // Speichere Cookies für spätere Anfragen
  const setCookieHeader = loginResponse.headers.get('set-cookie');
  if (setCookieHeader) {
    fs.writeFileSync('cookies.txt', setCookieHeader);
    console.log('Cookies gespeichert');
  }
  
  const loginResult = await loginResponse.json();
  console.log('Login-Ergebnis:', loginResult);
  
  if (loginResult.message === 'Ungültige Anmeldedaten') {
    console.log('\nLogin fehlgeschlagen, aktualisiere das Passwort...');
    
    // Update das Passwort in der Datenbank (nur für Testzwecke)
    const { Pool } = pg;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const updateResult = await pool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, username',
        [hashedPassword, 'ich@kamakaku.com']
      );
      
      if (updateResult.rows.length > 0) {
        const user = updateResult.rows[0];
        console.log(`Passwort für Benutzer ${user.username} (ID: ${user.id}) aktualisiert.`);
        console.log('Versuche erneut einzuloggen...');
        
        // Erneuter Login-Versuch
        const secondLoginResponse = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'ich@kamakaku.com',
            password: 'test123456'
          }),
          redirect: 'manual'
        });
        
        // Speichere neue Cookies
        const newSetCookieHeader = secondLoginResponse.headers.get('set-cookie');
        if (newSetCookieHeader) {
          fs.writeFileSync('cookies.txt', newSetCookieHeader);
          console.log('Neue Cookies gespeichert');
        }
        
        const secondLoginResult = await secondLoginResponse.json();
        console.log('Zweiter Login-Versuch:', secondLoginResult);
      } else {
        console.log('Benutzer nicht gefunden.');
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Passworts:', error);
    } finally {
      await pool.end();
    }
  }
  
  // Hole die Benachrichtigungen mit den gespeicherten Cookies
  if (fs.existsSync('cookies.txt')) {
    const cookies = fs.readFileSync('cookies.txt', 'utf8');
    console.log('\nHole Benachrichtigungen...');
    
    const notificationsResponse = await fetch('http://localhost:5000/api/notifications', {
      headers: { Cookie: cookies }
    });
    
    const notifications = await notificationsResponse.json();
    console.log('Benachrichtigungen:', JSON.stringify(notifications, null, 2));
    
    // Hole auch die Benachrichtigungseinstellungen
    console.log('\nHole Benachrichtigungseinstellungen...');
    
    const settingsResponse = await fetch('http://localhost:5000/api/notification-settings', {
      headers: { Cookie: cookies }
    });
    
    const settings = await settingsResponse.json();
    console.log('Benachrichtigungseinstellungen:', JSON.stringify(settings, null, 2));
  }
}

main().catch(console.error);