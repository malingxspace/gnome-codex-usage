export const UsageWindowKind = Object.freeze({
    FIVE_HOUR: 'five-hour',
    WEEKLY: 'weekly',
});

export function emptyWindow(kind) {
    return {
        kind,
        available: false,
        used: 0,
        resetAt: null,
    };
}

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

function parseResetAt(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return new Date(value * 1000);

    if (typeof value === 'string') {
        const timestamp = Date.parse(value);
        if (!Number.isNaN(timestamp))
            return new Date(timestamp);
    }

    return null;
}

export function parseWindow(raw, kind) {
    if (!raw || typeof raw !== 'object')
        return emptyWindow(kind);

    const usedPercent = Number(raw.used_percent ?? raw.utilization);
    const used = Number.isFinite(usedPercent) ? clamp01(usedPercent / 100) : 0;

    return {
        kind,
        available: Number.isFinite(usedPercent),
        used,
        resetAt: parseResetAt(raw.reset_at ?? raw.resets_at),
    };
}

/**
 * Codex no longer guarantees primary_window=5h and secondary_window=weekly.
 * Route each window by its advertised span and only fall back to slot order
 * when limit_window_seconds is absent.
 */
export function routeRateLimitWindows(rateLimit) {
    let fiveHour = null;
    let weekly = null;

    const slots = [
        ['primary_window', UsageWindowKind.FIVE_HOUR],
        ['secondary_window', UsageWindowKind.WEEKLY],
    ];

    for (const [key, fallbackKind] of slots) {
        const raw = rateLimit?.[key];
        if (!raw || typeof raw !== 'object')
            continue;

        const span = Number(raw.limit_window_seconds);
        const kind = Number.isFinite(span)
            ? (span >= 86400 ? UsageWindowKind.WEEKLY : UsageWindowKind.FIVE_HOUR)
            : fallbackKind;

        if (kind === UsageWindowKind.FIVE_HOUR && fiveHour === null)
            fiveHour = parseWindow(raw, kind);
        else if (kind === UsageWindowKind.WEEKLY && weekly === null)
            weekly = parseWindow(raw, kind);
    }

    return {
        fiveHour: fiveHour ?? emptyWindow(UsageWindowKind.FIVE_HOUR),
        weekly: weekly ?? emptyWindow(UsageWindowKind.WEEKLY),
    };
}

export function parseUsageResponse(payload) {
    if (!payload || typeof payload !== 'object' || !payload.rate_limit)
        throw new Error('用量响应缺少 rate_limit');

    const windows = routeRateLimitWindows(payload.rate_limit);
    return {
        plan: typeof payload.plan_type === 'string' ? payload.plan_type : null,
        fiveHour: windows.fiveHour,
        weekly: windows.weekly,
        fetchedAt: new Date(),
    };
}

export function preferredWindow(usage) {
    if (usage?.fiveHour?.available)
        return usage.fiveHour;
    if (usage?.weekly?.available)
        return usage.weekly;
    return null;
}
