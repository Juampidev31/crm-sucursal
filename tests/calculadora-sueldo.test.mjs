import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FIXED_SALARY,
  FIXED_SALARY_STORAGE_KEY,
  loadFixedSalary,
  resetFixedSalary,
  saveFixedSalary,
} from '../src/lib/calculadora-sueldo.ts';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('usa el sueldo predeterminado cuando todavía no hay uno guardado', () => {
  assert.equal(loadFixedSalary(memoryStorage()), DEFAULT_FIXED_SALARY);
});

test('guarda y recupera el sueldo fijo personalizado', () => {
  const storage = memoryStorage();
  saveFixedSalary(storage, '1750000.50');
  assert.equal(loadFixedSalary(storage), '1750000.50');
});

test('reiniciar elimina el valor personalizado', () => {
  const storage = memoryStorage({ [FIXED_SALARY_STORAGE_KEY]: '2000000' });
  resetFixedSalary(storage);
  assert.equal(loadFixedSalary(storage), DEFAULT_FIXED_SALARY);
});

test('descarta valores persistidos inválidos', () => {
  const storage = memoryStorage({ [FIXED_SALARY_STORAGE_KEY]: 'no-es-un-numero' });
  assert.equal(loadFixedSalary(storage), DEFAULT_FIXED_SALARY);
});
