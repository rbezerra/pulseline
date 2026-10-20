import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`[PulseLine BFF] GraphQL HTTP & WebSocket Server running on http://localhost:${port}/graphql`);
}

bootstrap();
