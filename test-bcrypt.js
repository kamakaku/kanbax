import bcrypt from 'bcryptjs';

async function testCompare() {
  const password = "Neylani_2021";
  const storedHash = "$2b$10$AGkuCw1OqJGZJeUCvMsbien8WOoGQI9Bi0cmoMFO.fjfjfIBBXv42";
  
  // Test compare
  const isValid = await bcrypt.compare(password, storedHash);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${storedHash}`);
  console.log(`Comparison result: ${isValid}`);
}

testCompare();