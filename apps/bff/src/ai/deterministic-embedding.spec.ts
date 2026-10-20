import { describe, it, expect } from 'vitest';
import {
  computeDeterministicEmbedding,
  EMBEDDING_DIMENSION,
} from './deterministic-embedding';

describe('computeDeterministicEmbedding', () => {
  it('returns a 768-dimension vector with unit L2 norm', () => {
    const text = 'RF_PA_GAIN_OUT_OF_BOUNDS RF PA Gain Calibration Out of Bounds';
    const vec = computeDeterministicEmbedding(text);

    expect(vec).toHaveLength(EMBEDDING_DIMENSION);
    expect(vec).toHaveLength(768);

    const normSq = vec.reduce((sum, v) => sum + v * v, 0);
    expect(normSq).toBeCloseTo(1.0, 4);
  });

  it('yields high cosine similarity (0.75 - 0.96) for texts sharing failure domain vocabulary', () => {
    const runbookText =
      'RF_PA_GAIN_OUT_OF_BOUNDS RF Power Amplifier gain calibration out of bounds solder defect attenuation dbm';
    const failureLogText =
      'RF_PA_GAIN_OUT_OF_BOUNDS: RF PA Gain Calibration Out of Bounds. Output power measured -12 dBm vs +15 dBm expected. Possible solder bridge on RF PA module.';

    const vecA = computeDeterministicEmbedding(runbookText);
    const vecB = computeDeterministicEmbedding(failureLogText);

    // Cosine similarity for unit vectors is dot product
    const dotProduct = vecA.reduce((sum, v, i) => sum + v * vecB[i], 0);

    expect(dotProduct).toBeGreaterThanOrEqual(0.75);
    expect(dotProduct).toBeLessThanOrEqual(0.98);
  });

  it('yields low cosine similarity for different failure domains', () => {
    const rfText = 'RF_PA_GAIN_OUT_OF_BOUNDS RF PA gain calibration dbm solder power';
    const thermalText = 'THERMAL_CHAMBER_SENSOR_DRIFT Thermal chamber PT100 sensor temperature drift PID';

    const vecRF = computeDeterministicEmbedding(rfText);
    const vecThermal = computeDeterministicEmbedding(thermalText);

    const dotProduct = vecRF.reduce((sum, v, i) => sum + v * vecThermal[i], 0);
    expect(dotProduct).toBeLessThan(0.35);
  });

  it('handles empty strings gracefully by returning normalized fallback unit vector', () => {
    const vec = computeDeterministicEmbedding('');
    expect(vec).toHaveLength(768);

    const normSq = vec.reduce((sum, v) => sum + v * v, 0);
    expect(normSq).toBeCloseTo(1.0, 4);
  });
});
