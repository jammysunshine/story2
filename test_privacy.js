const fs = require('fs');
const path = require('path');

try {
  // Simulate the backend logic
  // In the real code, it's path.join(__dirname, '..', 'POLICIES.md') because index.js is in server/
  // From here (root), it's just 'POLICIES.md'
  const policiesContent = fs.readFileSync('POLICIES.md', 'utf8');
  
  const htmlBody = policiesContent
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  console.log('✅ Success! File read and converted.');
  console.log('--- PREVIEW ---');
  console.log(htmlBody.substring(0, 300) + '...');
} catch (error) {
  console.error('❌ Failed:', error.message);
}

