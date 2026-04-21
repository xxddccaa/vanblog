import {
  getResourceManagementModeLabel,
  normalizeResourceManagementMode,
  shouldTriggerSilentLegacyMigration,
} from './shared';

describe('AIQA shared helpers', () => {
  it('normalizes resource management mode labels for legacy and managed configs', () => {
    expect(normalizeResourceManagementMode(undefined)).toBe('manual');
    expect(normalizeResourceManagementMode('manual')).toBe('manual');
    expect(normalizeResourceManagementMode('managedV2')).toBe('managedV2');
    expect(getResourceManagementModeLabel('manual')).toContain('manual');
    expect(getResourceManagementModeLabel('managedV2')).toContain('managedV2');
  });

  it('only triggers silent legacy migration once per blog identity', () => {
    const attemptedKeys = new Set(['blog-1']);

    expect(
      shouldTriggerSilentLegacyMigration(
        {
          legacyAutoMigrationPending: true,
          blogInstanceId: 'blog-2',
        },
        attemptedKeys,
      ),
    ).toBe(true);
    expect(
      shouldTriggerSilentLegacyMigration(
        {
          legacyAutoMigrationPending: true,
          blogInstanceId: 'blog-1',
        },
        attemptedKeys,
      ),
    ).toBe(false);
    expect(
      shouldTriggerSilentLegacyMigration(
        {
          legacyAutoMigrationPending: false,
          blogInstanceId: 'blog-3',
        },
        attemptedKeys,
      ),
    ).toBe(false);
  });
});
