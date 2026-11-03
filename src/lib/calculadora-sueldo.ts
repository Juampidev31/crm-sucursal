export const DEFAULT_FIXED_SALARY = '1641799.18';
export const FIXED_SALARY_STORAGE_KEY = 'crm_calculadora_sueldo_fijo_v1';

type SalaryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadFixedSalary(storage: SalaryStorage | null): string {
  if (!storage) return DEFAULT_FIXED_SALARY;

  try {
    const saved = storage.getItem(FIXED_SALARY_STORAGE_KEY);
    if (saved === null) return DEFAULT_FIXED_SALARY;
    if (saved === '') return '';

    const value = Number(saved);
    return Number.isFinite(value) && value >= 0 ? saved : DEFAULT_FIXED_SALARY;
  } catch {
    return DEFAULT_FIXED_SALARY;
  }
}

export function saveFixedSalary(storage: SalaryStorage | null, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(FIXED_SALARY_STORAGE_KEY, value);
  } catch {
    // La calculadora sigue funcionando aunque el navegador bloquee el storage.
  }
}

export function resetFixedSalary(storage: SalaryStorage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(FIXED_SALARY_STORAGE_KEY);
  } catch {
    // La calculadora sigue funcionando aunque el navegador bloquee el storage.
  }
}
