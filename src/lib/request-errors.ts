type RequestErrorShape = {
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
};

export function getRequestErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

export function isTransientRequestAbort(error: unknown) {
  const candidate = error && typeof error === 'object' ? error as RequestErrorShape : null;
  const description = [
    candidate?.name,
    candidate?.message,
    candidate?.details,
    candidate?.hint,
    String(error ?? ''),
  ].filter(Boolean).join(' ').toLowerCase();

  return description.includes('abort')
    || description.includes('lock broken')
    || description.includes("'steal' option")
    || description.includes('failed to fetch')
    || description.includes('networkerror');
}
