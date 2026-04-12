import { describe, test, expect } from 'vitest';
import {
  adjustLogParam,
  setLogParam,
  adjustLogRep,
  setLogRep,
  adjustLogParamWithSync,
  setLogParamWithSync
} from '../../src/log-mutations.js';

// ── Helpers ──

function makeLog({ weight = 50, series = 3, expected = 10, actual = null } = {}) {
  return {
    exercise_id: 'press_banca',
    name: 'Press banca',
    weight,
    series,
    reps: { expected, actual: actual || new Array(series).fill(null) }
  };
}

// ── adjustLogParam ──

describe('adjustLogParam', () => {
  describe('weight', () => {
    test('incrementa peso', () => {
      const log = makeLog({ weight: 50 });
      adjustLogParam(log, 'weight', 2.5);
      expect(log.weight).toBe(52.5);
    });

    test('decrementa peso', () => {
      const log = makeLog({ weight: 50 });
      adjustLogParam(log, 'weight', -10);
      expect(log.weight).toBe(40);
    });

    test('no baja de 0', () => {
      const log = makeLog({ weight: 2 });
      adjustLogParam(log, 'weight', -5);
      expect(log.weight).toBe(0);
    });

    test('delta 0 no cambia nada', () => {
      const log = makeLog({ weight: 50 });
      adjustLogParam(log, 'weight', 0);
      expect(log.weight).toBe(50);
    });

    test('redondea a 1 decimal para evitar errores de punto flotante', () => {
      const log = makeLog({ weight: 0.1 });
      adjustLogParam(log, 'weight', 0.2);
      expect(log.weight).toBe(0.3);
    });
  });

  describe('series', () => {
    test('incrementa series y añade slot', () => {
      const log = makeLog({ series: 3 });
      adjustLogParam(log, 'series', 1);
      expect(log.series).toBe(4);
      expect(log.reps.actual).toHaveLength(4);
      expect(log.reps.actual[3]).toBeNull();
    });

    test('decrementa series y elimina slot', () => {
      const log = makeLog({ series: 3, actual: [10, 10, 10] });
      adjustLogParam(log, 'series', -1);
      expect(log.series).toBe(2);
      expect(log.reps.actual).toHaveLength(2);
    });

    test('no baja de 1', () => {
      const log = makeLog({ series: 1 });
      adjustLogParam(log, 'series', -5);
      expect(log.series).toBe(1);
      expect(log.reps.actual).toHaveLength(1);
    });

    test('delta 0 no cambia nada', () => {
      const log = makeLog({ series: 3 });
      adjustLogParam(log, 'series', 0);
      expect(log.series).toBe(3);
      expect(log.reps.actual).toHaveLength(3);
    });
  });

  describe('repsExpected', () => {
    test('incrementa reps objetivo', () => {
      const log = makeLog({ expected: 10 });
      adjustLogParam(log, 'repsExpected', 2);
      expect(log.reps.expected).toBe(12);
    });

    test('no baja de 1', () => {
      const log = makeLog({ expected: 1 });
      adjustLogParam(log, 'repsExpected', -5);
      expect(log.reps.expected).toBe(1);
    });
  });

  test('param inválido no hace nada', () => {
    const log = makeLog();
    const before = JSON.parse(JSON.stringify(log));
    adjustLogParam(log, 'noexiste', 5);
    expect(log.weight).toBe(before.weight);
    expect(log.series).toBe(before.series);
    expect(log.reps.expected).toBe(before.reps.expected);
  });
});

// ── setLogParam ──

describe('setLogParam', () => {
  describe('weight', () => {
    test('establece peso', () => {
      const log = makeLog();
      setLogParam(log, 'weight', '75.5');
      expect(log.weight).toBe(75.5);
    });

    test('no permite negativo', () => {
      const log = makeLog();
      setLogParam(log, 'weight', '-10');
      expect(log.weight).toBe(0);
    });

    test('valor no numérico → 0', () => {
      const log = makeLog();
      setLogParam(log, 'weight', 'abc');
      expect(log.weight).toBe(0);
    });
  });

  describe('series', () => {
    test('establece series y ajusta array de reps', () => {
      const log = makeLog({ series: 2, actual: [10, 10] });
      setLogParam(log, 'series', '4');
      expect(log.series).toBe(4);
      expect(log.reps.actual).toHaveLength(4);
      expect(log.reps.actual[2]).toBeNull();
      expect(log.reps.actual[3]).toBeNull();
    });

    test('reduce series y recorta array', () => {
      const log = makeLog({ series: 4, actual: [10, 10, 10, 10] });
      setLogParam(log, 'series', '2');
      expect(log.series).toBe(2);
      expect(log.reps.actual).toHaveLength(2);
    });

    test('no baja de 1', () => {
      const log = makeLog();
      setLogParam(log, 'series', '0');
      expect(log.series).toBe(1);
    });

    test('redondea decimales', () => {
      const log = makeLog();
      setLogParam(log, 'series', '2.7');
      expect(log.series).toBe(3);
    });
  });

  describe('repsExpected', () => {
    test('establece reps objetivo', () => {
      const log = makeLog();
      setLogParam(log, 'repsExpected', '15');
      expect(log.reps.expected).toBe(15);
    });

    test('no baja de 1', () => {
      const log = makeLog();
      setLogParam(log, 'repsExpected', '0');
      expect(log.reps.expected).toBe(1);
    });
  });

  test('param inválido no hace nada', () => {
    const log = makeLog({ weight: 50 });
    setLogParam(log, 'noexiste', '999');
    expect(log.weight).toBe(50);
  });
});

// ── adjustLogRep ──

describe('adjustLogRep', () => {
  test('ajusta rep existente', () => {
    const log = makeLog({ actual: [10, 8, 9] });
    adjustLogRep(log, 1, 2);
    expect(log.reps.actual[1]).toBe(10);
  });

  test('si rep es null, parte del expected', () => {
    const log = makeLog({ expected: 10 });
    adjustLogRep(log, 0, -2);
    expect(log.reps.actual[0]).toBe(8);
  });

  test('no baja de 0', () => {
    const log = makeLog({ actual: [1, 0, 5] });
    adjustLogRep(log, 1, -3);
    expect(log.reps.actual[1]).toBe(0);
  });

  test('delta 0 con null → expected', () => {
    const log = makeLog({ expected: 12 });
    adjustLogRep(log, 0, 0);
    expect(log.reps.actual[0]).toBe(12);
  });

  test('si reps.actual es array vacío, parte del expected', () => {
    const log = makeLog({ series: 3, expected: 10, actual: [] });
    adjustLogRep(log, 0, 1);
    expect(log.reps.actual[0]).toBe(11);
  });

  test('si reps.actual tiene menos elementos que series, parte del expected', () => {
    const log = makeLog({ series: 3, expected: 8, actual: [10] });
    adjustLogRep(log, 2, -1);
    expect(log.reps.actual[2]).toBe(7);
  });
});

// ── setLogRep ──

describe('setLogRep', () => {
  test('establece rep', () => {
    const log = makeLog();
    setLogRep(log, 0, '12');
    expect(log.reps.actual[0]).toBe(12);
  });

  test('valor no numérico → null', () => {
    const log = makeLog({ actual: [10, 10, 10] });
    setLogRep(log, 1, 'abc');
    expect(log.reps.actual[1]).toBeNull();
  });

  test('string vacío → null', () => {
    const log = makeLog({ actual: [10, 10, 10] });
    setLogRep(log, 0, '');
    expect(log.reps.actual[0]).toBeNull();
  });

  test('no permite negativo', () => {
    const log = makeLog();
    setLogRep(log, 0, '-5');
    expect(log.reps.actual[0]).toBe(0);
  });

  test('acepta 0', () => {
    const log = makeLog();
    setLogRep(log, 0, '0');
    expect(log.reps.actual[0]).toBe(0);
  });
});

// ── adjustLogParamWithSync ──

describe('adjustLogParamWithSync', () => {
  test('al cambiar repsExpected, sincroniza todas las reps actual al nuevo valor', () => {
    const log = makeLog({ expected: 11, actual: [11, 11, 9] });
    adjustLogParamWithSync(log, 'repsExpected', 1);
    expect(log.reps.expected).toBe(12);
    expect(log.reps.actual).toEqual([12, 12, 12]);
  });

  test('al decrementar repsExpected, sincroniza todas las reps actual', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 10] });
    adjustLogParamWithSync(log, 'repsExpected', -1);
    expect(log.reps.expected).toBe(9);
    expect(log.reps.actual).toEqual([9, 9, 9]);
  });

  test('repsExpected no baja de 1 y actual se sincroniza a 1', () => {
    const log = makeLog({ expected: 1, actual: [1, 1, 1] });
    adjustLogParamWithSync(log, 'repsExpected', -5);
    expect(log.reps.expected).toBe(1);
    expect(log.reps.actual).toEqual([1, 1, 1]);
  });

  test('con reps actual con nulls, se sincronizan a expected', () => {
    const log = makeLog({ expected: 10 }); // actual: [null, null, null]
    adjustLogParamWithSync(log, 'repsExpected', 2);
    expect(log.reps.expected).toBe(12);
    expect(log.reps.actual).toEqual([12, 12, 12]);
  });

  test('con 1 sola serie, sincroniza correctamente', () => {
    const log = makeLog({ series: 1, expected: 8, actual: [6] });
    adjustLogParamWithSync(log, 'repsExpected', 1);
    expect(log.reps.expected).toBe(9);
    expect(log.reps.actual).toEqual([9]);
  });

  test('cambiar weight NO sincroniza reps actual', () => {
    const log = makeLog({ weight: 50, actual: [10, 8, 9] });
    adjustLogParamWithSync(log, 'weight', 2.5);
    expect(log.weight).toBe(52.5);
    expect(log.reps.actual).toEqual([10, 8, 9]);
  });

  test('cambiar series NO sincroniza reps actual (solo añade/quita slot)', () => {
    const log = makeLog({ series: 3, actual: [10, 8, 9] });
    adjustLogParamWithSync(log, 'series', 1);
    expect(log.series).toBe(4);
    expect(log.reps.actual).toEqual([10, 8, 9, null]);
  });
});

// ── setLogParamWithSync ──

describe('setLogParamWithSync', () => {
  test('al setear repsExpected, sincroniza todas las reps actual', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 8] });
    setLogParamWithSync(log, 'repsExpected', '12');
    expect(log.reps.expected).toBe(12);
    expect(log.reps.actual).toEqual([12, 12, 12]);
  });

  test('setear repsExpected a 0 → clamp a 1, actual se sincroniza a 1', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    setLogParamWithSync(log, 'repsExpected', '0');
    expect(log.reps.expected).toBe(1);
    expect(log.reps.actual).toEqual([1, 1, 1]);
  });

  test('con reps actual con nulls, se sincronizan al nuevo expected', () => {
    const log = makeLog({ expected: 10 });
    setLogParamWithSync(log, 'repsExpected', '15');
    expect(log.reps.expected).toBe(15);
    expect(log.reps.actual).toEqual([15, 15, 15]);
  });

  test('setear weight NO sincroniza reps actual', () => {
    const log = makeLog({ weight: 50, actual: [10, 8, 9] });
    setLogParamWithSync(log, 'weight', '60');
    expect(log.weight).toBe(60);
    expect(log.reps.actual).toEqual([10, 8, 9]);
  });

  test('setear series NO sincroniza reps actual', () => {
    const log = makeLog({ series: 3, actual: [10, 8, 9] });
    setLogParamWithSync(log, 'series', '4');
    expect(log.series).toBe(4);
    expect(log.reps.actual).toEqual([10, 8, 9, null]);
  });
});
