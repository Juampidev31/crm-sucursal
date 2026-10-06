'use client';

import { useMemo, useState } from 'react';
import { CaseUpper, RefreshCw } from 'lucide-react';
import ModalPortal from '@/components/ModalPortal';
import { normalizePersonName } from '@/lib/normalize-person-name';
import {
  persistNormalizedNames,
  rowsNeedingNameNormalization,
  type NormalizableNameRow,
} from '@/lib/persist-normalized-names';

interface NameNormalizationActionProps<T extends NormalizableNameRow> {
  isAdmin: boolean;
  table: 'registros' | 'gestion_diaria';
  rows: T[];
  scopeLabel: string;
  onApplied: (changed: T[]) => void | Promise<void>;
}

export function NameNormalizationAction<T extends NormalizableNameRow>({
  isAdmin,
  table,
  rows,
  scopeLabel,
  onApplied,
}: NameNormalizationActionProps<T>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState('');
  const candidates = useMemo(() => rowsNeedingNameNormalization(rows), [rows]);
  const preview = candidates.slice(0, 4);

  if (!isAdmin) return null;

  const applyNormalization = async () => {
    setSaving(true);
    setError('');
    setProgress({ completed: 0, total: candidates.length });
    try {
      const result = await persistNormalizedNames(table, candidates, (completed, total) => {
        setProgress({ completed, total });
      });
      await onApplied(result.changed);

      if (result.failed > 0) {
        setError(`Se actualizaron ${result.changed.length} nombres y fallaron ${result.failed}. Podés reintentar los pendientes.`);
        return;
      }
      setOpen(false);
    } catch {
      setError('No se pudo completar la normalización. Revisá la conexión y volvé a intentar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="admin-name-normalizer"
        onClick={() => { setError(''); setOpen(true); }}
        disabled={candidates.length === 0}
        title={candidates.length === 0 ? 'Todos los nombres ya están normalizados' : 'Guardar nombres normalizados para todos los usuarios'}
      >
        <CaseUpper size={15} /> {candidates.length === 0 ? 'Nombres normalizados' : `Normalizar nombres (${candidates.length})`}
      </button>

      {open && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => { if (!saving) setOpen(false); }}>
            <div className="modal-content name-normalization-modal" onClick={event => event.stopPropagation()}>
              <div className="modal-header daily-modal__header">
                <div><h3>Normalizar nombres</h3><p>{scopeLabel}</p></div>
                <button type="button" className="btn-icon" onClick={() => setOpen(false)} disabled={saving} aria-label="Cerrar">×</button>
              </div>
              <div className="modal-body name-normalization-modal__body">
                <p>Se guardarán <strong>{candidates.length}</strong> cambios en la base. Las sesiones abiertas los recibirán automáticamente en tiempo real.</p>
                <div className="name-normalization-preview">
                  {preview.map(row => (
                    <div key={row.id}>
                      <span>{row.nombre}</span>
                      <strong>{normalizePersonName(row.nombre)}</strong>
                    </div>
                  ))}
                </div>
                {saving && (
                  <div className="name-normalization-progress" role="status">
                    <RefreshCw size={14} className="is-spinning" />
                    Actualizando {progress.completed} de {progress.total}…
                  </div>
                )}
                {error && <p className="daily-action-error" role="alert">{error}</p>}
              </div>
              <div className="modal-footer daily-modal__footer">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={applyNormalization} disabled={saving || candidates.length === 0}>
                  {saving ? 'Actualizando…' : 'Aplicar para todos'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
