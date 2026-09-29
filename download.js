const https = require('https');
const fs = require('fs');
const path = require('path');

const files = [
  {
    name: 'GLTFLoader.js',
    urls: [
      'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
      'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js'
    ]
  }
];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  for (const file of files) {
    for (const url of file.urls) {
      try {
        console.log(`Trying ${file.name}...`);
        const data = await download(url);
        if (data.length < 1000 || data.includes('<!DOCTYPE html>')) throw new Error('Looks like HTML');
        fs.writeFileSync(path.join(__dirname, file.name), data);
        console.log(`✅ Saved ${file.name} (${data.length} bytes)`);
        break;
      } catch (err) {
        console.log(`❌ ${err.message}`);
      }
    }
  }
})();
