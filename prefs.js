import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function comboRow(title, options, current, onChanged) {
    const model = Gtk.StringList.new(options.map(option => option.label));
    const selected = Math.max(0, options.findIndex(option => option.value === current));
    const row = new Adw.ComboRow({title, model, selected});
    row.connect('notify::selected', widget => {
        const option = options[widget.selected];
        if (option)
            onChanged(option.value);
    });
    return row;
}

export default class CodexUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(560, 620);
        window._codexUsageSettings = settings;

        const page = new Adw.PreferencesPage({
            title: 'Codex Usage',
            icon_name: 'utilities-system-monitor-symbolic',
        });
        window.add(page);

        const display = new Adw.PreferencesGroup({
            title: '显示',
            description: '控制顶栏与下拉面板的显示方式',
        });
        page.add(display);

        const showIcon = new Adw.SwitchRow({title: '显示 Codex 图标'});
        settings.bind('show-icon', showIcon, 'active', Gio.SettingsBindFlags.DEFAULT);
        display.add(showIcon);

        const showPercent = new Adw.SwitchRow({title: '显示百分比'});
        settings.bind('show-percentage', showPercent, 'active', Gio.SettingsBindFlags.DEFAULT);
        display.add(showPercent);

        display.add(comboRow(
            '百分比方式',
            [
                {label: '剩余（推荐）', value: 'remaining'},
                {label: '已使用', value: 'used'},
            ],
            settings.get_string('percentage-mode'),
            value => settings.set_string('percentage-mode', value)
        ));

        display.add(comboRow(
            '重置时间',
            [
                {label: '相对时间', value: 'relative'},
                {label: '具体时间', value: 'absolute'},
            ],
            settings.get_string('reset-time-mode'),
            value => settings.set_string('reset-time-mode', value)
        ));

        const data = new Adw.PreferencesGroup({
            title: '数据',
            description: '扩展读取 ~/.codex/auth.json，并直接请求 Codex 用量接口',
        });
        page.add(data);

        data.add(comboRow(
            '刷新间隔',
            [
                {label: '5 分钟', value: 300},
                {label: '15 分钟', value: 900},
                {label: '30 分钟', value: 1800},
            ],
            settings.get_uint('refresh-interval'),
            value => settings.set_uint('refresh-interval', value)
        ));

        const authPath = new Adw.ActionRow({
            title: '认证文件',
            subtitle: '$CODEX_HOME/auth.json 或 ~/.codex/auth.json',
        });
        data.add(authPath);

        const notifications = new Adw.PreferencesGroup({
            title: '通知',
            description: '达到阈值后，每个额度周期只提醒一次',
        });
        page.add(notifications);

        const enableNotifications = new Adw.SwitchRow({title: '额度警告'});
        settings.bind(
            'notifications-enabled',
            enableNotifications,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        notifications.add(enableNotifications);

        notifications.add(comboRow(
            '警告阈值',
            [
                {label: '70% 已使用', value: 70},
                {label: '85% 已使用', value: 85},
                {label: '95% 已使用', value: 95},
            ],
            settings.get_uint('warning-threshold'),
            value => settings.set_uint('warning-threshold', value)
        ));

        const privacy = new Adw.PreferencesGroup({
            title: '隐私',
        });
        page.add(privacy);
        privacy.add(new Adw.ActionRow({
            title: '本地优先',
            subtitle: '不会上传会话内容；只读取本地 Codex access token 并请求 chatgpt.com 用量接口。',
        }));
    }
}
