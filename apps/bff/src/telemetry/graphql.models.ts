import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  FailureLog,
  LineHealthStatus,
  MatchedRunbookRef,
  RootCauseScope,
  Runbook,
  TestLine,
  TestRun,
  TestRunStatus,
  TestStation,
  TriageDiagnosis,
} from '../domain/contracts';

@ObjectType()
export class TestStationModel implements TestStation {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  lineId: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  code: string;

  @Field(() => Int)
  sequenceOrder: number;

  @Field(() => String)
  instrumentModel: string;
}

@ObjectType()
export class TestLineModel implements TestLine {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  code: string;

  @Field(() => String)
  description: string;

  @Field(() => String)
  healthStatus: LineHealthStatus;

  @Field(() => Float)
  yieldPercentage: number;

  @Field(() => String, { nullable: true })
  activeDutSerial: string | null;

  @Field(() => Int)
  lastCycleLatencyMs: number;

  @Field(() => Int)
  consecutiveFailures: number;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => [TestStationModel], { nullable: true })
  stations?: TestStationModel[];
}

@ObjectType()
export class FailureLogModel implements Omit<FailureLog, 'rawPayload'> {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  testRunId: string;

  @Field(() => Date)
  timestamp: Date;

  @Field(() => String)
  source: 'DUT' | 'STATION_INSTRUMENT';

  @Field(() => String)
  severity: 'WARN' | 'ERROR' | 'FATAL';

  @Field(() => String)
  errorCode: string;

  @Field(() => String)
  message: string;

  @Field(() => String, { nullable: true })
  rawPayload?: string;
}

@ObjectType()
export class MatchedRunbookRefModel implements MatchedRunbookRef {
  @Field(() => String)
  runbookId: string;

  @Field(() => String)
  code: string;

  @Field(() => String)
  title: string;

  @Field(() => Float)
  similarityScore: number;
}

@ObjectType()
export class TriageDiagnosisModel implements TriageDiagnosis {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  testRunId: string;

  @Field(() => String)
  providerUsed: string;

  @Field(() => String)
  rootCauseScope: RootCauseScope;

  @Field(() => Float)
  confidence: number;

  @Field(() => String)
  summary: string;

  @Field(() => MatchedRunbookRefModel, { nullable: true })
  matchedRunbook: MatchedRunbookRefModel | null;

  @Field(() => [String])
  recommendedActions: string[];

  @Field(() => [String])
  evidenceLogs: string[];

  @Field(() => [String])
  toolCallsExecuted: string[];

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class TestRunModel implements Omit<TestRun, 'failureLogs'> {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  lineId: string;

  @Field(() => String)
  stationId: string;

  @Field(() => String)
  dutSerial: string;

  @Field(() => String)
  dutModel: string;

  @Field(() => String)
  firmwareVersion: string;

  @Field(() => String)
  status: TestRunStatus;

  @Field(() => Int)
  latencyMs: number;

  @Field(() => String, { nullable: true })
  errorCode: string | null;

  @Field(() => String, { nullable: true })
  stepFailed: string | null;

  @Field(() => Date)
  startedAt: Date;

  @Field(() => Date)
  completedAt: Date;

  @Field(() => [FailureLogModel], { nullable: true })
  failureLogs?: FailureLogModel[];

  @Field(() => TriageDiagnosisModel, { nullable: true })
  triageDiagnosis?: TriageDiagnosisModel | null;
}

@ObjectType()
export class RunbookModel implements Omit<Runbook, 'embedding'> {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  code: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  symptomSignature: string;

  @Field(() => String)
  rootCauseScope: RootCauseScope;

  @Field(() => String)
  technicalExplanation: string;

  @Field(() => [String])
  remediationSteps: string[];
}

@ObjectType()
export class SimulatorStatusModel {
  @Field(() => Boolean)
  running: boolean;

  @Field(() => Int)
  intervalMs: number;

  @Field(() => String)
  activeProvider: string;
}

@InputType()
export class IngestFailureLogInput {
  @Field(() => Date, { nullable: true })
  timestamp?: Date;

  @Field(() => String)
  source: 'DUT' | 'STATION_INSTRUMENT';

  @Field(() => String)
  severity: 'WARN' | 'ERROR' | 'FATAL';

  @Field(() => String)
  errorCode: string;

  @Field(() => String)
  message: string;

  @Field(() => String, { nullable: true })
  rawPayload?: string;
}

@InputType()
export class IngestTestRunInput {
  @Field(() => String)
  lineId: string;

  @Field(() => String)
  stationId: string;

  @Field(() => String)
  dutSerial: string;

  @Field(() => String)
  dutModel: string;

  @Field(() => String)
  firmwareVersion: string;

  @Field(() => String)
  status: TestRunStatus;

  @Field(() => Int)
  latencyMs: number;

  @Field(() => String, { nullable: true })
  errorCode?: string | null;

  @Field(() => String, { nullable: true })
  stepFailed?: string | null;

  @Field(() => Date)
  startedAt: Date;

  @Field(() => Date)
  completedAt: Date;

  @Field(() => [IngestFailureLogInput], { nullable: true })
  failureLogs?: IngestFailureLogInput[];
}
