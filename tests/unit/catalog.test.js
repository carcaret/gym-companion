import { describe, test, expect } from 'vitest';
import { GRUPOS, buildCatalogGroups, updateExercise } from '../../src/catalog.js';
import { computeGroupSets, resolveSecundarios, SIN_GRUPO } from '../../src/stats.js';

function db(exercises, extra = {}) {
  return { exercises, routines: { DIA1: [], DIA2: [], DIA3: [] }, history: [], ...extra };
}

describe('resolveSecundarios', () => {
  test('un ejercicio sin el campo hereda los del mapa hardcodeado', () => {
    const ex = { id: 'jalon_al_pecho', name: 'Jalón', grupo: 'espalda' };
    expect(resolveSecundarios(ex, 'jalon_al_pecho')).toEqual(['biceps']);
  });

  test('una lista vacía guardada gana al mapa — es una decisión del usuario', () => {
    const ex = { id: 'jalon_al_pecho', name: 'Jalón', grupo: 'espalda', secundarios: [] };
    expect(resolveSecundarios(ex, 'jalon_al_pecho')).toEqual([]);
  });

  test('lo editado a mano manda', () => {
    const ex = { id: 'jalon_al_pecho', name: 'Jalón', grupo: 'espalda', secundarios: ['hombros'] };
    expect(resolveSecundarios(ex, 'jalon_al_pecho')).toEqual(['hombros']);
  });

  test('un ejercicio fuera del mapa y sin campo no aporta a nada', () => {
    expect(resolveSecundarios({ id: 'sentadilla' }, 'sentadilla')).toEqual([]);
  });
});

describe('buildCatalogGroups', () => {
  const d = db({
    press: { id: 'press', name: 'Press banca', grupo: 'pecho', secundarios: ['triceps'] },
    aperturas: { id: 'aperturas', name: 'Aperturas', grupo: 'pecho', secundarios: [] },
    remo: { id: 'remo', name: 'Remo', grupo: 'espalda', secundarios: [] },
    huerfano: { id: 'huerfano', name: 'Ejercicio raro', secundarios: [] },
  });

  test('agrupa por grupo primario y ordena por nombre', () => {
    const grupos = buildCatalogGroups(d);
    const pecho = grupos.find(g => g.grupo === 'pecho');
    expect(pecho.exercises.map(e => e.id)).toEqual(['aperturas', 'press']);
  });

  test('los grupos siguen el orden canónico y sin grupo va al final', () => {
    const grupos = buildCatalogGroups(d);
    expect(grupos.map(g => g.grupo)).toEqual(['pecho', 'espalda', SIN_GRUPO]);
  });

  test('incluye ejercicios nunca entrenados — no mira el historial', () => {
    const grupos = buildCatalogGroups(d);
    const total = grupos.reduce((n, g) => n + g.exercises.length, 0);
    expect(total).toBe(4);
  });

  test('filtra por texto ignorando tildes y mayúsculas', () => {
    const conTilde = db({ jalon: { id: 'jalon', name: 'Jalón al pecho', grupo: 'espalda', secundarios: [] } });
    const grupos = buildCatalogGroups(conTilde, { query: 'JALON' });
    expect(grupos[0].exercises.map(e => e.id)).toEqual(['jalon']);
  });

  test('una búsqueda sin resultados devuelve cero grupos', () => {
    expect(buildCatalogGroups(d, { query: 'zzz' })).toEqual([]);
  });

  test('el catálogo muestra los secundarios heredados del mapa aunque no estén en la DB', () => {
    const sinCampo = db({ jalon_al_pecho: { id: 'jalon_al_pecho', name: 'Jalón', grupo: 'espalda' } });
    const fila = buildCatalogGroups(sinCampo)[0].exercises[0];
    expect(fila.secundarios).toEqual(['biceps']);
  });

  test('cada fila lleva su grupo y secundarios', () => {
    const pecho = buildCatalogGroups(d).find(g => g.grupo === 'pecho');
    expect(pecho.exercises.find(e => e.id === 'press')).toEqual({
      id: 'press', name: 'Press banca', grupo: 'pecho', secundarios: ['triceps'],
    });
  });
});

describe('updateExercise', () => {
  const nuevo = () => db({ press: { id: 'press', name: 'Press banca', grupo: 'pecho', secundarios: [] } });

  test('renombra y asigna grupo y secundarios', () => {
    const d = nuevo();
    const res = updateExercise(d, 'press', { name: 'Press banca plano', grupo: 'pecho', secundarios: ['triceps', 'hombros'] });
    expect(res.ok).toBe(true);
    expect(d.exercises.press).toEqual({
      id: 'press', name: 'Press banca plano', grupo: 'pecho', secundarios: ['triceps', 'hombros'],
    });
  });

  test('el id nunca cambia al renombrar — el historial no se rompe', () => {
    const d = nuevo();
    updateExercise(d, 'press', { name: 'Otro nombre', grupo: 'pecho', secundarios: [] });
    expect(Object.keys(d.exercises)).toEqual(['press']);
    expect(d.exercises.press.id).toBe('press');
  });

  test('rechaza nombre vacío', () => {
    const d = nuevo();
    const res = updateExercise(d, 'press', { name: '   ', grupo: 'pecho', secundarios: [] });
    expect(res.ok).toBe(false);
    expect(d.exercises.press.name).toBe('Press banca');
  });

  test('recorta espacios del nombre', () => {
    const d = nuevo();
    updateExercise(d, 'press', { name: '  Press inclinado  ', grupo: 'pecho', secundarios: [] });
    expect(d.exercises.press.name).toBe('Press inclinado');
  });

  test('sin grupo se guarda como ausencia de grupo', () => {
    const d = nuevo();
    updateExercise(d, 'press', { name: 'Press banca', grupo: '', secundarios: [] });
    expect(d.exercises.press.grupo).toBeUndefined();
  });

  test('descarta secundarios inválidos y el que repite al primario', () => {
    const d = nuevo();
    updateExercise(d, 'press', { name: 'Press banca', grupo: 'pecho', secundarios: ['pecho', 'triceps', 'inventado', 'triceps'] });
    expect(d.exercises.press.secundarios).toEqual(['triceps']);
  });

  test('rechaza grupo inválido', () => {
    const d = nuevo();
    const res = updateExercise(d, 'press', { name: 'Press banca', grupo: 'inventado', secundarios: [] });
    expect(res.ok).toBe(false);
    expect(d.exercises.press.grupo).toBe('pecho');
  });

  test('rechaza un id que no existe', () => {
    const d = nuevo();
    expect(updateExercise(d, 'noexiste', { name: 'X', grupo: 'pecho', secundarios: [] }).ok).toBe(false);
  });

  test('no toca el historial, las rutinas ni los demás ejercicios', () => {
    const d = {
      exercises: {
        press: { id: 'press', name: 'Press banca', grupo: 'pecho', secundarios: [] },
        remo: { id: 'remo', name: 'Remo', grupo: 'espalda', secundarios: ['biceps'] },
      },
      routines: { DIA1: ['press', 'remo'], DIA2: [], DIA3: [] },
      history: [{
        date: '2026-08-20', type: 'DIA1', completed: true,
        logs: [{ exercise_id: 'press', name: 'Press banca', weight: 60, series: 3, reps: { expected: 10, actual: [10, 10, 9] } }],
      }],
    };
    const historyAntes = JSON.stringify(d.history);
    const routinesAntes = JSON.stringify(d.routines);
    const remoAntes = JSON.stringify(d.exercises.remo);

    updateExercise(d, 'press', { name: 'Press banca plano', grupo: 'hombros', secundarios: ['triceps'] });

    expect(JSON.stringify(d.history)).toBe(historyAntes);
    expect(JSON.stringify(d.routines)).toBe(routinesAntes);
    expect(JSON.stringify(d.exercises.remo)).toBe(remoAntes);
    // Y del ejercicio editado, solo esos tres campos.
    expect(Object.keys(d.exercises.press).sort()).toEqual(['grupo', 'id', 'name', 'secundarios']);
  });

  test('GRUPOS cubre los siete grupos musculares en uso', () => {
    expect([...GRUPOS].sort()).toEqual(['biceps', 'core', 'espalda', 'hombros', 'pecho', 'piernas', 'triceps']);
  });
});

describe('los secundarios editados alimentan Progreso', () => {
  test('computeGroupSets usa los secundarios de la DB por encima del mapa', () => {
    const d = db(
      { sentadilla: { id: 'sentadilla', name: 'Sentadilla', grupo: 'piernas', secundarios: ['core'] } },
      {
        history: [{
          date: '2026-08-20', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'sentadilla', name: 'Sentadilla', weight: 100, series: 4, reps: { expected: 8, actual: [8] } }],
        }],
      }
    );
    const grupos = computeGroupSets(d, { anchorDate: '2026-08-25', weeks: 8 });
    const core = grupos.find(g => g.grupo === 'core');
    expect(core.indirectSets).toBe(2); // 4 series × 0,5
    expect(core.indirect).toEqual([{ name: 'Sentadilla', sets: 2 }]);
  });

  test('secundarios vacíos en la DB anulan el mapa hardcodeado', () => {
    const d = db(
      { jalon_al_pecho: { id: 'jalon_al_pecho', name: 'Jalón', grupo: 'espalda', secundarios: [] } },
      {
        history: [{
          date: '2026-08-20', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'jalon_al_pecho', name: 'Jalón', weight: 60, series: 4, reps: { expected: 10, actual: [10] } }],
        }],
      }
    );
    const grupos = computeGroupSets(d, { anchorDate: '2026-08-25', weeks: 8 });
    expect(grupos.find(g => g.grupo === 'biceps')).toBeUndefined();
  });
});
