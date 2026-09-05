import assert from 'node:assert/strict';
import {
    parseUsageResponse,
    preferredWindow,
    routeRateLimitWindows,
    UsageWindowKind,
} from '../models/usage.js';

{
    const result = routeRateLimitWindows({
        primary_window: {
            used_percent: 66,
            reset_at: 1_800_000_000,
            limit_window_seconds: 18_000,
        },
        secondary_window: {
            used_percent: 41,
            reset_at: 1_800_600_000,
            limit_window_seconds: 604_800,
        },
    });

    assert.equal(result.fiveHour.kind, UsageWindowKind.FIVE_HOUR);
    assert.equal(result.fiveHour.used, 0.66);
    assert.equal(result.weekly.kind, UsageWindowKind.WEEKLY);
    assert.equal(result.weekly.used, 0.41);
}

{
    const usage = parseUsageResponse({
        plan_type: 'plus',
        rate_limit: {
            primary_window: {
                used_percent: 42,
                limit_window_seconds: 604_800,
                reset_at: 1_800_600_000,
            },
            secondary_window: null,
        },
    });

    assert.equal(usage.fiveHour.available, false);
    assert.equal(usage.weekly.available, true);
    assert.equal(preferredWindow(usage).kind, UsageWindowKind.WEEKLY);
}

{
    const result = routeRateLimitWindows({
        primary_window: {used_percent: 10},
        secondary_window: {used_percent: 20},
    });
    assert.equal(result.fiveHour.used, 0.10);
    assert.equal(result.weekly.used, 0.20);
}

console.log('usage parser tests passed');
