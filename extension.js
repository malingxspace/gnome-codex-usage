import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {CodexUsageClient} from './services/codexUsage.js';
import {preferredWindow, UsageWindowKind} from './models/usage.js';
import {
    formatLastUpdated,
    formatResetTime,
    formatWindowPercent,
    percent,
    remaining,
} from './utils/format.js';

class UsageWindowView {
    constructor(title) {
        this.actor = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'codex-usage-window',
        });

        const header = new St.BoxLayout({x_expand: true});
        this._title = new St.Label({
            text: title,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-window-title',
        });
        this._usedLabel = new St.Label({
            text: '—',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-window-percent',
        });
        header.add_child(this._title);
        header.add_child(this._usedLabel);
        this.actor.add_child(header);

        this._usedFraction = 0;
        this._track = new St.Widget({
            height: 8,
            x_expand: true,
            style_class: 'codex-usage-progress-track',
            layout_manager: new Clutter.BinLayout(),
        });
        this._track.connect('notify::allocation', () => this._syncFillWidth());
        this._fill = new St.Widget({
            width: 0,
            height: 8,
            x_align: Clutter.ActorAlign.START,
            style_class: 'codex-usage-progress-fill',
        });
        this._track.add_child(this._fill);
        this.actor.add_child(this._track);

        const footer = new St.BoxLayout({x_expand: true});
        this._remainingLabel = new St.Label({
            text: '剩余 —',
            x_expand: true,
            style_class: 'codex-usage-window-subtitle',
        });
        this._resetLabel = new St.Label({
            text: '重置时间未知',
            style_class: 'codex-usage-window-subtitle dim-label',
        });
        footer.add_child(this._remainingLabel);
        footer.add_child(this._resetLabel);
        this.actor.add_child(footer);
    }

    update(window, resetTimeMode) {
        this._fill.remove_style_class_name('warning');
        this._fill.remove_style_class_name('critical');

        if (!window?.available) {
            this._usedLabel.text = '—';
            this._remainingLabel.text = '剩余 —';
            this._resetLabel.text = '该套餐未提供此窗口';
            this._usedFraction = 0;
            this._syncFillWidth();
            return;
        }

        this._usedLabel.text = `${percent(window.used)} 已使用`;
        this._remainingLabel.text = `剩余 ${percent(remaining(window))}`;
        this._resetLabel.text = formatResetTime(window.resetAt, resetTimeMode);
        this._usedFraction = window.used;
        this._syncFillWidth();

        if (window.used >= 0.95)
            this._fill.add_style_class_name('critical');
        else if (window.used >= 0.85)
            this._fill.add_style_class_name('warning');
    }

    _syncFillWidth() {
        if (!this._fill)
            return;
        const trackWidth = this._track.allocation.get_width();
        if (trackWidth <= 0)
            return;
        const fillWidth = Math.round(trackWidth * this._usedFraction);
        this._fill.width = this._usedFraction > 0 ? Math.max(2, fillWidth) : 0;
    }

    destroy() {
        this.actor.destroy();
    }
}

const CodexIndicator = GObject.registerClass(
class CodexIndicator extends PanelMenu.Button {
    constructor(extension, settings, onRefresh) {
        super(0.0, extension.metadata.name, false);

        this._extension = extension;
        this._settings = settings;
        this._onRefresh = onRefresh;

        this._panelBox = new St.BoxLayout({
            style_class: 'panel-status-menu-box codex-usage-panel-box',
        });
        this._icon = new St.Icon({
            gicon: this._loadIcon('codex-symbolic.svg'),
            icon_size: 16,
        });
        this._panelLabel = new St.Label({
            text: '—',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-panel-label',
        });
        this._panelBox.add_child(this._icon);
        this._panelBox.add_child(this._panelLabel);
        this.add_child(this._panelBox);

        this._buildMenu();
        this._applyDisplaySettings();
    }

    _loadIcon(name) {
        return new Gio.FileIcon({
            file: this._extension.dir.get_child('icons').get_child(name),
        });
    }

    _buildMenu() {
        const contentItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        const content = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'codex-usage-popup',
        });
        contentItem.add_child(content);
        this.menu.addMenuItem(contentItem);

        const header = new St.BoxLayout({
            x_expand: true,
            style_class: 'codex-usage-header',
        });
        const logo = new St.Icon({
            gicon: this._loadIcon('codex-app.svg'),
            icon_size: 22,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._providerLabel = new St.Label({
            text: 'Codex',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-header-title',
        });
        this._planLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-plan-badge',
        });
        this._statusLabel = new St.Label({
            text: '● 正在连接',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-status',
        });
        header.add_child(logo);
        header.add_child(this._providerLabel);
        header.add_child(this._planLabel);
        header.add_child(this._statusLabel);
        content.add_child(header);

        this._fiveHourSeparator = new St.Widget({
            height: 1,
            style_class: 'codex-usage-separator',
        });
        content.add_child(this._fiveHourSeparator);

        this._fiveHourView = new UsageWindowView('5 小时额度');
        content.add_child(this._fiveHourView.actor);

        content.add_child(new St.Widget({
            height: 1,
            style_class: 'codex-usage-separator',
        }));

        this._weeklyView = new UsageWindowView('每周额度');
        content.add_child(this._weeklyView.actor);

        content.add_child(new St.Widget({
            height: 1,
            style_class: 'codex-usage-separator',
        }));

        this._syncLabel = new St.Label({
            text: '尚未同步',
            style_class: 'codex-usage-sync-label dim-label',
        });
        content.add_child(this._syncLabel);

        this._errorLabel = new St.Label({
            text: '',
            visible: false,
            style_class: 'codex-usage-error-label',
        });
        content.add_child(this._errorLabel);

        const actionItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        const actions = new St.BoxLayout({
            x_expand: true,
            style_class: 'codex-usage-actions',
        });
        const refreshButton = new St.Button({
            label: '⟳  刷新',
            can_focus: true,
            x_expand: true,
            style_class: 'button codex-usage-action-button',
        });
        refreshButton.connect('clicked', () => this._onRefresh());
        const settingsButton = new St.Button({
            label: '⚙  设置',
            can_focus: true,
            x_expand: true,
            style_class: 'button codex-usage-action-button',
        });
        settingsButton.connect('clicked', () => {
            this.menu.close();
            this._extension.openPreferences();
        });
        actions.add_child(refreshButton);
        actions.add_child(settingsButton);
        actionItem.add_child(actions);
        this.menu.addMenuItem(actionItem);
    }

    _applyDisplaySettings() {
        this._icon.visible = this._settings.get_boolean('show-icon');
        this._panelLabel.visible = this._settings.get_boolean('show-percentage');
    }

    update(usage) {
        this._applyDisplaySettings();
        this._errorLabel.visible = false;
        this._statusLabel.text = '● 已连接';
        this._statusLabel.remove_style_class_name('error');
        this._planLabel.text = usage.plan ? usage.plan[0].toUpperCase() + usage.plan.slice(1) : '';
        this._planLabel.visible = Boolean(usage.plan);

        const resetTimeMode = this._settings.get_string('reset-time-mode');
        const showFiveHour = Boolean(usage.fiveHour?.available);
        this._fiveHourSeparator.visible = showFiveHour;
        this._fiveHourView.actor.visible = showFiveHour;
        if (showFiveHour)
            this._fiveHourView.update(usage.fiveHour, resetTimeMode);
        this._weeklyView.update(usage.weekly, resetTimeMode);
        this._syncLabel.text = formatLastUpdated(usage.fetchedAt);

        const target = preferredWindow(usage);
        const mode = this._settings.get_string('percentage-mode');
        this._panelLabel.text = target ? formatWindowPercent(target, mode) : '—';
        this._applySeverity(target);
        this.set_accessible_name(this._accessibleSummary(usage, target));
    }

    setRefreshing() {
        this._panelLabel.text = '···';
        this._statusLabel.text = '● 正在刷新';
        this._errorLabel.visible = false;
        this.set_accessible_name('Codex 正在刷新用量');
    }

    setError(error) {
        this._panelLabel.text = error.code === 'auth_missing' || error.code === 'auth_expired' ? '—' : '!';
        this._statusLabel.text = '● 获取失败';
        this._statusLabel.add_style_class_name('error');
        this._errorLabel.text = error.message;
        this._errorLabel.visible = true;
        this.set_accessible_name(`Codex：${error.message}`);
        this._clearSeverity();
    }

    _accessibleSummary(usage, target) {
        if (!target)
            return 'Codex：当前没有可用的额度窗口';
        const kind = target.kind === UsageWindowKind.WEEKLY ? '每周' : '5 小时';
        return `Codex ${kind}额度，剩余 ${percent(remaining(target))}，${formatResetTime(target.resetAt)}`;
    }

    _clearSeverity() {
        this._panelLabel.remove_style_class_name('warning');
        this._panelLabel.remove_style_class_name('critical');
    }

    _applySeverity(target) {
        this._clearSeverity();
        if (!target?.available)
            return;
        if (target.used >= 0.95)
            this._panelLabel.add_style_class_name('critical');
        else if (target.used >= 0.85)
            this._panelLabel.add_style_class_name('warning');
    }

    destroy() {
        this._fiveHourView?.destroy();
        this._weeklyView?.destroy();
        super.destroy();
    }
});

export default class CodexUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._client = new CodexUsageClient();
        this._cancellable = new Gio.Cancellable();
        this._refreshing = false;
        this._timeoutId = 0;
        this._settingsSignals = [];
        this._lastAlertKey = null;

        this._indicator = new CodexIndicator(
            this,
            this._settings,
            () => this._refresh()
        );
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settingsSignals.push(
            this._settings.connect('changed::refresh-interval', () => this._restartTimer()),
            this._settings.connect('changed::show-icon', () => this._renderLastUsage()),
            this._settings.connect('changed::show-percentage', () => this._renderLastUsage()),
            this._settings.connect('changed::percentage-mode', () => this._renderLastUsage()),
            this._settings.connect('changed::reset-time-mode', () => this._renderLastUsage()),
            this._settings.connect('changed::warning-threshold', () => this._evaluateAlert()),
            this._settings.connect('changed::notifications-enabled', () => this._evaluateAlert())
        );

        this._restartTimer();
        this._refresh();
    }

    disable() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        this._cancellable?.cancel();

        if (this._settings) {
            for (const signalId of this._settingsSignals ?? [])
                this._settings.disconnect(signalId);
        }

        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
        this._client = null;
        this._cancellable = null;
        this._settingsSignals = [];
        this._lastUsage = null;
    }

    _restartTimer() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const interval = Math.max(300, this._settings.get_uint('refresh-interval'));
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    async _refresh() {
        if (this._refreshing || !this._client)
            return;

        this._refreshing = true;
        this._indicator?.setRefreshing();

        try {
            const usage = await this._client.fetch(this._cancellable);
            if (!this._indicator)
                return;
            this._lastUsage = usage;
            this._indicator.update(usage);
            this._evaluateAlert();
        } catch (error) {
            if (error.code !== 'cancelled')
                this._indicator?.setError(error);
        } finally {
            this._refreshing = false;
        }
    }

    _renderLastUsage() {
        if (this._lastUsage)
            this._indicator?.update(this._lastUsage);
    }

    _evaluateAlert() {
        if (!this._lastUsage || !this._settings.get_boolean('notifications-enabled'))
            return;

        const target = preferredWindow(this._lastUsage);
        if (!target?.available)
            return;

        const threshold = this._settings.get_uint('warning-threshold') / 100;
        if (target.used < threshold)
            return;

        const resetKey = target.resetAt?.getTime() ?? 0;
        const key = `${target.kind}:${resetKey}:${threshold}`;
        if (key === this._lastAlertKey)
            return;

        this._lastAlertKey = key;
        const kind = target.kind === UsageWindowKind.WEEKLY ? '每周' : '5 小时';
        Main.notify(
            `Codex ${kind}额度剩余 ${percent(remaining(target))}`,
            formatResetTime(target.resetAt)
        );
    }
}
