export class UnsupportedRuntimeError extends Error {
  public name = 'UnsupportedRuntimeError';
  public code = 500;

  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, UnsupportedRuntimeError);
  }
}
