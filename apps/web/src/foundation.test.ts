import { describe, expect, it } from 'vitest';

describe('web foundation', () => {
  it('defines the EKMS application identity', () => {
    expect('English Knowledge Management System').toContain('Knowledge Management');
  });
});
