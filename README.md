# Codex Usage for GNOME Shell

一个面向 **GNOME Shell 50 / Ubuntu 26.04** 的 Codex 用量监控扩展。

顶栏显示当前主要额度窗口的百分比；点击后查看 5 小时与每周额度、剩余比例、重置时间、套餐类型与同步状态。

## 功能

- 顶栏显示 Codex 图标与剩余额度（也可改为已使用）
- 5 小时额度与每周额度
- 兼容只有 Weekly quota 的套餐
- 根据 `limit_window_seconds` 识别窗口，不依赖 primary/secondary 固定位置
- 显示 reset 时间
- 手动刷新
- 5 / 15 / 30 分钟自动刷新
- 70 / 85 / 95% 用量阈值通知
- 读取 `$CODEX_HOME/auth.json` 或 `~/.codex/auth.json`
- 不保存 token，不上传会话内容

## 数据来源

扩展读取 Codex CLI 已有登录信息，并使用 access token 请求：

```text
https://chatgpt.com/backend-api/wham/usage
```

这个 endpoint 并不是稳定的公开 OpenAI API，因此 OpenAI 改动返回结构时，扩展可能需要更新。

## 安装

要求：GNOME Shell 50、Codex CLI 已登录。

```bash
git clone https://github.com/malingxspace/gnome-codex-usage.git
cd gnome-codex-usage
make install
gnome-extensions enable codex-usage@malingxspace.github.com
```

Wayland 下如果 GNOME Shell 尚未发现新扩展，请注销并重新登录一次。

## 开发

运行纯 JS usage parser 测试以及 GSettings schema 校验：

```bash
make test
```

打包源码 ZIP：

```bash
make package
```

## 项目结构

```text
.
├── extension.js
├── prefs.js
├── stylesheet.css
├── metadata.json
├── services/
│   ├── codexAuth.js
│   └── codexUsage.js
├── models/
│   └── usage.js
├── utils/
│   └── format.js
├── schemas/
│   └── org.gnome.shell.extensions.codex-usage.gschema.xml
└── tests/
    └── usage-parser.test.mjs
```

## 说明

本项目与 OpenAI 无官方关联。Codex、ChatGPT 和 OpenAI 是其各自权利人的商标。

## License

MIT
