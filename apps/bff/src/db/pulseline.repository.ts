import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
// @ts-ignore - subpath export resolved at runtime
import { vector } from '@electric-sql/pglite/vector';
import {
  IPulseLineRepository,
  TestLine,
  TestStation,
  TestRun,
  FailureLog,
  Runbook,
  TriageDiagnosis,
  RunbookSearchMatch,
  TestRunStatus,
  LineHealthStatus,
  RootCauseScope,
} from '../domain/contracts';
import { seedTestLines, seedTestStations, seedRunbooks } from './seed-data';

interface QueryResult<T = any> {
  rows: T[];
}

function parseVector(val: unknown): number[] | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return val.map(Number);
  if (typeof val === 'string') {
    const cleaned = val.replace(/^\[|\]$/g, '').trim();
    if (!cleaned) return undefined;
    return cleaned.split(',').map((n) => parseFloat(n.trim()));
  }
  return undefined;
}

@Injectable()
export class PulseLineRepository implements IPulseLineRepository, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PulseLineRepository.name);
  private pool: Pool | null = null;
  private pglite: PGlite | null = null;
  private mode: 'postgres' | 'pglite' = 'pglite';

  async onModuleInit(): Promise<void> {
    await this.initializeConnection();
    await this.initializeSchema();
    await this.seedInitialData();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end().catch(() => {});
      this.pool = null;
    }
    if (this.pglite) {
      await this.pglite.close().catch(() => {});
      this.pglite = null;
    }
  }

  /**
   * Dual-mode Postgres connection:
   * 1. If DATABASE_URL is set and reachable, use pg.Pool
   * 2. Otherwise fall back to in-process PGlite with pgvector extension
   */
  private async initializeConnection(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl && dbUrl.trim() !== '') {
      try {
        this.logger.log('Attempting PostgreSQL connection via DATABASE_URL...');
        const testPool = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 3000,
        });
        await testPool.query('SELECT 1');
        this.pool = testPool;
        this.mode = 'postgres';
        this.logger.log('Successfully connected to external PostgreSQL database.');
        return;
      } catch (err: any) {
        this.logger.warn(
          `DATABASE_URL connection failed (${err.message}). Falling back to in-process PGlite with pgvector...`
        );
        if (this.pool) {
          await this.pool.end().catch(() => {});
          this.pool = null;
        }
      }
    } else {
      this.logger.log('DATABASE_URL not set. Initializing in-process PGlite with pgvector...');
    }

    try {
      this.pglite = new PGlite({
        extensions: { vector },
      });
      this.mode = 'pglite';
      this.logger.log('Initialized in-process PGlite instance with pgvector extension.');
    } catch (err: any) {
      this.logger.error(`Failed to initialize in-process PGlite: ${err.message}`, err.stack);
      throw err;
    }
  }

  private async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (this.mode === 'postgres' && this.pool) {
      return (await this.pool.query(text, params)) as unknown as QueryResult<T>;
    }
    if (this.pglite) {
      return this.pglite.query<T>(text, params);
    }
    throw new Error('PulseLine database driver is not initialized.');
  }

  private async initializeSchema(): Promise<void> {
    // 1. Vector extension
    await this.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // 2. test_lines table
    await this.query(`
      CREATE TABLE IF NOT EXISTS test_lines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        health_status TEXT NOT NULL,
        yield_percentage REAL NOT NULL,
        active_dut_serial TEXT,
        last_cycle_latency_ms INTEGER NOT NULL,
        consecutive_failures INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. test_stations table
    await this.query(`
      CREATE TABLE IF NOT EXISTS test_stations (
        id TEXT PRIMARY KEY,
        line_id TEXT NOT NULL REFERENCES test_lines(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        sequence_order INTEGER NOT NULL,
        instrument_model TEXT NOT NULL
      );
    `);

    // 4. test_runs table
    await this.query(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        line_id TEXT NOT NULL REFERENCES test_lines(id) ON DELETE CASCADE,
        station_id TEXT NOT NULL REFERENCES test_stations(id) ON DELETE CASCADE,
        dut_serial TEXT NOT NULL,
        dut_model TEXT NOT NULL,
        firmware_version TEXT NOT NULL,
        status TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        error_code TEXT,
        step_failed TEXT,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL
      );
    `);

    // 5. failure_logs table
    await this.query(`
      CREATE TABLE IF NOT EXISTS failure_logs (
        id TEXT PRIMARY KEY,
        test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ NOT NULL,
        source TEXT NOT NULL,
        severity TEXT NOT NULL,
        error_code TEXT NOT NULL,
        message TEXT NOT NULL,
        raw_payload JSONB
      );
    `);

    // 6. runbooks table
    await this.query(`
      CREATE TABLE IF NOT EXISTS runbooks (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        symptom_signature TEXT NOT NULL,
        root_cause_scope TEXT NOT NULL,
        technical_explanation TEXT NOT NULL,
        remediation_steps JSONB NOT NULL,
        embedding vector(768)
      );
    `);

    // 7. triage_diagnoses table
    await this.query(`
      CREATE TABLE IF NOT EXISTS triage_diagnoses (
        id TEXT PRIMARY KEY,
        test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
        provider_used TEXT NOT NULL,
        root_cause_scope TEXT NOT NULL,
        confidence REAL NOT NULL,
        summary TEXT NOT NULL,
        matched_runbook JSONB,
        recommended_actions JSONB NOT NULL,
        evidence_logs JSONB NOT NULL,
        tool_calls_executed JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Performance Indices
    await this.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_line_id ON test_runs(line_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_station_id ON test_runs(station_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_started_at ON test_runs(started_at DESC);`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_failure_logs_test_run_id ON failure_logs(test_run_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_triage_diagnoses_test_run_id ON triage_diagnoses(test_run_id);`);
  }

  private async seedInitialData(): Promise<void> {
    const countRes = await this.query(`SELECT COUNT(*) AS count FROM test_lines;`);
    const count = parseInt(String(countRes.rows[0]?.count ?? '0'), 10);
    if (count > 0) {
      this.logger.log(`Database already populated (${count} TestLines found). Skipping initial seed.`);
      return;
    }

    this.logger.log('Database empty. Seeding canonical TestLines, TestStations, and Runbooks...');

    // Seed test lines
    for (const line of seedTestLines) {
      await this.query(
        `INSERT INTO test_lines (
          id, name, code, description, health_status, yield_percentage,
          active_dut_serial, last_cycle_latency_ms, consecutive_failures, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING;`,
        [
          line.id,
          line.name,
          line.code,
          line.description,
          line.healthStatus,
          line.yieldPercentage,
          line.activeDutSerial,
          line.lastCycleLatencyMs,
          line.consecutiveFailures,
          line.updatedAt,
        ]
      );
    }

    // Seed test stations
    for (const station of seedTestStations) {
      await this.query(
        `INSERT INTO test_stations (
          id, line_id, name, code, sequence_order, instrument_model
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING;`,
        [
          station.id,
          station.lineId,
          station.name,
          station.code,
          station.sequenceOrder,
          station.instrumentModel,
        ]
      );
    }

    // Seed runbooks
    for (const rb of seedRunbooks) {
      const embeddingStr =
        rb.embedding && rb.embedding.length === 768 ? `[${rb.embedding.join(',')}]` : null;

      if (embeddingStr) {
        await this.query(
          `INSERT INTO runbooks (
            id, code, title, symptom_signature, root_cause_scope,
            technical_explanation, remediation_steps, embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::vector)
          ON CONFLICT (id) DO NOTHING;`,
          [
            rb.id,
            rb.code,
            rb.title,
            rb.symptomSignature,
            rb.rootCauseScope,
            rb.technicalExplanation,
            JSON.stringify(rb.remediationSteps),
            embeddingStr,
          ]
        );
      } else {
        await this.query(
          `INSERT INTO runbooks (
            id, code, title, symptom_signature, root_cause_scope,
            technical_explanation, remediation_steps, embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL)
          ON CONFLICT (id) DO NOTHING;`,
          [
            rb.id,
            rb.code,
            rb.title,
            rb.symptomSignature,
            rb.rootCauseScope,
            rb.technicalExplanation,
            JSON.stringify(rb.remediationSteps),
          ]
        );
      }
    }

    this.logger.log('Initial seed complete: 3 TestLines, 9 TestStations, 4 Runbooks.');
  }

  // --- IPulseLineRepository Implementation ---

  async getTestLines(): Promise<TestLine[]> {
    const linesRes = await this.query(`
      SELECT
        id,
        name,
        code,
        description,
        health_status,
        yield_percentage,
        active_dut_serial,
        last_cycle_latency_ms,
        consecutive_failures,
        updated_at
      FROM test_lines
      ORDER BY code ASC;
    `);

    const stationsRes = await this.query(`
      SELECT
        id,
        line_id,
        name,
        code,
        sequence_order,
        instrument_model
      FROM test_stations
      ORDER BY line_id ASC, sequence_order ASC;
    `);

    const stationsByLineId = new Map<string, TestStation[]>();
    for (const s of stationsRes.rows) {
      const list = stationsByLineId.get(s.line_id) ?? [];
      list.push(this.mapTestStationRow(s));
      stationsByLineId.set(s.line_id, list);
    }

    return linesRes.rows.map((row) => ({
      ...this.mapTestLineRow(row),
      stations: stationsByLineId.get(row.id) ?? [],
    }));
  }

  async getTestLineById(lineId: string): Promise<TestLine | null> {
    const res = await this.query(
      `SELECT
        id,
        name,
        code,
        description,
        health_status,
        yield_percentage,
        active_dut_serial,
        last_cycle_latency_ms,
        consecutive_failures,
        updated_at
      FROM test_lines
      WHERE id = $1 OR code = $1;`,
      [lineId]
    );

    if (!res.rows || res.rows.length === 0) {
      return null;
    }

    const stations = await this.getStationsByLine(res.rows[0].id);

    return {
      ...this.mapTestLineRow(res.rows[0]),
      stations,
    };
  }

  async updateTestLineMetrics(
    lineId: string,
    update: Partial<
      Pick<
        TestLine,
        | 'healthStatus'
        | 'yieldPercentage'
        | 'activeDutSerial'
        | 'lastCycleLatencyMs'
        | 'consecutiveFailures'
      >
    >
  ): Promise<TestLine> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];

    if (update.healthStatus !== undefined) {
      params.push(update.healthStatus);
      setClauses.push(`health_status = $${params.length}`);
    }
    if (update.yieldPercentage !== undefined) {
      params.push(update.yieldPercentage);
      setClauses.push(`yield_percentage = $${params.length}`);
    }
    if (update.activeDutSerial !== undefined) {
      params.push(update.activeDutSerial);
      setClauses.push(`active_dut_serial = $${params.length}`);
    }
    if (update.lastCycleLatencyMs !== undefined) {
      params.push(update.lastCycleLatencyMs);
      setClauses.push(`last_cycle_latency_ms = $${params.length}`);
    }
    if (update.consecutiveFailures !== undefined) {
      params.push(update.consecutiveFailures);
      setClauses.push(`consecutive_failures = $${params.length}`);
    }

    params.push(lineId);
    const whereIdx = params.length;

    await this.query(
      `UPDATE test_lines
       SET ${setClauses.join(', ')}
       WHERE id = $${whereIdx} OR code = $${whereIdx};`,
      params
    );

    const updated = await this.getTestLineById(lineId);
    if (!updated) {
      throw new Error(`TestLine with id '${lineId}' not found after update`);
    }
    return updated;
  }

  async getStationsByLine(lineId: string): Promise<TestStation[]> {
    const res = await this.query(
      `SELECT
        id,
        line_id,
        name,
        code,
        sequence_order,
        instrument_model
      FROM test_stations
      WHERE line_id = $1
      ORDER BY sequence_order ASC;`,
      [lineId]
    );

    return res.rows.map((row) => this.mapTestStationRow(row));
  }

  async getStationById(stationId: string): Promise<TestStation | null> {
    const res = await this.query(
      `SELECT
        id,
        line_id,
        name,
        code,
        sequence_order,
        instrument_model
      FROM test_stations
      WHERE id = $1 OR code = $1;`,
      [stationId]
    );

    if (!res.rows || res.rows.length === 0) {
      return null;
    }

    return this.mapTestStationRow(res.rows[0]);
  }

  async createTestRun(
    run: Omit<TestRun, 'id' | 'failureLogs' | 'triageDiagnosis'>,
    logs: Array<Omit<FailureLog, 'id' | 'testRunId'>>
  ): Promise<TestRun> {
    const runId = randomUUID();

    await this.query(
      `INSERT INTO test_runs (
        id,
        line_id,
        station_id,
        dut_serial,
        dut_model,
        firmware_version,
        status,
        latency_ms,
        error_code,
        step_failed,
        started_at,
        completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
      [
        runId,
        run.lineId,
        run.stationId,
        run.dutSerial,
        run.dutModel,
        run.firmwareVersion,
        run.status,
        run.latencyMs,
        run.errorCode,
        run.stepFailed,
        run.startedAt,
        run.completedAt,
      ]
    );

    const createdLogs: FailureLog[] = [];
    for (const log of logs) {
      const logId = randomUUID();
      await this.query(
        `INSERT INTO failure_logs (
          id,
          test_run_id,
          timestamp,
          source,
          severity,
          error_code,
          message,
          raw_payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb);`,
        [
          logId,
          runId,
          log.timestamp,
          log.source,
          log.severity,
          log.errorCode,
          log.message,
          log.rawPayload ? JSON.stringify(log.rawPayload) : null,
        ]
      );

      createdLogs.push({
        id: logId,
        testRunId: runId,
        timestamp: log.timestamp,
        source: log.source,
        severity: log.severity,
        errorCode: log.errorCode,
        message: log.message,
        rawPayload: log.rawPayload,
      });
    }

    return {
      id: runId,
      ...run,
      failureLogs: createdLogs,
      triageDiagnosis: null,
    };
  }

  async getTestRunById(testRunId: string): Promise<TestRun | null> {
    const runRes = await this.query(
      `SELECT
        id,
        line_id,
        station_id,
        dut_serial,
        dut_model,
        firmware_version,
        status,
        latency_ms,
        error_code,
        step_failed,
        started_at,
        completed_at
      FROM test_runs
      WHERE id = $1;`,
      [testRunId]
    );

    if (!runRes.rows || runRes.rows.length === 0) {
      return null;
    }

    const row = runRes.rows[0];

    const logsRes = await this.query(
      `SELECT
        id,
        test_run_id,
        timestamp,
        source,
        severity,
        error_code,
        message,
        raw_payload
      FROM failure_logs
      WHERE test_run_id = $1
      ORDER BY timestamp ASC;`,
      [testRunId]
    );

    const diagRes = await this.query(
      `SELECT
        id,
        test_run_id,
        provider_used,
        root_cause_scope,
        confidence,
        summary,
        matched_runbook,
        recommended_actions,
        evidence_logs,
        tool_calls_executed,
        created_at
      FROM triage_diagnoses
      WHERE test_run_id = $1
      ORDER BY created_at DESC
      LIMIT 1;`,
      [testRunId]
    );

    return {
      id: row.id,
      lineId: row.line_id,
      stationId: row.station_id,
      dutSerial: row.dut_serial,
      dutModel: row.dut_model,
      firmwareVersion: row.firmware_version,
      status: row.status as TestRunStatus,
      latencyMs: Number(row.latency_ms),
      errorCode: row.error_code,
      stepFailed: row.step_failed,
      startedAt: new Date(row.started_at),
      completedAt: new Date(row.completed_at),
      failureLogs: logsRes.rows.map((l) => this.mapFailureLogRow(l)),
      triageDiagnosis: diagRes.rows[0] ? this.mapTriageDiagnosisRow(diagRes.rows[0]) : null,
    };
  }

  async getRecentTestRuns(options?: {
    lineId?: string;
    stationId?: string;
    status?: TestRunStatus;
    limit?: number;
  }): Promise<TestRun[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.lineId) {
      params.push(options.lineId);
      conditions.push(`line_id = $${params.length}`);
    }
    if (options?.stationId) {
      params.push(options.stationId);
      conditions.push(`station_id = $${params.length}`);
    }
    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ?? 50;
    params.push(limit);
    const limitClause = `LIMIT $${params.length}`;

    const res = await this.query(
      `SELECT
        id,
        line_id,
        station_id,
        dut_serial,
        dut_model,
        firmware_version,
        status,
        latency_ms,
        error_code,
        step_failed,
        started_at,
        completed_at
      FROM test_runs
      ${whereClause}
      ORDER BY started_at DESC
      ${limitClause};`,
      params
    );

    if (!res.rows || res.rows.length === 0) {
      return [];
    }

    const runIds = res.rows.map((r) => r.id);

    // Batch query failure logs and diagnoses
    const logsRes = await this.query(
      `SELECT
        id,
        test_run_id,
        timestamp,
        source,
        severity,
        error_code,
        message,
        raw_payload
      FROM failure_logs
      WHERE test_run_id = ANY($1::text[])
      ORDER BY timestamp ASC;`,
      [runIds]
    );

    const diagRes = await this.query(
      `SELECT
        id,
        test_run_id,
        provider_used,
        root_cause_scope,
        confidence,
        summary,
        matched_runbook,
        recommended_actions,
        evidence_logs,
        tool_calls_executed,
        created_at
      FROM triage_diagnoses
      WHERE test_run_id = ANY($1::text[])
      ORDER BY created_at DESC;`,
      [runIds]
    );

    const logsByRunId = new Map<string, FailureLog[]>();
    for (const logRow of logsRes.rows) {
      const list = logsByRunId.get(logRow.test_run_id) ?? [];
      list.push(this.mapFailureLogRow(logRow));
      logsByRunId.set(logRow.test_run_id, list);
    }

    const diagByRunId = new Map<string, TriageDiagnosis>();
    for (const diagRow of diagRes.rows) {
      if (!diagByRunId.has(diagRow.test_run_id)) {
        diagByRunId.set(diagRow.test_run_id, this.mapTriageDiagnosisRow(diagRow));
      }
    }

    return res.rows.map((row) => ({
      id: row.id,
      lineId: row.line_id,
      stationId: row.station_id,
      dutSerial: row.dut_serial,
      dutModel: row.dut_model,
      firmwareVersion: row.firmware_version,
      status: row.status as TestRunStatus,
      latencyMs: Number(row.latency_ms),
      errorCode: row.error_code,
      stepFailed: row.step_failed,
      startedAt: new Date(row.started_at),
      completedAt: new Date(row.completed_at),
      failureLogs: logsByRunId.get(row.id) ?? [],
      triageDiagnosis: diagByRunId.get(row.id) ?? null,
    }));
  }

  /**
   * Search Runbooks using real pgvector cosine distance:
   * 1 - (embedding <=> $1::vector) AS similarity_score
   * ORDER BY embedding <=> $1::vector ASC
   * Falls back to text matching if embeddings are null or search yields no rows.
   */
  async searchRunbooksByVector(
    embedding: number[],
    limit = 3,
    errorCodeHint?: string
  ): Promise<RunbookSearchMatch[]> {
    if (Array.isArray(embedding) && embedding.length > 0) {
      try {
        const vectorStr = `[${embedding.join(',')}]`;
        const res = await this.query(
          `SELECT
            id,
            code,
            title,
            symptom_signature,
            root_cause_scope,
            technical_explanation,
            remediation_steps,
            embedding,
            (1 - (embedding <=> $1::vector)) AS similarity_score
          FROM runbooks
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> $1::vector ASC
          LIMIT $2;`,
          [vectorStr, limit]
        );

        if (res.rows && res.rows.length > 0) {
          return res.rows.map((row) => ({
            runbook: this.mapRunbookRow(row),
            similarityScore: Math.max(0, Math.min(1, Number(row.similarity_score ?? 0))),
          }));
        }
      } catch (err: any) {
        this.logger.warn(
          `pgvector cosine search failed (${err.message}). Falling back to text matching.`
        );
      }
    }

    // Gracefully handle null embeddings or empty vector matches by falling back to text matching
    return this.searchRunbooksByText(limit, errorCodeHint);
  }

  private async searchRunbooksByText(
    limit = 3,
    errorCodeHint?: string
  ): Promise<RunbookSearchMatch[]> {
    const hint = errorCodeHint ? errorCodeHint.trim() : '';

    if (hint) {
      const res = await this.query(
        `SELECT
          id,
          code,
          title,
          symptom_signature,
          root_cause_scope,
          technical_explanation,
          remediation_steps,
          embedding,
          CASE
            WHEN UPPER(code) = UPPER($1) THEN 0.95
            WHEN UPPER(code) LIKE '%' || UPPER($1) || '%' THEN 0.88
            WHEN symptom_signature ILIKE '%' || $1 || '%' THEN 0.82
            WHEN technical_explanation ILIKE '%' || $1 || '%' THEN 0.75
            WHEN title ILIKE '%' || $1 || '%' THEN 0.70
            ELSE 0.50
          END AS similarity_score
        FROM runbooks
        ORDER BY similarity_score DESC, id ASC
        LIMIT $2;`,
        [hint, limit]
      );

      return res.rows.map((row) => ({
        runbook: this.mapRunbookRow(row),
        similarityScore: Number(row.similarity_score ?? 0.5),
      }));
    }

    const res = await this.query(
      `SELECT
        id,
        code,
        title,
        symptom_signature,
        root_cause_scope,
        technical_explanation,
        remediation_steps,
        embedding
      FROM runbooks
      ORDER BY id ASC
      LIMIT $1;`,
      [limit]
    );

    return res.rows.map((row) => ({
      runbook: this.mapRunbookRow(row),
      similarityScore: 0.5,
    }));
  }

  async getAllRunbooks(): Promise<Runbook[]> {
    const res = await this.query(`
      SELECT
        id,
        code,
        title,
        symptom_signature,
        root_cause_scope,
        technical_explanation,
        remediation_steps,
        embedding
      FROM runbooks
      ORDER BY id ASC;
    `);

    return res.rows.map((row) => this.mapRunbookRow(row));
  }

  async upsertRunbookEmbedding(runbookId: string, embedding: number[]): Promise<void> {
    const vectorStr = `[${embedding.join(',')}]`;
    await this.query(
      `UPDATE runbooks
       SET embedding = $1::vector
       WHERE id = $2 OR code = $2;`,
      [vectorStr, runbookId]
    );
  }

  async saveTriageDiagnosis(
    diagnosis: Omit<TriageDiagnosis, 'id' | 'createdAt'>
  ): Promise<TriageDiagnosis> {
    const id = randomUUID();
    const createdAt = new Date();

    await this.query(
      `INSERT INTO triage_diagnoses (
        id,
        test_run_id,
        provider_used,
        root_cause_scope,
        confidence,
        summary,
        matched_runbook,
        recommended_actions,
        evidence_logs,
        tool_calls_executed,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11);`,
      [
        id,
        diagnosis.testRunId,
        diagnosis.providerUsed,
        diagnosis.rootCauseScope,
        diagnosis.confidence,
        diagnosis.summary,
        diagnosis.matchedRunbook ? JSON.stringify(diagnosis.matchedRunbook) : null,
        JSON.stringify(diagnosis.recommendedActions || []),
        JSON.stringify(diagnosis.evidenceLogs || []),
        JSON.stringify(diagnosis.toolCallsExecuted || []),
        createdAt,
      ]
    );

    return {
      id,
      ...diagnosis,
      createdAt,
    };
  }

  async getTriageDiagnosisByRunId(testRunId: string): Promise<TriageDiagnosis | null> {
    const res = await this.query(
      `SELECT
        id,
        test_run_id,
        provider_used,
        root_cause_scope,
        confidence,
        summary,
        matched_runbook,
        recommended_actions,
        evidence_logs,
        tool_calls_executed,
        created_at
      FROM triage_diagnoses
      WHERE test_run_id = $1
      ORDER BY created_at DESC
      LIMIT 1;`,
      [testRunId]
    );

    if (!res.rows || res.rows.length === 0) {
      return null;
    }

    return this.mapTriageDiagnosisRow(res.rows[0]);
  }

  // --- Row Mappers ---

  private mapTestLineRow(row: any): TestLine {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      healthStatus: row.health_status as LineHealthStatus,
      yieldPercentage: Number(row.yield_percentage),
      activeDutSerial: row.active_dut_serial,
      lastCycleLatencyMs: Number(row.last_cycle_latency_ms),
      consecutiveFailures: Number(row.consecutive_failures),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapTestStationRow(row: any): TestStation {
    return {
      id: row.id,
      lineId: row.line_id,
      name: row.name,
      code: row.code,
      sequenceOrder: Number(row.sequence_order),
      instrumentModel: row.instrument_model,
    };
  }

  private mapFailureLogRow(row: any): FailureLog {
    let rawPayload = row.raw_payload;
    if (typeof rawPayload === 'string') {
      try {
        rawPayload = JSON.parse(rawPayload);
      } catch {
        // preserve as string if parsing fails
      }
    }

    return {
      id: row.id,
      testRunId: row.test_run_id,
      timestamp: new Date(row.timestamp),
      source: row.source,
      severity: row.severity,
      errorCode: row.error_code,
      message: row.message,
      rawPayload: rawPayload ?? undefined,
    };
  }

  private mapRunbookRow(row: any): Runbook {
    let steps = row.remediation_steps;
    if (typeof steps === 'string') {
      try {
        steps = JSON.parse(steps);
      } catch {
        steps = [steps];
      }
    }

    return {
      id: row.id,
      code: row.code,
      title: row.title,
      symptomSignature: row.symptom_signature,
      rootCauseScope: row.root_cause_scope as RootCauseScope,
      technicalExplanation: row.technical_explanation,
      remediationSteps: Array.isArray(steps) ? steps : [],
      embedding: parseVector(row.embedding),
    };
  }

  private mapTriageDiagnosisRow(row: any): TriageDiagnosis {
    let matchedRunbook = row.matched_runbook;
    if (typeof matchedRunbook === 'string') {
      try {
        matchedRunbook = JSON.parse(matchedRunbook);
      } catch {
        matchedRunbook = null;
      }
    }

    let recommendedActions = row.recommended_actions;
    if (typeof recommendedActions === 'string') {
      try {
        recommendedActions = JSON.parse(recommendedActions);
      } catch {
        recommendedActions = [];
      }
    }

    let evidenceLogs = row.evidence_logs;
    if (typeof evidenceLogs === 'string') {
      try {
        evidenceLogs = JSON.parse(evidenceLogs);
      } catch {
        evidenceLogs = [];
      }
    }

    let toolCallsExecuted = row.tool_calls_executed;
    if (typeof toolCallsExecuted === 'string') {
      try {
        toolCallsExecuted = JSON.parse(toolCallsExecuted);
      } catch {
        toolCallsExecuted = [];
      }
    }

    return {
      id: row.id,
      testRunId: row.test_run_id,
      providerUsed: row.provider_used,
      rootCauseScope: row.root_cause_scope as RootCauseScope,
      confidence: Number(row.confidence),
      summary: row.summary,
      matchedRunbook: matchedRunbook ?? null,
      recommendedActions: Array.isArray(recommendedActions) ? recommendedActions : [],
      evidenceLogs: Array.isArray(evidenceLogs) ? evidenceLogs : [],
      toolCallsExecuted: Array.isArray(toolCallsExecuted) ? toolCallsExecuted : [],
      createdAt: new Date(row.created_at),
    };
  }
}
