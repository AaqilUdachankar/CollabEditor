import { ActivityRepository } from '../models/Activity.js';

interface HealthCounters {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  timeoutCount: number;
  totalDurationMs: number;
  saveFailures: number;
  reconnects: number;
  websocketErrors: number;
  apiErrors: number;
}

const counters: HealthCounters = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  timeoutCount: 0,
  totalDurationMs: 0,
  saveFailures: 0,
  reconnects: 0,
  websocketErrors: 0,
  apiErrors: 0,
};

export const HealthMetricsService = {
  recordExecution(data: { success: boolean; durationMs: number; timedOut?: boolean }) {
    counters.totalExecutions++;
    counters.totalDurationMs += data.durationMs || 0;
    if (data.timedOut) {
      counters.timeoutCount++;
      counters.failedExecutions++;
    } else if (data.success) {
      counters.successfulExecutions++;
    } else {
      counters.failedExecutions++;
    }
  },

  recordSaveFailure() {
    counters.saveFailures++;
  },

  recordReconnect() {
    counters.reconnects++;
  },

  recordWebSocketError() {
    counters.websocketErrors++;
  },

  recordApiError() {
    counters.apiErrors++;
  },

  async getMetrics() {
    // Also cross-reference persisted activities for any past recorded errors
    const errorActivities = await ActivityRepository.findPlatform({
      eventType: 'execution:error',
      limit: 100,
    }).catch(() => ({ activities: [], total: 0 }));

    const saveErrorActivities = await ActivityRepository.findPlatform({
      eventType: 'error:save',
      limit: 100,
    }).catch(() => ({ activities: [], total: 0 }));

    const apiErrorActivities = await ActivityRepository.findPlatform({
      eventType: 'error:api',
      limit: 100,
    }).catch(() => ({ activities: [], total: 0 }));

    const executionActivities = await ActivityRepository.findPlatform({
      eventType: 'execution:complete',
      limit: 200,
    }).catch(() => ({ activities: [], total: 0 }));

    const totalExecs = Math.max(
      counters.totalExecutions,
      executionActivities.total + errorActivities.total
    );
    const failedExecs = Math.max(counters.failedExecutions, errorActivities.total);
    const successExecs = Math.max(counters.successfulExecutions, totalExecs - failedExecs);

    const avgDuration =
      counters.totalExecutions > 0
        ? Math.round(counters.totalDurationMs / counters.totalExecutions)
        : 0;

    const totalErrors =
      failedExecs +
      counters.saveFailures +
      counters.websocketErrors +
      counters.apiErrors +
      saveErrorActivities.total +
      apiErrorActivities.total;

    return {
      executions: {
        total: totalExecs,
        successful: successExecs,
        failed: failedExecs,
        successRate: totalExecs > 0 ? Math.round((successExecs / totalExecs) * 100) : 100,
        avgDurationMs: avgDuration,
        timeoutCount: counters.timeoutCount,
      },
      errors: {
        saveFailures: Math.max(counters.saveFailures, saveErrorActivities.total),
        apiErrors: Math.max(counters.apiErrors, apiErrorActivities.total),
        websocketErrors: counters.websocketErrors,
        reconnects: counters.reconnects,
        totalErrors,
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        nodeVersion: process.version,
        platform: process.platform,
        status: totalErrors > 15 ? 'degraded' : 'healthy',
      },
    };
  },
};

