import { Module } from '@nestjs/common';
import { AI_TRIAGE_PORT } from '../domain/contracts';
import { AiTriageService } from './ai-triage.service';

/**
 * AI Module implementing the Vendor-Agnostic AI Incident Triage Port (ADR-0001).
 *
 * Provides `AI_TRIAGE_PORT` adhering to the domain contracts, decoupling model
 * interactions behind the Vercel AI SDK and standardized 768-dimension vectors.
 */
@Module({
  providers: [
    {
      provide: AI_TRIAGE_PORT,
      useClass: AiTriageService,
    },
    AiTriageService,
  ],
  exports: [AI_TRIAGE_PORT, AiTriageService],
})
export class AiModule {}
