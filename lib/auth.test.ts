import { describe, expect, it } from 'vitest';
import { can } from './auth';

describe('permissions par rôle', () => {
  it('applique l héritage OPS, PO, Release Manager et Admin', () => {
    expect(can('ops', 'execute_task')).toBe(true);
    expect(can('ops', 'launch_mep')).toBe(false);
    expect(can('po', 'launch_mep')).toBe(true);
    expect(can('po', 'create_mep')).toBe(false);
    expect(can('release_manager', 'create_mep')).toBe(true);
    expect(can('release_manager', 'manage_users')).toBe(false);
    expect(can('admin', 'manage_users')).toBe(true);
  });
});
