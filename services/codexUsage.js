import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import {readAccessToken, CodexAuthError} from './codexAuth.js';
import {parseUsageResponse} from '../models/usage.js';

const USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';

export class CodexUsageError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'CodexUsageError';
        this.code = code;
    }
}

export class CodexUsageClient {
    constructor() {
        this._session = new Soup.Session({
            user_agent: 'gnome-codex-usage/0.1.0',
            timeout: 20,
        });
    }

    async fetch(cancellable = null) {
        let token;
        try {
            token = readAccessToken();
        } catch (error) {
            if (error instanceof CodexAuthError)
                throw new CodexUsageError(error.code, error.message);
            throw error;
        }

        const message = Soup.Message.new('GET', USAGE_URL);
        const headers = message.get_request_headers();
        headers.append('Authorization', `Bearer ${token}`);
        headers.append('Accept', 'application/json');

        let bytes;
        try {
            bytes = await new Promise((resolve, reject) => {
                this._session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    cancellable,
                    (session, result) => {
                        try {
                            resolve(session.send_and_read_finish(result));
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
            });
        } catch (error) {
            if (cancellable?.is_cancelled())
                throw new CodexUsageError('cancelled', '请求已取消');
            throw new CodexUsageError('network_error', `网络连接失败：${error.message}`);
        }

        const status = message.get_status();
        if (status === 401)
            throw new CodexUsageError('auth_expired', 'Codex 登录已过期，请运行 codex login');
        if (status === 429)
            throw new CodexUsageError('rate_limited', '请求过于频繁，请稍后再试');
        if (status !== 200)
            throw new CodexUsageError('http_error', `Codex 用量接口返回 HTTP ${status}`);

        let payload;
        try {
            payload = JSON.parse(new TextDecoder('utf-8').decode(bytes.get_data()));
        } catch (error) {
            throw new CodexUsageError('parse_error', '无法解析 Codex 用量响应');
        }

        try {
            return parseUsageResponse(payload);
        } catch (error) {
            throw new CodexUsageError('parse_error', error.message);
        }
    }
}
