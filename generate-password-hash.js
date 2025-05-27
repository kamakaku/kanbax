import bcrypt from 'bcryptjs';

async function generateHash() {
  // Get password from command line argument or use default
  const password = process.argv[2] || 'password123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  
  // Verify hash works
  const isValid = await bcrypt.compare(password, hash);
  console.log(`Verification works: ${isValid}`);
}

generateHash();