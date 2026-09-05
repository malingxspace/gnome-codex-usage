import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class CodexAuthError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'CodexAuthError';
        this.code = code;
    }
}

function authPath() {
    const codexHome = GLib.getenv('CODEX_HOME');
    const base = codexHome && codexHome.length > 0
        ? codexHome
        : GLib.build_filenamev([GLib.get_home_dir(), '.codex']);

    return GLib.build_filenamev([base, 'auth.json']);
}

export function getAuthPath() {
    return authPath();
}

export function readAccessToken() {
    const path = authPath();
    const file = Gio.File.new_for_path(path);

    let bytes;
    try {
        const [ok, contents] = file.load_contents(null);
        if (!ok)
            throw new Error('读取失败');
        bytes = contents;
    } catch (error) {
        throw new CodexAuthError(
            'auth_missing',
            `未找到 Codex 登录信息：${path}`
        );
    }

    let json;
    try {
        json = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (error) {
        throw new CodexAuthError('auth_invalid', 'Codex auth.json 无法解析');
    }

    const token = json?.tokens?.access_token ?? json?.access_token;
    if (typeof token !== 'string' || token.length === 0)
        throw new CodexAuthError('auth_missing', 'Codex auth.json 中没有 access token');

    return token;
}
