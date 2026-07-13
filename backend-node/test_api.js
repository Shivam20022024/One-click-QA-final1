const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
async function main() {
  const token = jwt.sign({ id: 'e45d2726-b5e7-4bb0-b745-ee4dd273d962' }, 'supersecretjwtkey', { expiresIn: '1d' });
  const res = await fetch('http://localhost:8080/api/v1/healing?status=PENDING', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
main();
