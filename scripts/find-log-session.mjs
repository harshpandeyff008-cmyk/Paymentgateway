import fs from 'fs';
import path from 'path';

const filePath = 'c:\\Users\\harsh\\Desktop\\MY NEW\\src\\firebase\\firestore.js';
const fileContent = fs.readFileSync(filePath, 'utf8');

const lines = fileContent.split('\n');
console.log('Searching for logClientSession:');
lines.forEach((line, index) => {
  if (line.includes('logClientSession')) {
    console.log(`${index + 1}: ${line}`);
  }
});
