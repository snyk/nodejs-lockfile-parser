export class UnsupportedError extends Error {
  public name = 'UnsupportedError';
  public code = 500;

  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, UnsupportedError);
  }
}
