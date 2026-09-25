import { LoggerService } from '@nestjs/common';

const sensitiveKey = /(authorization|cookie|password|token|secret|api[_-]?key|pepper)/i;

export class JsonLogger implements LoggerService {
  private readonly secrets: string[];

  constructor(secretValues: Array<string | undefined> = []) {
    this.secrets = secretValues.filter((value): value is string => Boolean(value));
  }

  log(message: unknown, context?: string): void { console.log(this.serialize('info', message, context)); }
  error(message: unknown, trace?: string, context?: string): void { console.error(this.serialize('error', message, context, trace)); }
  warn(message: unknown, context?: string): void { console.warn(this.serialize('warn', message, context)); }
  debug(message: unknown, context?: string): void { console.debug(this.serialize('debug', message, context)); }
  verbose(message: unknown, context?: string): void { console.debug(this.serialize('verbose', message, context)); }

  private serialize(level: string, message: unknown, context?: string, trace?: string): string {
    const seen = new WeakSet<object>();
    return JSON.stringify({ level, message, context, trace }, (key, value: unknown) => {
      if (sensitiveKey.test(key)) return '[REDACTED]';
      if (typeof value === 'string') {
        return this.secrets.reduce((redacted, secret) => redacted.replaceAll(secret, '[REDACTED]'), value);
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
  }
}
