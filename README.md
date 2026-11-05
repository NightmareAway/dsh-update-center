# dsh-update-center · 更新中心

给 DeepSeek Harness 的 Web GUI / 桌面客户端加一个"更新中心"：自动检查**已装插件**和 **DSH NEXT 桌面客户端本体**有没有新版本，并在一处一键更新。

## 它做什么

| 对象 | 检查方式 | 更新方式 |
| --- | --- | --- |
| Profile 插件（npm 包） | 用官方 `pluginManager` Remote 取 `listBundles()`，再向 registry 取 `/<name>/latest`，`semver` 比较（含预发布） | 官方 `pluginManager.installBundle(name@latest)`；遇到 `already-installed`（profile 挂了 hmr）自动走"卸载 → 安装 → 失败装回旧版本"两阶段 |
| DSH NEXT 桌面客户端 | 读桌面壳的桥 `window.desktopNext.state()`（壳自身每 6 小时也会检查） | `window.desktopNext.command({type:'download-update' \| 'install-update' \| 'check-updates'})` |

- **自动检查**：页面加载后自动跑一次，之后每 6 小时一次（与桌面客户端自己的节奏一致）。
- **入口**：
  - **设置 → 版本更新**（`settings.section`，排在 "Claude Style" 与 "桌面设置" 之间）：桌面客户端区块与插件区块都在这一页，是主入口；
  - 侧边栏"全局面板"里的 **更新** 行 + 红点角标（行内 glyph 带 `data-dsh-panel-entry="update-center"`），点开是同一份内容的整页视图，作为快捷方式保留。
- **一键更新**：更新页里"一键更新"按顺序更新所有可更新插件，逐个显示进度与结果；官方 `@deepseek-ai/*` 包被排除（版本属于 DSH 安装本体）。
- 更新完成后给出"重启 DSH 后生效"的提示与"立即重启"按钮（走桌面壳的 `restart-app`，壳会先弹确认框）。

## 为什么 Host 半是空的

`index.js` 只有一个空的 `apply()`。检查与写入都走官方 Host Service 的**生成式 Remote**（页面里就是 `POST /api/pluginManager/*`），这是 profile 自身"插件"页用的同一条通道；再叠一层 host HTTP 路由既重复，又需要重启 Host 才能加载新代码。

## 结构

```
package.json           bundle 清单：patch + client 半 + locale + icon
cordis.patch.yml       插入一行 update-center 挂载本包
index.js               Host 半（空实现，见上）
client.js              Client 半：设置分区、面板行 glyph、更新页、检查/更新逻辑
locale/zh.json         显示名与描述（插件页/设置里显示）
locale/en.json
icon.svg
```

## 已验证

- 安装在 `~/.dsh/profiles/desktop`（`file:`/`link:` 链接到本目录），`install_bundle` 返回 `application: "applied"`。
- 自动检查实测：`2 candidates, 2 updates`，其中 `dsh-claude-style 0.19.7 → 0.19.8` 经本插件实际更新成功（profile 依赖已变为 `0.19.8`）。
- 更新页实测渲染出 `@linxin666/dsh-web-all 0.4.14 → 0.4.15 · dsh >=0.2.2-rc.1`（待更新）。

## 分发到其他机器

本包没有运行时依赖，打成一个 tgz 就能拷到别的 DSH 上装。**不要用目录路径（`link:`）安装**：卸载/更新 `link:` 依赖时 pnpm 会清空被链接的源目录（本机实测过一次）。

```powershell
# 在一台机器上打包（产物 ~14 KB）
cd <本目录>
npm pack --pack-destination <输出目录>      # => dsh-update-center-1.0.0.tgz
```

目标机器上任选一种装法：

1. **让 DSH 里的 agent 装**（最简单，不需要额外工具）：把 tgz 拷过去，然后对新会话说
   “用 plugin_manager 的 install_bundle 安装 `D:\path\dsh-update-center-1.0.0.tgz`”。
2. **有 `dsh` CLI 时**：`dsh plugin --profile desktop add D:\path\dsh-update-center-1.0.0.tgz`
3. **在设置 → 插件页**粘贴 tgz 的绝对路径安装（插件管理器的 spec 支持 registry 名称、绝对路径、git 地址和 tarball）。

装完刷新一次主窗口（`Ctrl+R`）或重开 DSH，入口在 **设置 → 版本更新**。

> 以 `file:`/tarball 安装的包不会被"版本更新"自己列为可更新项（只更新 registry 包）。发新版本 = 重新打包 + 重新安装。
> 想在所有机器上一条命令安装，可以把包发到 npm（去掉 package.json 里的 `"private": true`，`npm publish --access public`），之后用 `dsh plugin add dsh-update-center`。

## 已知边界

- 只处理"profile 直接依赖 + 来自 registry"的 bundle：`file:`/`link:`/`git:`/`workspace:`、官方 `@deepseek-ai/*`、以及不可移除的 bundle 不参与。
- 更新会重载插件，可能中断正在跑的会话/工具；host 半有代码变化的更新需要重启 DSH 才生效（Client 半刷新页面即可）。
- 桌面客户端更新只在 Electron 主窗口里可用；普通浏览器里该区块显示"当前不在桌面客户端内"。

