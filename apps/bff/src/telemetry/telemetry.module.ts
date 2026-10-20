import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { AiModule } from '../ai/ai.module';
import { TelemetrySimulatorService } from './telemetry-simulator.service';
import {
  TelemetryResolver,
  TestLineFieldResolver,
  TestRunFieldResolver,
} from './telemetry.resolver';
import { TelemetryService } from './telemetry.service';

const pubSubProvider = {
  provide: 'PUB_SUB',
  useValue: new PubSub(),
};

@Module({
  imports: [AiModule],
  providers: [
    pubSubProvider,
    TelemetryService,
    TelemetrySimulatorService,
    TelemetryResolver,
    TestLineFieldResolver,
    TestRunFieldResolver,
  ],
  exports: [TelemetryService, TelemetrySimulatorService, pubSubProvider],
})
export class TelemetryModule {}
