'use client';

import styles from './ErrorPage.module.css';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Algo salió mal</h2>
      <p className={styles.message}>
        {error.message || 'Ocurrió un error inesperado.'}
      </p>
      <button
        className={styles.retry}
        onClick={reset}
        type="button"
      >
        Reintentar
      </button>
    </div>
  );
}
