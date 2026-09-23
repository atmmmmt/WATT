export default () => ({
  port: Number(process.env.PORT || 4000),
  mongodbUri:
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/whatsapp-otp-platform',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  dashboardOrigin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5173',
  appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:4000',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
    fromName: process.env.SMTP_FROM_NAME || 'ProoTech Platform',
  },
});
