module.exports = {
  apps: [
    {
      name: 'waotp-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // whatsapp-web.js runs a headless Chrome per tenant; 500M was far too low and
      // caused frequent restarts that dropped realtime sockets. Give it real headroom.
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
