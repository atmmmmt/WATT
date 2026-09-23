import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';

async function bootstrap() {
  loadEnv({ path: '.env' });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const usersService = app.get(UsersService);
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';

    const admin = await usersService.ensureSuperAdmin(email, password, 'Platform Admin');
    console.log(`Super admin ready: ${admin.email}`);
  } finally {
    await app.close();
  }
}

bootstrap();
