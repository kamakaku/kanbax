import fetch from 'node-fetch';
import fs from 'fs';

async function login() {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'marcus@example.com',
        password: 'password123'
      })
    });

    console.log('Status:', response.status);
    console.log('Headers:', response.headers.raw());
    
    // Save cookies
    const cookies = response.headers.raw()['set-cookie'];
    if (cookies) {
      fs.writeFileSync('cookies.txt', cookies.join('\n'));
      console.log('Cookies saved to cookies.txt');
    }
    
    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

login();