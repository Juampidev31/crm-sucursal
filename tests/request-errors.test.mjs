import test from 'node:test';
import assert from 'node:assert/strict';
import { getRequestErrorMessage, isTransientRequestAbort } from '../src/lib/request-errors.ts';

test('reconoce el AbortError de locks compartidos de Supabase', () => {
  const error = {
    message: "AbortError: Lock broken by another request with the 'steal' option.",
    details: "AbortError: Lock broken by another request with the 'steal' option.",
    hint: 'Request was aborted (timeout or manual cancellation)',
    code: '',
  };

  assert.equal(isTransientRequestAbort(error), true);
  assert.equal(getRequestErrorMessage(error), error.message);
});

test('reconoce abortos y fallos de red sin importar mayúsculas', () => {
  assert.equal(isTransientRequestAbort(new DOMException('Cancelled', 'AbortError')), true);
  assert.equal(isTransientRequestAbort({ message: 'NetworkError while fetching resource' }), true);
  assert.equal(isTransientRequestAbort({ message: 'Failed to fetch' }), true);
});

test('no oculta errores reales de datos', () => {
  assert.equal(isTransientRequestAbort({ message: 'permission denied', code: '42501' }), false);
  assert.equal(isTransientRequestAbort({ message: 'column does not exist', code: '42703' }), false);
});
