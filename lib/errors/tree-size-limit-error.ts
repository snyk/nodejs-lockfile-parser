export class TreeSizeLimitError extends Error {
  public code = 422;
  public name = 'TreeSizeLimitError';
  public currentTreeSize;

  constructor() {
    super('Tree size exceeds the allowed limit.');
    Error.captureStackTrace(this, TreeSizeLimitError);
  }
}
