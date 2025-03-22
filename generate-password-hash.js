import bcrypt from 'bcryptjs';

async function generateHash() {
  const password = 'password123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  
  // Verify hash works
  const isValid = await bcrypt.compare(password, hash);
  console.log(`Verification works: ${isValid}`);
}

generateHash();