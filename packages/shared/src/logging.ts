export interface Logger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

let _logger: Logger | undefined;

export function setLogger(logger: Logger): void {
  if (_logger !== undefined) {
    throw new Error('setLogger called more than once');
  }
  _logger = logger;
}

export function getLogger(): Logger {
  if (_logger === undefined) {
    throw new Error('getLogger called before setLogger');
  }
  return _logger;
}
