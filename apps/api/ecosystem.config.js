/**
 * PM2 configuration for the WaOTP API.
 *
 * One process only: every WhatsApp session lives in this process's memory (the Map of
 * clients), so a second instance would launch a second Chrome for the same tenant and
 * fight over the same session files. Scale by moving to a bigger server, not more
 * instances, until sessions are moved out of process.
 */
module.exports = {
  apps: [
    {
      name: 'waotp-api',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      // Cap Node's own heap; the Chrome processes are capped separately (WA_CHROME_HEAP_MB).
      node_args: '--max-old-space-size=512',
      // A leak restarts the API instead of pushing the server into swap. Sessions
      // reconnect automatically on boot (onModuleInit), no QR needed.
      max_memory_restart: '1200M',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: '30s',
      kill_timeout: 10000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
