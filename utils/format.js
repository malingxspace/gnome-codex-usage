export function percent(value) {
    return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function remaining(window) {
    return 1 - (window?.used ?? 0);
}

export function formatWindowPercent(window, mode = 'remaining') {
    if (!window?.available)
        return '—';
    return percent(mode === 'used' ? window.used : remaining(window));
}

export function formatResetTime(date, mode = 'relative') {
    if (!(date instanceof Date) || Number.isNaN(date.getTime()))
        return '重置时间未知';

    if (mode === 'absolute') {
        return new Intl.DateTimeFormat(undefined, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    }

    const diff = Math.max(0, date.getTime() - Date.now());
    const totalMinutes = Math.ceil(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0)
        return `${days}天 ${hours}小时后重置`;
    if (hours > 0)
        return `${hours}小时 ${minutes}分钟后重置`;
    return `${minutes}分钟后重置`;
}

export function formatLastUpdated(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime()))
        return '尚未同步';

    return `最近更新 ${new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)}`;
}
