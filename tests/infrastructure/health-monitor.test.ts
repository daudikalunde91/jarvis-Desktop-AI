import { describe, expect, it, vi } from 'vitest';

import { HealthMonitor } from '@backend/infrastructure/health-monitor/HealthMonitor';
import { HealthMonitorError } from '@backend/shared/errors/InfrastructureError';
import { createTestLogger } from '../support/testLogger';

describe('HealthMonitor', () => {
  it('reports the status returned by a registered check', async () => {
    const monitor = new HealthMonitor(createTestLogger());
    monitor.register('service-a', () => 'running');

    const status = await monitor.checkNow('service-a');
    expect(status).toBe('running');
    expect(monitor.getStatus('service-a')).toBe('running');
  });

  it('tracks consecutive failures and resets on recovery', async () => {
    const monitor = new HealthMonitor(createTestLogger());
    let shouldFail = true;
    monitor.register('service-b', () => (shouldFail ? 'failed' : 'running'));

    await monitor.checkNow('service-b');
    await monitor.checkNow('service-b');
    expect(monitor.getRecord('service-b')?.failureCount).toBe(2);

    shouldFail = false;
    await monitor.checkNow('service-b');
    expect(monitor.getRecord('service-b')?.failureCount).toBe(0);
  });

  it('triggers the restart callback once the failure threshold is exceeded', async () => {
    const monitor = new HealthMonitor(createTestLogger());
    const onFailureThresholdExceeded = vi.fn();
    monitor.register('service-c', () => 'failed', {
      maxConsecutiveFailures: 2,
      onFailureThresholdExceeded,
    });

    await monitor.checkNow('service-c');
    expect(onFailureThresholdExceeded).not.toHaveBeenCalled();

    await monitor.checkNow('service-c');
    expect(onFailureThresholdExceeded).toHaveBeenCalledTimes(1);
  });

  it('heartbeat() records a timestamp for a registered module', () => {
    const monitor = new HealthMonitor(createTestLogger());
    monitor.register('service-d', () => 'running');

    monitor.heartbeat('service-d');
    expect(monitor.getRecord('service-d')?.lastHeartbeat).not.toBeNull();
  });

  it('throws when checking or heartbeating an unregistered module', () => {
    const monitor = new HealthMonitor(createTestLogger());
    expect(() => monitor.heartbeat('missing')).toThrow(HealthMonitorError);
  });

  it('startMonitoring() polls on an interval and stopMonitoring() halts it', async () => {
    vi.useFakeTimers();
    const monitor = new HealthMonitor(createTestLogger());
    const check = vi.fn().mockReturnValue('running');
    monitor.register('service-e', check);

    monitor.startMonitoring(1000);
    await vi.advanceTimersByTimeAsync(3500);
    monitor.stopMonitoring();
    const callsAfterStop = check.mock.calls.length;

    await vi.advanceTimersByTimeAsync(5000);
    expect(check.mock.calls.length).toBe(callsAfterStop);
    expect(callsAfterStop).toBeGreaterThanOrEqual(3);

    vi.useRealTimers();
  });
});
