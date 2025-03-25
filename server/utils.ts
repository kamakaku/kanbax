import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Simple query client for server-side fetching
export const queryClient = {
  async fetch(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
};

// Helper function to create directory if it doesn't exist
export function ensureDirectoryExists(directory: string): void {
  if (!directory) return;
  
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// Generate a secure file name
export function generateSecureFilename(originalname: string): string {
  // Get the file extension
  const ext = path.extname(originalname).toLowerCase();
  
  // Generate a random string
  const randomString = crypto.randomBytes(16).toString('hex');
  
  // Sanitize the original filename
  const sanitizedName = originalname
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .substring(0, 32);
  
  // Return a combination of the original name and a random string
  return `${sanitizedName}-${randomString}${ext}`;
}