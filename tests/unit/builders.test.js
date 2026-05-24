import { describe, it, expect } from 'vitest';
import { buildChipValues } from '../../src/builders.js';

describe('buildChipValues', () => {
  it('centra ventana de 5 alrededor del valor', () => {
    expect(buildChipValues(8)).toEqual([6, 7, 8, 9, 10]);
  });
  it('current=1 → borde inferior clampado a 0, desliza hacia arriba', () => {
    expect(buildChipValues(1)).toEqual([0, 1, 2, 3, 4]);
  });
  it('current=0 → ventana desde 0', () => {
    expect(buildChipValues(0)).toEqual([0, 1, 2, 3, 4]);
  });
  it('current=2 → borde a 0, no negativos', () => {
    expect(buildChipValues(2)).toEqual([0, 1, 2, 3, 4]);
  });
  it('current alto → ventana centrada sin clamp', () => {
    expect(buildChipValues(20)).toEqual([18, 19, 20, 21, 22]);
  });
});
