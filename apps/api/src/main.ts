import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import * as express from 'express';
import * as path from 'node:path';
import { AppModule } from './app.module';

function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAllowedOrigins(): string[] {
  const origins = [
    ...parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
    process.env.DASHBOARD_ORIGIN,
    process.env.LANDING_ORIGIN,
    'http://localhost:5173',
    'http://localhost:5174',
  ]
    .map((item) => item?.trim())
    .filter(Boolean) as string[];

  return Array.from(new Set(origins));
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function requestIdentifier(request: Request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  const rawForwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0];
  const ip = rawForwarded?.trim() || request.ip || request.socket.remoteAddress || 'unknown';
  const rawApiKey = request.headers['x-api-key'];
  const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;

  return apiKey ? `key:${apiKey}` : `ip:${ip}`;
}

function createRateLimitMiddleware(
  keyPrefix: string,
  windowMs: number,
  limit: number,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    const key = `${keyPrefix}:${requestIdentifier(request)}`;
    const now = Date.now();
    const current = rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (current.count >= limit) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      response.setHeader('Retry-After', retryAfter);
      response.status(429).json({
        message: 'Too many requests. Please retry later.',
      });
      return;
    }

    current.count += 1;
    rateLimitStore.set(key, current);
    next();
  };
}

function securityHeadersMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

function createBasicAuthMiddleware(username: string, password: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Basic ')) {
      response.setHeader('WWW-Authenticate', 'Basic realm="Swagger Docs"');
      response.status(401).send('Authentication required');
      return;
    }

    const encoded = authHeader.slice('Basic '.length);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    const providedUser =
      separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
    const providedPass =
      separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

    if (providedUser !== username || providedPass !== password) {
      response.setHeader('WWW-Authenticate', 'Basic realm="Swagger Docs"');
      response.status(401).send('Authentication required');
      return;
    }

    next();
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance();

  // Increase body size limit for media uploads (base64 images/docs)
  expressApp.use(require('express').json({ limit: '25mb' }));
  expressApp.use(require('express').urlencoded({ extended: true, limit: '25mb' }));
  const allowedOrigins = buildAllowedOrigins();
  const swaggerEnabled = (process.env.SWAGGER_ENABLED || 'true').toLowerCase() !== 'false';
  const swaggerBasicAuthUser = process.env.SWAGGER_BASIC_AUTH_USER || '';
  const swaggerBasicAuthPassword =
    process.env.SWAGGER_BASIC_AUTH_PASSWORD || '';

  // Serve uploaded media files (WhatsApp images received from customers)
  expressApp.use('/uploads', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.join(process.cwd(), 'uploads')));

  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

  app.use(securityHeadersMiddleware);
  app.use('/auth/login', createRateLimitMiddleware('auth-login', 15 * 60 * 1000, 20));
  app.use('/v1/otp/send', createRateLimitMiddleware('otp-send', 60 * 1000, 240));
  app.use('/v1/otp/verify', createRateLimitMiddleware('otp-verify', 60 * 1000, 300));
  app.use('/v1/whatsapp/session', createRateLimitMiddleware('wa-session', 60 * 1000, 60));
  app.use('/landing/orders', createRateLimitMiddleware('landing-orders', 60 * 1000, 20));
  app.use('/docs', createRateLimitMiddleware('swagger-docs', 60 * 1000, 60));
  app.use('/docs-json', createRateLimitMiddleware('swagger-docs-json', 60 * 1000, 60));

  if (swaggerEnabled && swaggerBasicAuthUser && swaggerBasicAuthPassword) {
    const basicAuthMiddleware = createBasicAuthMiddleware(
      swaggerBasicAuthUser,
      swaggerBasicAuthPassword,
    );
    app.use('/docs', basicAuthMiddleware);
    app.use('/docs-json', basicAuthMiddleware);
  }

  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('VAYRO API')
      .setDescription('VAYRO multi-tenant WhatsApp OTP backend')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
        'tenantApiKey',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(Number(process.env.PORT || 4000));
}

bootstrap();
