import { Inject } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import {
  Runbook,
  ScenarioCode,
  TestLine,
  TestRun,
  TestRunStatus,
  TestStation,
  TriageDiagnosis,
} from '../domain/contracts';
import {
  IngestTestRunInput,
  RunbookModel,
  SimulatorStatusModel,
  TestLineModel,
  TestRunModel,
  TestStationModel,
  TriageDiagnosisModel,
} from './graphql.models';
import { TelemetrySimulatorService } from './telemetry-simulator.service';
import { TelemetryService } from './telemetry.service';

@Resolver()
export class TelemetryResolver {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
    @Inject(TelemetryService) private readonly telemetryService: TelemetryService,
    @Inject(TelemetrySimulatorService) private readonly simulatorService: TelemetrySimulatorService,
  ) {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  @Query(() => [TestLineModel], { name: 'testLines' })
  async testLines(): Promise<TestLine[]> {
    return this.telemetryService.getTestLines();
  }

  @Query(() => [TestRunModel], { name: 'recentTestRuns' })
  async recentTestRuns(
    @Args('lineId', { type: () => String, nullable: true }) lineId?: string,
    @Args('status', { type: () => String, nullable: true }) status?: TestRunStatus,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit?: number,
  ): Promise<TestRun[]> {
    return this.telemetryService.getRecentTestRuns({ lineId, status, limit });
  }

  @Query(() => TestRunModel, { name: 'testRun', nullable: true })
  async testRun(@Args('id', { type: () => ID }) id: string): Promise<TestRun | null> {
    return this.telemetryService.getTestRunById(id);
  }

  @Query(() => [RunbookModel], { name: 'runbooks' })
  async runbooks(): Promise<Runbook[]> {
    return this.telemetryService.getRunbooks();
  }

  @Query(() => SimulatorStatusModel, { name: 'simulatorStatus' })
  simulatorStatus(): SimulatorStatusModel {
    return this.simulatorService.getStatus();
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  @Mutation(() => TriageDiagnosisModel, { name: 'runAiTriage' })
  async runAiTriage(
    @Args('testRunId', { type: () => ID }) testRunId: string,
  ): Promise<TriageDiagnosis> {
    return this.telemetryService.triggerAiTriage(testRunId);
  }

  @Mutation(() => SimulatorStatusModel, { name: 'toggleSimulator' })
  toggleSimulator(
    @Args('running', { type: () => Boolean }) running: boolean,
  ): SimulatorStatusModel {
    return this.simulatorService.setRunning(running);
  }

  @Mutation(() => [TestRunModel], { name: 'injectFailureScenario' })
  async injectFailureScenario(
    @Args('scenarioCode', { type: () => String }) scenarioCode: ScenarioCode,
    @Args('lineId', { type: () => String, nullable: true }) lineId?: string,
  ): Promise<TestRun[]> {
    return this.simulatorService.injectFailureScenario(scenarioCode, lineId);
  }

  @Mutation(() => TestRunModel, { name: 'ingestTestRun' })
  async ingestTestRun(
    @Args('input', { type: () => IngestTestRunInput }) input: IngestTestRunInput,
  ): Promise<TestRun> {
    return this.telemetryService.ingestTestRun(input);
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  @Subscription(() => TestRunModel, {
    name: 'testRunCompleted',
    resolve: (payload: { testRunCompleted: TestRun }) => payload.testRunCompleted,
  })
  testRunCompleted() {
    return (this.pubSub as any).asyncIterableIterator
      ? (this.pubSub as any).asyncIterableIterator('TEST_RUN_COMPLETED')
      : (this.pubSub as any).asyncIterator('TEST_RUN_COMPLETED');
  }

  @Subscription(() => TestLineModel, {
    name: 'lineHealthUpdated',
    resolve: (payload: { lineHealthUpdated: TestLine }) => payload.lineHealthUpdated,
  })
  lineHealthUpdated() {
    return (this.pubSub as any).asyncIterableIterator
      ? (this.pubSub as any).asyncIterableIterator('LINE_HEALTH_UPDATED')
      : (this.pubSub as any).asyncIterator('LINE_HEALTH_UPDATED');
  }
}

@Resolver(() => TestLineModel)
export class TestLineFieldResolver {
  constructor(@Inject(TelemetryService) private readonly telemetryService: TelemetryService) {}

  @ResolveField(() => [TestStationModel], { nullable: true })
  async stations(@Parent() line: TestLineModel): Promise<TestStation[]> {
    if (line.stations && line.stations.length > 0) {
      return line.stations;
    }
    return this.telemetryService.getStationsByLine(line.id);
  }
}

@Resolver(() => TestRunModel)
export class TestRunFieldResolver {
  constructor(@Inject(TelemetryService) private readonly telemetryService: TelemetryService) {}

  @ResolveField(() => TriageDiagnosisModel, { nullable: true })
  async triageDiagnosis(@Parent() run: TestRunModel): Promise<TriageDiagnosis | null> {
    if (run.triageDiagnosis !== undefined) {
      return run.triageDiagnosis;
    }
    return this.telemetryService.getTriageDiagnosisByRunId(run.id);
  }
}
