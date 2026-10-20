import { Global, Module } from '@nestjs/common';
import { PULSELINE_REPOSITORY } from '../domain/contracts';
import { PulseLineRepository } from './pulseline.repository';

@Global()
@Module({
  providers: [
    {
      provide: PULSELINE_REPOSITORY,
      useClass: PulseLineRepository,
    },
  ],
  exports: [PULSELINE_REPOSITORY],
})
export class DbModule {}
