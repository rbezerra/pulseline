import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DbModule } from './db/db.module';
import { AiModule } from './ai/ai.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    DbModule,
    AiModule,
    TelemetryModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      subscriptions: {
        'graphql-ws': true,
      },
    }),
  ],
})
export class AppModule {}
