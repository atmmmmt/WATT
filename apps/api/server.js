const fs = require('fs');
const path = require('path');

const entryFile = path.join(__dirname, 'dist', 'main.js');

if (!fs.existsSync(entryFile)) {
  console.error(
    'Missing build output. Run "npm run build --workspace @waotp/api" before starting the backend.',
  );
  process.exit(1);
}

require(entryFile);
