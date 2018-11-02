export function setImmediatePromise() {
  return new Promise((resolve) => setImmediate(resolve));
}
