import { Injectable, Inject, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import {
  AI_TRIAGE_PORT,
  IAiTriagePort,
  PULSELINE_REPOSITORY,
  IPulseLineRepository,
  TestRun,
  TriageDiagnosis,
  RootCauseScope,
  MatchedRunbookRef,
  RunbookSearchMatch,
} from '../domain/contracts';
import { computeDeterministicEmbedding } from './deterministic-embedding';
import { embed, generateText, generateObject, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider';
import { z } from 'zod';

/**
 * Zod schema for structured triage diagnosis output.
 */
export const TriageDiagnosisOutputSchema = z.object({
  rootCauseScope: z.enum(['DUT_HARDWARE', 'DUT_FIRMWARE', 'TEST_STATION_RIG']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  matchedRunbookCode: z.string().nullable(),
  recommendedActions: z.array(z.string()),
  evidenceLogs: z.array(z.string()),
});

export type TriageDiagnosisOutput = z.infer<typeof TriageDiagnosisOutputSchema>;

@Injectable()
export class AiTriageService implements IAiTriagePort, OnModuleInit {
  private readonly logger = new Logger(AiTriageService.name);

  constructor(
    @Inject(PULSELINE_REPOSITORY) private readonly repo: IPulseLineRepository
  ) {}

  /**
   * Current active AI provider based on AI_PROVIDER environment variable
   * and configured credentials. Defaults to 'mock' if no API key is set.
   */
  get providerName(): string {
    const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      return 'gemini';
    }
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return 'openai';
    }
    if (provider === 'ollama') {
      return 'ollama';
    }
    return 'mock';
  }

  /**
   * On startup, ensure all runbooks have 768-dimension embeddings computed and stored in pgvector.
   */
  async onModuleInit(): Promise<void> {
    try {
      const runbooks = await this.repo.getAllRunbooks();
      this.logger.log(`Inspecting ${runbooks.length} runbooks for embeddings...`);

      for (const runbook of runbooks) {
        if (!runbook.embedding || runbook.embedding.length !== 768) {
          const textToEmbed = `${runbook.code} ${runbook.title} ${runbook.symptomSignature} ${runbook.technicalExplanation}`;
          const vector = await this.embedText(textToEmbed);
          await this.repo.upsertRunbookEmbedding(runbook.id, vector);
          this.logger.log(`Indexed 768-dim embedding for runbook [${runbook.code}]`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Runbook embedding initialization deferred: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Computes a 768-dimension embedding vector for the given text using the configured provider.
   * If remote embedding fails or provider is 'mock', falls back to computeDeterministicEmbedding.
   */
  async embedText(text: string): Promise<number[]> {
    const provider = this.providerName;

    if (provider === 'gemini') {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        const google = createGoogleGenerativeAI({ apiKey });
        const modelName = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
        const embeddingModel =
          typeof (google as any).textEmbeddingModel === 'function'
            ? (google as any).textEmbeddingModel(modelName)
            : (google as any).embedding(modelName);

        const { embedding } = await embed({
          model: embeddingModel,
          value: text,
        });
        return embedding;
      } catch (error) {
        this.logger.warn(
          `Gemini embedding failed, falling back to deterministic embedding: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return computeDeterministicEmbedding(text);
      }
    }

    if (provider === 'openai') {
      try {
        const apiKey = process.env.OPENAI_API_KEY;
        const openai = createOpenAI({ apiKey });
        const modelName = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
        const embeddingModel = openai.embedding(modelName, { dimensions: 768 });

        const { embedding } = await embed({
          model: embeddingModel,
          value: text,
        });
        return embedding;
      } catch (error) {
        this.logger.warn(
          `OpenAI embedding failed, falling back to deterministic embedding: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return computeDeterministicEmbedding(text);
      }
    }

    if (provider === 'ollama') {
      try {
        const ollama = createOllama({
          baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
        });
        const modelName = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
        const embeddingModel =
          typeof (ollama as any).textEmbeddingModel === 'function'
            ? (ollama as any).textEmbeddingModel(modelName)
            : (ollama as any).embedding(modelName);

        const { embedding } = await embed({
          model: embeddingModel,
          value: text,
        });
        return embedding;
      } catch (error) {
        this.logger.warn(
          `Ollama embedding failed, falling back to deterministic embedding: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return computeDeterministicEmbedding(text);
      }
    }

    // Default 'mock' provider
    return computeDeterministicEmbedding(text);
  }

  /**
   * Diagnoses a failed TestRun by performing multi-tool incident triage against runbooks
   * and test station history, returning a persisted TriageDiagnosis.
   */
  async diagnoseTestRunFailure(testRunId: string): Promise<TriageDiagnosis> {
    // 1. Return cached diagnosis if already generated
    const existing = await this.repo.getTriageDiagnosisByRunId(testRunId);
    if (existing) {
      return existing;
    }

    // 2. Load the failed TestRun
    const testRun = await this.repo.getTestRunById(testRunId);
    if (!testRun) {
      throw new NotFoundException(`TestRun with ID "${testRunId}" not found`);
    }

    // Ensure runbooks have embeddings before vector search
    const allRunbooks = await this.repo.getAllRunbooks();
    for (const rb of allRunbooks) {
      if (!rb.embedding || rb.embedding.length !== 768) {
        const vec = await this.embedText(`${rb.code} ${rb.title} ${rb.symptomSignature} ${rb.technicalExplanation}`);
        await this.repo.upsertRunbookEmbedding(rb.id, vec);
      }
    }

    // 3. Setup tool tracking and shared state
    const toolCallsExecuted: string[] = [];
    let runbookMatches: RunbookSearchMatch[] = [];
    let recentRuns: TestRun[] = [];

    const searchRunbooksTool = tool({
      description:
        'Search runbooks by symptom description and optional error code using 768-dim vector similarity search',
      parameters: z.object({
        query: z
          .string()
          .describe('Symptom query or error message to embed and search against runbooks'),
        errorCode: z.string().optional().describe('Optional error code filter or hint'),
      }),
      execute: async ({ query, errorCode }) => {
        toolCallsExecuted.push('searchRunbooks');
        const vector = await this.embedText(query);
        const matches = await this.repo.searchRunbooksByVector(vector, 3, errorCode);
        runbookMatches = matches;
        return matches.map((m) => ({
          code: m.runbook.code,
          title: m.runbook.title,
          similarityScore: Number(m.similarityScore.toFixed(4)),
          rootCauseScope: m.runbook.rootCauseScope,
          technicalExplanation: m.runbook.technicalExplanation,
          remediationSteps: m.runbook.remediationSteps,
        }));
      },
    });

    const getStationRecentRunsTool = tool({
      description:
        'Retrieve recent test runs for this test station to evaluate station failure patterns and repeatability',
      parameters: z.object({
        stationId: z.string().describe('Test station ID to query recent runs for'),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe('Maximum number of recent runs to fetch'),
      }),
      execute: async ({ stationId, limit }) => {
        toolCallsExecuted.push('getStationRecentRuns');
        const runs = await this.repo.getRecentTestRuns({
          stationId: stationId || testRun.stationId,
          limit: limit || 5,
        });
        recentRuns = runs;
        return runs.map((r) => ({
          id: r.id,
          dutSerial: r.dutSerial,
          status: r.status,
          errorCode: r.errorCode,
          stepFailed: r.stepFailed,
          latencyMs: r.latencyMs,
          completedAt: r.completedAt,
        }));
      },
    });

    // 4. If remote LLM provider is active, run agentic loop via Vercel AI SDK
    if (this.providerName !== 'mock') {
      try {
        const model = this.getModel();
        const symptomQuery = this.buildSymptomQuery(testRun);

        const triagePrompt = `You are the PulseLine AI Incident Triage Engine.
Diagnose the failure on the following TestRun:
- TestRun ID: ${testRun.id}
- Test Station ID: ${testRun.stationId}
- DUT Serial: ${testRun.dutSerial}
- DUT Model: ${testRun.dutModel}
- Firmware Version: ${testRun.firmwareVersion}
- Error Code: ${testRun.errorCode || 'N/A'}
- Step Failed: ${testRun.stepFailed || 'N/A'}
- Failure Logs:
${
  (testRun.failureLogs || [])
    .map((l) => `  [${l.source} ${l.severity}] ${l.errorCode}: ${l.message}`)
    .join('\n') || '  (No logs recorded)'
}

Perform two required tool calls:
1. 'searchRunbooks' with query: "${symptomQuery}" and errorCode: "${testRun.errorCode || ''}"
2. 'getStationRecentRuns' with stationId: "${testRun.stationId}"

Correlate whether consecutive failures occurred on this station across distinct DUTs (which indicates TEST_STATION_RIG) versus an isolated failure on this specific DUT (DUT_HARDWARE or DUT_FIRMWARE).`;

        const toolStepResult = await generateText({
          model,
          system:
            'You are an expert hardware manufacturing and test engineer for PulseLine. Always call both searchRunbooks and getStationRecentRuns to ground your diagnosis in historical data and indexed runbooks.',
          prompt: triagePrompt,
          tools: {
            searchRunbooks: searchRunbooksTool,
            getStationRecentRuns: getStationRecentRunsTool,
          },
          maxSteps: 4,
        });

        // Generate structured output conforming to TriageDiagnosisOutputSchema
        const structured = await generateObject({
          model,
          schema: TriageDiagnosisOutputSchema,
          prompt: `Based on the following triage investigation and tool executions, produce the final structured diagnosis:
${toolStepResult.text}

Tool Runbook Matches:
${JSON.stringify(runbookMatches.map((m) => ({ code: m.runbook.code, title: m.runbook.title, score: m.similarityScore, scope: m.runbook.rootCauseScope })), null, 2)}

Recent Station Runs:
${JSON.stringify(recentRuns.map((r) => ({ id: r.id, dut: r.dutSerial, status: r.status, errorCode: r.errorCode })), null, 2)}

Ensure rootCauseScope is strictly one of 'DUT_HARDWARE', 'DUT_FIRMWARE', or 'TEST_STATION_RIG'.`,
        });

        const output = structured.object;
        const matchedMatch = output.matchedRunbookCode
          ? runbookMatches.find((m) => m.runbook.code === output.matchedRunbookCode) ||
            runbookMatches[0]
          : runbookMatches[0] || null;

        const matchedRunbook: MatchedRunbookRef | null = matchedMatch
          ? {
              runbookId: matchedMatch.runbook.id,
              code: matchedMatch.runbook.code,
              title: matchedMatch.runbook.title,
              similarityScore: Number(matchedMatch.similarityScore.toFixed(4)),
            }
          : null;

        const diagnosisToSave: Omit<TriageDiagnosis, 'id' | 'createdAt'> = {
          testRunId: testRun.id,
          providerUsed: this.providerName,
          rootCauseScope: output.rootCauseScope,
          confidence: Number(output.confidence.toFixed(2)),
          summary: output.summary,
          matchedRunbook,
          recommendedActions:
            output.recommendedActions.length > 0
              ? output.recommendedActions
              : matchedMatch?.runbook.remediationSteps || [
                  'Inspect DUT and station instrumentation',
                ],
          evidenceLogs:
            output.evidenceLogs.length > 0
              ? output.evidenceLogs
              : this.extractEvidenceLogs(testRun),
          toolCallsExecuted: Array.from(new Set(toolCallsExecuted)),
        };

        return await this.repo.saveTriageDiagnosis(diagnosisToSave);
      } catch (llmError) {
        this.logger.warn(
          `Remote LLM triage failed, engaging deterministic agentic workflow: ${
            llmError instanceof Error ? llmError.message : String(llmError)
          }`
        );
      }
    }

    // 5. Deterministic Agentic Workflow (Always executes both real tools)
    if (!toolCallsExecuted.includes('searchRunbooks')) {
      const query = this.buildSymptomQuery(testRun);
      await searchRunbooksTool.execute!(
        {
          query,
          errorCode: testRun.errorCode || undefined,
        },
        { toolCallId: 'det-search-runbooks', messages: [] }
      );
    }

    if (!toolCallsExecuted.includes('getStationRecentRuns')) {
      await getStationRecentRunsTool.execute!(
        {
          stationId: testRun.stationId,
          limit: 5,
        },
        { toolCallId: 'det-recent-runs', messages: [] }
      );
    }

    // Analyze station failure repeatability vs isolated DUT defect
    const previousRunsOnStation = recentRuns.filter((r) => r.id !== testRun.id);
    const stationFailures = previousRunsOnStation.filter((r) => r.status === 'FAILED');
    const multipleDistinctDutsFailed = stationFailures.some(
      (r) => r.dutSerial !== testRun.dutSerial
    );
    const consecutiveStationFailures =
      previousRunsOnStation.length > 0 &&
      previousRunsOnStation.slice(0, 2).every((r) => r.status === 'FAILED');

    const topMatch = runbookMatches.length > 0 ? runbookMatches[0] : null;

    let rootCauseScope: RootCauseScope = 'DUT_HARDWARE';
    let confidence = 0.80;

    // Check station rig indicators
    const isStationHardwareSignature =
      testRun.errorCode === 'USB_ADB_ENUMERATION_TIMEOUT' ||
      testRun.errorCode === 'THERMAL_CHAMBER_SENSOR_DRIFT' ||
      (topMatch && topMatch.runbook.rootCauseScope === 'TEST_STATION_RIG');

    if (isStationHardwareSignature || (consecutiveStationFailures && multipleDistinctDutsFailed)) {
      rootCauseScope = 'TEST_STATION_RIG';
      confidence = consecutiveStationFailures ? 0.95 : 0.88;
    } else if (
      testRun.errorCode === 'BASEBAND_MODEM_KERNEL_PANIC' ||
      (topMatch && topMatch.runbook.rootCauseScope === 'DUT_FIRMWARE')
    ) {
      rootCauseScope = 'DUT_FIRMWARE';
      confidence = topMatch ? Math.max(0.85, topMatch.similarityScore) : 0.82;
    } else if (
      testRun.errorCode === 'RF_PA_GAIN_OUT_OF_BOUNDS' ||
      (topMatch && topMatch.runbook.rootCauseScope === 'DUT_HARDWARE')
    ) {
      rootCauseScope = 'DUT_HARDWARE';
      confidence = topMatch ? Math.max(0.88, topMatch.similarityScore) : 0.84;
    } else if (topMatch) {
      rootCauseScope = topMatch.runbook.rootCauseScope;
      confidence = Math.min(0.95, Math.max(0.70, topMatch.similarityScore));
    }

    // Synthesize structured summary
    const stationContext =
      consecutiveStationFailures && multipleDistinctDutsFailed
        ? `Station ${testRun.stationId} exhibits consecutive failures across multiple distinct DUTs, strongly attributing root cause to station instrumentation or fixture degradation.`
        : `Failure is isolated to DUT ${testRun.dutSerial}; preceding runs on station ${testRun.stationId} succeeded normally.`;

    const runbookContext = topMatch
      ? `Correlated with runbook [${topMatch.runbook.code}] "${topMatch.runbook.title}" (similarity: ${(topMatch.similarityScore * 100).toFixed(1)}%). ${topMatch.runbook.technicalExplanation}`
      : `No direct runbook match found; categorized as ${rootCauseScope} based on error signature [${testRun.errorCode || 'UNKNOWN'}].`;

    const summary = `${rootCauseScope} diagnosed for TestRun ${testRun.id}. ${stationContext} ${runbookContext}`;

    const matchedRunbook: MatchedRunbookRef | null = topMatch
      ? {
          runbookId: topMatch.runbook.id,
          code: topMatch.runbook.code,
          title: topMatch.runbook.title,
          similarityScore: Number(topMatch.similarityScore.toFixed(4)),
        }
      : null;

    const recommendedActions =
      topMatch && topMatch.runbook.remediationSteps.length > 0
        ? [...topMatch.runbook.remediationSteps]
        : this.getDefaultRemediation(rootCauseScope);

    const evidenceLogs = this.extractEvidenceLogs(testRun);

    const diagnosisToSave: Omit<TriageDiagnosis, 'id' | 'createdAt'> = {
      testRunId: testRun.id,
      providerUsed: this.providerName === 'mock' ? 'deterministic-mock' : this.providerName,
      rootCauseScope,
      confidence: Number(confidence.toFixed(2)),
      summary,
      matchedRunbook,
      recommendedActions,
      evidenceLogs,
      toolCallsExecuted: Array.from(new Set(toolCallsExecuted)),
    };

    return await this.repo.saveTriageDiagnosis(diagnosisToSave);
  }

  private buildSymptomQuery(testRun: TestRun): string {
    const parts: string[] = [];
    if (testRun.errorCode) parts.push(testRun.errorCode);
    if (testRun.stepFailed) parts.push(`Step failed: ${testRun.stepFailed}`);
    if (testRun.failureLogs && testRun.failureLogs.length > 0) {
      for (const log of testRun.failureLogs) {
        parts.push(`${log.errorCode}: ${log.message}`);
      }
    }
    if (parts.length === 0) {
      parts.push(
        `Validation failure on station ${testRun.stationId} for DUT ${testRun.dutSerial}`
      );
    }
    return parts.join(' ');
  }

  private extractEvidenceLogs(testRun: TestRun): string[] {
    if (testRun.failureLogs && testRun.failureLogs.length > 0) {
      return testRun.failureLogs.map(
        (log) => `[${log.source} ${log.severity}] ${log.errorCode}: ${log.message}`
      );
    }
    const fallback: string[] = [];
    if (testRun.errorCode) fallback.push(`Error code: ${testRun.errorCode}`);
    if (testRun.stepFailed) fallback.push(`Failed step: ${testRun.stepFailed}`);
    return fallback.length > 0
      ? fallback
      : ['No failure logs recorded for this test run.'];
  }

  private getDefaultRemediation(scope: RootCauseScope): string[] {
    switch (scope) {
      case 'TEST_STATION_RIG':
        return [
          'Inspect station USB cabling, pogo pin fixtures, and hub connections.',
          'Verify sensor calibration and thermal chamber setpoints.',
          'Run station loopback self-test diagnostics.',
        ];
      case 'DUT_FIRMWARE':
        return [
          'Reflash DUT with baseline known-good firmware build.',
          'Capture modem kernel crash logs and verify NVRAM partition.',
          'Quarantine build artifact if panic reproduces across units.',
        ];
      case 'DUT_HARDWARE':
      default:
        return [
          'Inspect board for solder bridges and cold joints around PA module.',
          'Verify power rail voltages and RF path continuity.',
          'Route DUT to rework station for x-ray inspection.',
        ];
    }
  }

  private getModel() {
    const provider = this.providerName;
    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      const google = createGoogleGenerativeAI({ apiKey });
      return google(process.env.GEMINI_MODEL || 'gemini-2.5-flash');
    }
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      const openai = createOpenAI({ apiKey });
      return openai(process.env.OPENAI_MODEL || 'gpt-4o-mini');
    }
    if (provider === 'ollama') {
      const ollama = createOllama({
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
      });
      return ollama(process.env.OLLAMA_MODEL || 'llama3.1');
    }
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
