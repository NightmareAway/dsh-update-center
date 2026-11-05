/**
 * dsh-update-center — Client half.
 *
 * A sidebar-foot entry beside Settings (with a count badge) and one panel in
 * the frame-wide overlay layer. Two kinds of update share the panel:
 *
 *  - Plugins: every profile bundle installed from the npm registry is compared
 *    against the version its registry serves; the update runs through the
 *    official `pluginManager` Remote (`installBundle` / `removeBundle`) — the
 *    same writer the profile's own Plugins page uses.
 *  - Desktop app: read from the shell bridge (`window.desktopNext.state()`),
 *    driven through `window.desktopNext.command(...)`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-update-center',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const ReactExports = React
    const { useCallback, useEffect, useRef, useState, useSyncExternalStore } = ReactExports

    const NS = 'dsh-update-center'
    const SELF = 'dsh-update-center'
    const OFFICIAL_SCOPE = '@deepseek-ai/'
    const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
    const NPM_FALLBACKS = ['https://registry.npmjs.org', 'https://registry.npmmirror.com']

    // ------------------------------------------------------------------
    // dictionaries
    // ------------------------------------------------------------------

    const ZH = {
      entry: '更新',
      settingsEntry: '版本更新',
      title: '更新中心',
      subtitle: '插件与桌面客户端',
      close: '关闭',
      appSection: '桌面客户端',
      appInstalled: '当前版本',
      appUnavailable: '当前不在桌面客户端内，应用更新不可用。',
      appIdle: '尚未检查更新',
      appChecking: '正在检查更新…',
      appCurrent: '已是最新版本',
      appAvailable: '发现新版本',
      appDownloading: '正在下载更新',
      appPreparing: '正在准备安装…',
      appReady: '更新已下载，可以安装并重启',
      appInstalling: '正在安装并重启…',
      appDev: '开发环境可检查更新，请使用安装版升级。',
      appUnsupported: '当前平台暂不支持应用内更新。',
      appService: '暂时无法获取更新信息，请稍后重试。',
      appFailed: '更新未完成，请重试。',
      checkApp: '检查更新',
      downloadApp: '下载更新',
      installApp: '安装并重启',
      pluginSection: '插件',
      pluginEmpty: '所有插件都是最新版本',
      pluginChecking: '正在检查插件更新…',
      pluginLastChecked: '上次检查',
      pluginNever: '尚未检查',
      pluginAvailable: '个可更新',
      pluginRefresh: '重新检查',
      pluginPending: '待更新',
      pluginUpdating: '更新中…',
      pluginDone: '已更新',
      pluginFailed: '失败',
      pluginRolledBack: '已装回原版本',
      updateAll: '一键更新',
      updating: '更新中…',
      updatingOne: '正在更新',
      restartHint: '已更新 {n} 个插件，重启 DSH 后生效',
      restartNow: '立即重启',
      restartManual: '请退出 DSH NEXT 后重新打开以加载新版本',
      autoHint: '自动检查已开启',
      autoOff: '自动检查已关闭',
      everyHours: '每 {n} 小时检查一次',
      justNow: '刚刚',
      minutesAgo: '{n} 分钟前',
      hoursAgo: '{n} 小时前',
      daysAgo: '{n} 天前',
      hostUnavailable: '插件管理服务不可用，无法执行更新。',
      readyToRestart: '重启后生效',
      of: '/',
      reload: '刷新页面',
    }

    const EN = {
      entry: 'Updates',
      settingsEntry: 'Version & updates',
      title: 'Update Center',
      subtitle: 'Plugins and desktop app',
      close: 'Close',
      appSection: 'Desktop app',
      appInstalled: 'Installed',
      appUnavailable: 'App updates are only available inside the Desktop client.',
      appIdle: 'Not checked yet',
      appChecking: 'Checking for updates…',
      appCurrent: 'Up to date',
      appAvailable: 'New version available',
      appDownloading: 'Downloading update',
      appPreparing: 'Preparing update…',
      appReady: 'Downloaded — ready to install and restart',
      appInstalling: 'Installing and restarting…',
      appDev: 'Updates can be checked in development. Install a packaged build to update.',
      appUnsupported: 'In-app updates are unavailable on this platform.',
      appService: 'Update information is temporarily unavailable. Try again later.',
      appFailed: 'The update did not complete. Please retry.',
      checkApp: 'Check for updates',
      downloadApp: 'Download update',
      installApp: 'Install and restart',
      pluginSection: 'Plugins',
      pluginEmpty: 'Every plugin is up to date',
      pluginChecking: 'Checking plugin updates…',
      pluginLastChecked: 'Last checked',
      pluginNever: 'never',
      pluginAvailable: 'updates available',
      pluginRefresh: 'Check again',
      pluginPending: 'Pending',
      pluginUpdating: 'Updating…',
      pluginDone: 'Updated',
      pluginFailed: 'Failed',
      pluginRolledBack: 'previous version restored',
      updateAll: 'Update all',
      updating: 'Updating…',
      updatingOne: 'Updating',
      restartHint: '{n} plugin(s) updated — restart DSH to load them',
      restartNow: 'Restart now',
      restartManual: 'Quit DSH NEXT and open it again to load the new versions',
      autoHint: 'Automatic checks are on',
      autoOff: 'Automatic checks are off',
      everyHours: 'Checked every {n} hours',
      justNow: 'just now',
      minutesAgo: '{n} min ago',
      hoursAgo: '{n} h ago',
      daysAgo: '{n} d ago',
      hostUnavailable: 'The plugin manager service is unavailable; updates cannot run.',
      readyToRestart: 'takes effect after restart',
      of: 'of',
      reload: 'Reload page',
    }

    function dict() {
      let language = ''
      try {
        language = String(activeLanguage() || '')
      } catch {
        language = ''
      }
      if (!language) language = String(globalThis.navigator?.language || 'en')
      return language.toLowerCase().startsWith('zh') ? ZH : EN
    }

    let activeLanguage = () => ''

    function substitute(text, vars) {
      if (!vars) return text
      return String(text).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
    }

    // ------------------------------------------------------------------
    // version compare (no dependency: this file is served as-is)
    // ------------------------------------------------------------------

    function parseVersion(value) {
      if (typeof value !== 'string') return null
      const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim())
      if (!match) return null
      return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        pre: match[4] ? match[4].split('.') : [],
      }
    }

    function comparePre(a, b) {
      if (!a.length && !b.length) return 0
      if (!a.length) return 1
      if (!b.length) return -1
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const left = a[index]
        const right = b[index]
        if (left === undefined) return -1
        if (right === undefined) return 1
        const ln = /^\d+$/.test(left)
        const rn = /^\d+$/.test(right)
        if (ln && rn) {
          const delta = Number(left) - Number(right)
          if (delta !== 0) return delta > 0 ? 1 : -1
          continue
        }
        if (ln) return -1
        if (rn) return 1
        if (left !== right) return left > right ? 1 : -1
      }
      return 0
    }

    function compareVersions(left, right) {
      const a = parseVersion(left)
      const b = parseVersion(right)
      if (!a || !b) return 0
      for (const key of ['major', 'minor', 'patch']) {
        const delta = a[key] - b[key]
        if (delta !== 0) return delta > 0 ? 1 : -1
      }
      return comparePre(a.pre, b.pre)
    }

    // ------------------------------------------------------------------
    // store
    // ------------------------------------------------------------------

    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          value = typeof next === 'function' ? next(value) : next
          listeners.forEach((listener) => listener())
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    const store = createStore({
      open: false,
      pluginManager: null,
      checking: false,
      updating: false,
      items: [],
      lastCheckedAt: null,
      lastError: null,
      progress: { current: null, done: 0, total: 0 },
      app: null,
      appMissing: false,
      notice: null,
      refreshedAt: null,
    })

    const patch = (next) => store.set((current) => ({ ...current, ...next }))
    const current = () => store.get()

    // ------------------------------------------------------------------
    // desktop shell bridge
    // ------------------------------------------------------------------

    function desktopBridge() {
      if (typeof window === 'undefined') return null
      const bridge = window.desktopNext
      return bridge && typeof bridge.command === 'function' ? bridge : null
    }

    function desktopCommand(type) {
      const bridge = desktopBridge()
      if (!bridge) return Promise.resolve()
      try {
        return Promise.resolve(bridge.command({ type }))
      } catch {
        return Promise.resolve()
      }
    }

    async function refreshApp() {
      const bridge = desktopBridge()
      if (!bridge) {
        patch({ app: null, appMissing: true })
        return
      }
      try {
        const state = await bridge.state()
        patch({ app: state || null, appMissing: false })
      } catch {
        patch({ appMissing: true })
      }
    }

    // ------------------------------------------------------------------
    // plugin checks through the official Remote
    // ------------------------------------------------------------------

    let pluginManager = null
    let layoutService = null

    /** Remote results arrive as `{ ok, value }`; plain values pass through. */
    function unwrap(result) {
      if (result && typeof result === 'object' && 'ok' in result && 'value' in result) {
        if (result.ok === false) throw new Error(result.error?.message || 'remote-failed')
        return result.value
      }
      return result
    }

    function isRegistrySource(bundle) {
      if (typeof bundle?.source !== 'string') return false
      if (/^(file|link|workspace|portal|git|https?):/.test(bundle.source)) return false
      return true
    }

    function normaliseRegistry(value) {
      if (typeof value !== 'string' || !value) return null
      const trimmed = value.replace(/\/+$/, '')
      return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
    }

    async function registryBases() {
      const bases = []
      const push = (value) => {
        const base = normaliseRegistry(value)
        if (base && !bases.includes(base)) bases.push(base)
      }
      try {
        push(await ctxServices.registryProbe?.())
      } catch {
        /* the probe is optional */
      }
      for (const base of NPM_FALLBACKS) push(base)
      return bases
    }

    const ctxServices = { registryProbe: null, registries: null }

    async function latestVersion(name) {
      const encoded = name.replace('/', '%2f')
      for (const base of await registryBases()) {
        try {
          const response = await fetch(`${base}/${encoded}/latest`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          })
          if (!response.ok) continue
          const document = await response.json()
          const version = document?.version
          if (typeof version !== 'string' || !version) continue
          const engines = document?.dsh?.engines?.dsh ?? document?.engines?.dsh ?? null
          return { version, engines: typeof engines === 'string' ? engines : null, registry: base }
        } catch {
          /* try the next base */
        }
      }
      return null
    }

    async function checkPlugins() {
      if (!pluginManager) {
        patch({ lastError: 'plugin-manager-unavailable' })
        return
      }
      patch({ checking: true, lastError: null })
      try {
        const raw = unwrap(await pluginManager.listBundles())
        const bundles = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : []
        const candidates = bundles.filter(
          (bundle) =>
            bundle &&
            bundle.availability === 'profile' &&
            bundle.installed !== false &&
            bundle.removable !== false &&
            typeof bundle.name === 'string' &&
            bundle.name !== SELF &&
            !bundle.name.startsWith(OFFICIAL_SCOPE) &&
            isRegistrySource(bundle) &&
            typeof bundle.version === 'string',
        )
        const found = []
        for (const bundle of candidates) {
          const latest = await latestVersion(bundle.name)
          if (!latest) continue
          if (compareVersions(latest.version, bundle.version) <= 0) continue
          found.push({
            name: bundle.name,
            description: bundle.description,
            installed: bundle.version,
            latest: latest.version,
            engines: latest.engines,
            registry: latest.registry,
            status: 'pending',
            error: null,
            rolledBack: false,
          })
        }
        patch({
          items: found.sort((left, right) => left.name.localeCompare(right.name)),
          lastCheckedAt: Date.now(),
          checking: false,
        })
      } catch (error) {

        patch({
          checking: false,
          lastError: error instanceof Error ? error.message : String(error),
        })
      }
    }

    function diagnosticOf(result) {
      const code = result?.error?.code
      const diagnostic = result?.error?.diagnostic
      const incompatible = result?.error?.incompatible
        ?.map((entry) => `${entry.name}@${entry.version} needs dsh ${JSON.stringify(entry.requirements)}`)
        .join('; ')
      return [code, diagnostic, incompatible].filter(Boolean).join(' — ') || 'operation-failed'
    }

    function patchItems(mutate) {
      patch((state) => ({ items: state.items.map(mutate) }))
    }

    async function updateOne(item) {
      const spec = `${item.name}@${item.latest}`
      patchItems((entry) => (entry.name === item.name ? { ...entry, status: 'updating', error: null } : entry))
      let result = unwrap(await pluginManager.installBundle(spec, { enabled: true }))
      if (result?.error || result?.application === 'failed' || result?.application === 'cancelled') {
        const code = result?.error?.code
        if (code === 'already-installed') {
          // A live profile mounts hmr, so an in-place overwrite is refused:
          // drop the bundle, install the target, and put the old one back when
          // the install itself fails.
          const removal = unwrap(await pluginManager.removeBundle(item.name))
          if (removal?.application === 'failed' || removal?.error) {
            throw new Error(`remove: ${diagnosticOf(removal)}`)
          }
          result = unwrap(await pluginManager.installBundle(spec, { enabled: true }))
          if (result?.error || result?.application === 'failed' || result?.application === 'cancelled') {
            try {
              unwrap(await pluginManager.installBundle(`${item.name}@${item.installed}`, { enabled: true }))
              patchItems((entry) => (entry.name === item.name ? { ...entry, rolledBack: true } : entry))
            } catch {
              /* the official manager already restored the manifest */
            }
            throw new Error(`install: ${diagnosticOf(result)}`)
          }
        } else {
          throw new Error(`install: ${diagnosticOf(result)}`)
        }
      }
      // Trust the observed profile, not the returned status.
      try {
        const bundles = unwrap(await pluginManager.listBundles())
        const list = Array.isArray(bundles) ? bundles : Array.isArray(bundles?.entries) ? bundles.entries : []
        const after = list.find((bundle) => bundle.name === item.name)
        if (after?.version) {
          patchItems((entry) =>
            entry.name === item.name ? { ...entry, installed: after.version, status: 'done' } : entry,
          )
          return
        }
      } catch {
        /* fall through to the optimistic status */
      }
      patchItems((entry) => (entry.name === item.name ? { ...entry, installed: item.latest, status: 'done' } : entry))
    }

    async function updateItems(names) {
      if (!pluginManager || current().updating) return
      const requested = Array.isArray(names) && names.length ? new Set(names) : null
      const targets = current().items.filter(
        (item) => item.status !== 'done' && (!requested || requested.has(item.name)),
      )
      if (!targets.length) return
      patch({
        updating: true,
        notice: null,
        progress: { current: null, done: 0, total: targets.length },
      })
      for (const item of targets) {
        patch({ progress: { current: item.name, done: current().progress.done, total: targets.length } })
        try {
          await updateOne(item)
        } catch (error) {
          patchItems((entry) =>
            entry.name === item.name
              ? { ...entry, status: 'failed', error: error instanceof Error ? error.message : String(error) }
              : entry,
          )
        }
        const progress = current().progress
        patch({ progress: { ...progress, done: progress.done + 1, current: null } })
      }
      patch({ updating: false })
    }

    // ------------------------------------------------------------------
    // polling
    // ------------------------------------------------------------------

    let timer = null
    let disposed = false

    function nextDelay() {
      const state = current()
      if (state.updating) return 1000
      const phase = state.app?.updates?.phase
      if (phase === 'downloading' || phase === 'checking' || phase === 'preparing') return 1000
      return 15000
    }

    async function refreshAll() {
      await Promise.all([refreshApp(), pluginManager ? refreshManagerFacts() : Promise.resolve()])
    }

    let managerFacts = null

    async function refreshManagerFacts() {
      try {
        managerFacts = await pluginManager.registries()
      } catch {
        managerFacts = null
      }
    }

    function schedule() {
      if (disposed) return
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await refreshApp()
        schedule()
      }, nextDelay())
    }

    // ------------------------------------------------------------------
    // components
    // ------------------------------------------------------------------

    function Styles() {
      return h(
        'style',
        null,
        `
.dsu-page { position: absolute; inset: 0; overflow: auto; padding: 22px 26px 40px; box-sizing: border-box;
  color: var(--dsw-alias-label-primary, #111827); background: var(--dsw-alias-bg-base, #fff); }
.dsu-page-inner { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.dsu-page-title { margin: 0; font-size: 17px; font-weight: 600; }
.dsu-page-subtitle { margin: 4px 0 6px; font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.dsu-glyph { display: block; }
.dsu-settings { display: flex; flex-direction: column; padding: 2px 2px 28px; box-sizing: border-box; }
.dsu-settings-inner { display: flex; flex-direction: column; gap: 14px; max-width: 720px; }
.dsu-mask { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px;
  background: var(--dsw-alias-bg-mask-1, rgba(15, 23, 42, .38)); pointer-events: auto; z-index: 60; }
.dsu-card { width: min(620px, 100%); max-height: min(78vh, 720px); display: flex; flex-direction: column; overflow: hidden;
  border-radius: var(--dsw-radius-lg, 16px); border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.24));
  background: var(--dsw-alias-bg-layer-2, #fff); color: var(--dsw-alias-label-primary, #111827);
  box-shadow: var(--dsw-shadow-lv2, 0 24px 60px rgba(15, 23, 42, .28)); }
.dsu-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.2)); }
.dsu-title { margin: 0; font-size: 15px; font-weight: 600; }
.dsu-subtitle { margin: 3px 0 0; font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); }
.dsu-close { width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #6b7280); font-size: 18px; line-height: 1; }
.dsu-close:hover { background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.18)); }
.dsu-body { padding: 14px 18px 18px; overflow: auto; display: flex; flex-direction: column; gap: 14px; }
.dsu-section { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.2)); border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.04)); padding: 12px 14px; }
.dsu-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.dsu-section-title { font-size: 13px; font-weight: 600; }
.dsu-muted { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.dsu-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsu-state { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.dsu-state[data-tone="ok"] { color: var(--dsw-alias-state-success-primary, #15803d); }
.dsu-state[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary, #b45309); }
.dsu-state[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #b91c1c); }
.dsu-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 12px;
  border-radius: var(--dsw-radius-md, 8px); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.36));
  background: transparent; color: var(--dsw-alias-label-primary, #111827); font: inherit; font-size: 12px;
  cursor: pointer; white-space: nowrap; }
.dsu-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.dsu-btn:disabled { opacity: .52; cursor: default; }
.dsu-btn[data-variant="primary"] { background: var(--dsw-alias-button-primary-fill, #2563eb);
  border-color: transparent; color: var(--dsw-alias-label-primary-foreground, #fff); }
.dsu-list { display: flex; flex-direction: column; gap: 6px; margin: 2px 0 0; padding: 0; list-style: none; }
.dsu-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 9px;
  border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.07)); }
.dsu-item-name { font-size: 12px; font-weight: 500; word-break: break-all; }
.dsu-item-ver { font-family: var(--dsw-font-mono, ui-monospace, Menlo, monospace); font-size: 11px;
  color: var(--dsw-alias-label-secondary, #6b7280); }
.dsu-chip { flex: none; font-size: 11px; padding: 1px 7px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.36)); color: var(--dsw-alias-label-secondary, #6b7280); }
.dsu-chip[data-status="done"] { color: var(--dsw-alias-state-success-primary, #15803d); border-color: currentColor; }
.dsu-chip[data-status="failed"] { color: var(--dsw-alias-state-error-primary, #b91c1c); border-color: currentColor; }
.dsu-chip[data-status="updating"] { color: var(--dsw-alias-brand-primary, #2563eb); border-color: currentColor; }
.dsu-progress { height: 4px; border-radius: 2px; background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.16));
  overflow: hidden; margin-top: 8px; }
.dsu-progress > span { display: block; height: 100%; background: var(--dsw-alias-brand-primary, #2563eb); }
.dsu-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
.dsu-hint { font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); }
.dsu-notice { margin-top: 10px; padding: 8px 10px; border-radius: var(--dsw-radius-md, 8px); font-size: 12px;
  background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,.1)); display: flex; align-items: center;
  justify-content: space-between; gap: 10px; }
.dsu-error { color: var(--dsw-alias-state-error-primary, #b91c1c); font-size: 11px; margin-top: 2px; }
`,
      )
    }

    function Icon(props) {
      const size = props?.size || 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M12 4v10' }),
        h('path', { d: 'M8 8l4-4 4 4' }),
        h('path', { d: 'M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3' }),
      )
    }

    function badgeCount(state) {
      const pending = (state.items || []).filter((item) => item.status !== 'done').length
      const phase = state.app?.updates?.phase
      const appPending = phase === 'available' || phase === 'ready' || phase === 'downloading' ? 1 : 0
      return pending + appPending
    }

    function formatTime(t, stamp) {
      if (!stamp) return t('pluginNever')
      const delta = Date.now() - stamp
      if (delta < 60000) return t('justNow')
      if (delta < 3600000) return t('minutesAgo', { n: Math.floor(delta / 60000) })
      if (delta < 86400000) return t('hoursAgo', { n: Math.floor(delta / 3600000) })
      return t('daysAgo', { n: Math.floor(delta / 86400000) })
    }

    let entryLabel = () => ZH.entry
    let settingsEntryLabel = () => ZH.settingsEntry

    /**
     * Sidebar glyph for the panel row. The shell owns the row box, label,
     * selection state and collapsed-rail behaviour; this only draws the
     * mark (`data-dsh-panel-entry` is the row-identity anchor the shell's
     * semantic contract asks for) plus the count dot.
     */
    function PanelGlyph(props) {
      const state = useSyncExternalStore(store.subscribe, store.get)
      const size = Number(props?.size) > 0 ? Number(props.size) : 16
      const count = badgeCount(state)
      return h(
        'svg',
        {
          className: 'dsu-glyph',
          'data-dsh-panel-entry': 'update-center',
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M8 2.6v6.2' }),
        h('path', { d: 'M5.4 5.2L8 2.6l2.6 2.6' }),
        h('path', { d: 'M3.4 10.2v2.2a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1v-2.2' }),
        count > 0
          ? h('circle', {
              cx: 12.6,
              cy: 3.4,
              r: 2.6,
              fill: 'var(--dsw-alias-state-error-primary, #dc2626)',
              stroke: 'none',
            })
          : null,
      )
    }

    /** The panel body: desktop-client section first, then profile plugins. */
    function UpdatePage(props) {
      const embedded = props?.embedded === true
      const state = useSyncExternalStore(store.subscribe, store.get)
      const dictionary = dict()
      const t = (key, vars) => substitute(dictionary[key] ?? EN[key] ?? key, vars)
      const items = state.items || []
      const pending = items.filter((item) => item.status !== 'done')
      const done = items.filter((item) => item.status === 'done')
      const busy = state.updating
      const app = state.app
      const updates = app?.updates
      const phase = updates?.phase || 'idle'

      useEffect(() => {
        refreshAll()
        if (!current().lastCheckedAt && !current().checking) checkPlugins()
      }, [])

      const appAction = (() => {
        if (state.appMissing) return null
        if (phase === 'ready') return { label: t('installApp'), run: () => desktopCommand('install-update') }
        if (phase === 'available') return { label: t('downloadApp'), run: () => desktopCommand('download-update') }
        if (phase === 'downloading' || phase === 'preparing' || phase === 'installing') return null
        if (phase === 'error' && updates?.version) {
          return { label: t('downloadApp'), run: () => desktopCommand('download-update') }
        }
        return { label: t('checkApp'), run: () => desktopCommand('check-updates') }
      })()

      const appText = (() => {
        if (state.appMissing) return t('appUnavailable')
        switch (phase) {
          case 'checking':
            return t('appChecking')
          case 'current':
            return t('appCurrent')
          case 'available':
            return `${t('appAvailable')} ${updates?.version || ''}`.trim()
          case 'downloading': {
            const total = updates?.total || 0
            const received = updates?.received || 0
            return total
              ? `${t('appDownloading')} ${Math.round((received / total) * 100)}%`
              : `${t('appDownloading')}…`
          }
          case 'preparing':
            return t('appPreparing')
          case 'ready':
            return t('appReady')
          case 'installing':
            return t('appInstalling')
          case 'error':
            if (updates?.error === 'development') return t('appDev')
            if (updates?.error === 'unsupported') return t('appUnsupported')
            if (updates?.error === 'service') return t('appService')
            return t('appFailed')
          default:
            return t('appIdle')
        }
      })()

      const tone =
        phase === 'available' || phase === 'ready'
          ? 'warn'
          : phase === 'error'
            ? 'error'
            : phase === 'current'
              ? 'ok'
              : undefined

      const percent =
        phase === 'downloading' && updates?.total
          ? Math.min(100, Math.round(((updates?.received || 0) / updates.total) * 100))
          : null

      const hours = Math.round(CHECK_INTERVAL_MS / 3600000)

      return h(
        'div',
        {
          className: embedded ? 'dsu-settings' : 'dsu-page',
          'data-dsh-plugin': 'update-center',
          'data-dsh-part': embedded ? 'settings-section' : 'page',
        },
        h(Styles),
        h(
          'div',
          { className: embedded ? 'dsu-settings-inner' : 'dsu-page-inner' },
          embedded
            ? h('p', { className: 'dsu-page-subtitle' }, t('subtitle'))
            : h('h1', { className: 'dsu-page-title' }, t('title')),
          embedded ? null : h('p', { className: 'dsu-page-subtitle' }, t('subtitle')),
          // ---- desktop client ----
          h(
            'section',
            { className: 'dsu-section' },
            h(
              'div',
              { className: 'dsu-section-head' },
              h('span', { className: 'dsu-section-title' }, t('appSection')),
              app?.version ? h('span', { className: 'dsu-muted' }, `${t('appInstalled')} ${app.version}`) : null,
            ),
            h(
              'div',
              { className: 'dsu-row' },
              h('span', { className: 'dsu-state', 'data-tone': tone }, appText),
              appAction
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsu-btn',
                      'data-variant': phase === 'ready' || phase === 'available' ? 'primary' : undefined,
                      disabled: phase === 'checking' || phase === 'downloading' || phase === 'preparing',
                      onClick: appAction.run,
                    },
                    appAction.label,
                  )
                : null,
            ),
            percent === null
              ? null
              : h('div', { className: 'dsu-progress' }, h('span', { style: { width: percent + '%' } })),
          ),
          // ---- plugins ----
          h(
            'section',
            { className: 'dsu-section' },
            h(
              'div',
              { className: 'dsu-section-head' },
              h(
                'span',
                { className: 'dsu-section-title' },
                `${t('pluginSection')}${pending.length ? ` · ${pending.length} ${t('pluginAvailable')}` : ''}`,
              ),
              h('span', { className: 'dsu-muted' }, `${t('pluginLastChecked')} ${formatTime(t, state.lastCheckedAt)}`),
            ),
            !pluginManager && !state.checking
              ? h('p', { className: 'dsu-error' }, t('hostUnavailable'))
              : state.checking
                ? h('p', { className: 'dsu-muted' }, t('pluginChecking'))
                : items.length === 0
                  ? h('p', { className: 'dsu-muted' }, t('pluginEmpty'))
                  : h(
                      'ul',
                      { className: 'dsu-list' },
                      items.map((item) =>
                        h(
                          'li',
                          { key: item.name, className: 'dsu-item' },
                          h(
                            'div',
                            { style: { minWidth: 0 } },
                            h('div', { className: 'dsu-item-name' }, item.name),
                            h(
                              'div',
                              { className: 'dsu-item-ver' },
                              `${item.installed} → ${item.latest}${item.engines ? ` · dsh ${item.engines}` : ''}`,
                            ),
                            item.error
                              ? h(
                                  'div',
                                  { className: 'dsu-error' },
                                  `${item.error}${item.rolledBack ? ` (${t('pluginRolledBack')})` : ''}`,
                                )
                              : null,
                          ),
                          h(
                            'span',
                            { className: 'dsu-chip', 'data-status': item.status },
                            item.status === 'done'
                              ? t('pluginDone')
                              : item.status === 'updating'
                                ? t('pluginUpdating')
                                : item.status === 'failed'
                                  ? t('pluginFailed')
                                  : t('pluginPending'),
                          ),
                        ),
                      ),
                    ),
            state.updating
              ? h(
                  'div',
                  null,
                  h(
                    'div',
                    { className: 'dsu-hint', style: { marginTop: 8 } },
                    `${t('updatingOne')} ${state.progress.current || ''}（${state.progress.done} ${t('of')} ${state.progress.total}）`,
                  ),
                  h(
                    'div',
                    { className: 'dsu-progress' },
                    h('span', {
                      style: {
                        width:
                          (state.progress.total ? Math.round((state.progress.done / state.progress.total) * 100) : 6) +
                          '%',
                      },
                    }),
                  ),
                )
              : null,
            h(
              'div',
              { className: 'dsu-actions' },
              h('span', { className: 'dsu-hint' }, `${t('autoHint')} · ${t('everyHours', { n: hours })}`),
              h(
                'div',
                { style: { display: 'flex', gap: 8 } },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsu-btn',
                    disabled: state.checking || busy || !pluginManager,
                    onClick: () => checkPlugins(),
                  },
                  t('pluginRefresh'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsu-btn',
                    'data-variant': 'primary',
                    disabled: busy || !pending.length || !pluginManager,
                    onClick: () => updateItems(),
                  },
                  busy ? t('updating') : `${t('updateAll')}${pending.length ? ` (${pending.length})` : ''}`,
                ),
              ),
            ),
            done.length && !busy
              ? h(
                  'div',
                  { className: 'dsu-notice' },
                  h('span', null, t('restartHint', { n: done.length })),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsu-btn',
                      'data-variant': 'primary',
                      onClick: () => desktopCommand('restart-app'),
                    },
                    t('restartNow'),
                  ),
                )
              : null,
          ),
        ),
      )
    }

    /** Settings-panel section: the same body, embedded in the shell's content column. */
    function SettingsSection() {
      return h(UpdatePage, { embedded: true })
    }

    // ------------------------------------------------------------------
    // plugin
    // ------------------------------------------------------------------

    return {
      inject: ['slots', 'remote', 'layout'],
      apply(ctx) {
        disposed = false
        clearTimeout(timer)

        try {
          pluginManager = ctx.remote?.pluginManager || null
        } catch {
          pluginManager = null
        }
        patch({ pluginManager: Boolean(pluginManager) })

        // The generated Remote namespace is resolved through a scoped
        // injection, exactly as the shipped panel plugins do it.
        try {
          ctx.inject(['remote.pluginManager'], (inner) => {
            const face = inner.remote?.pluginManager
            if (!face) return
            pluginManager = face
            patch({ pluginManager: true })
            if (!current().lastCheckedAt && !current().checking) checkPlugins()
          })
        } catch (error) {
        }

        try {
          layoutService = ctx.layout || ctx.get?.('layout') || null
        } catch {
          layoutService = null
        }

        try {
          ctxServices.registryProbe = async () => {
            const probe = ctx.remote?.pluginRegistryProbe
            return probe && typeof probe.fastest === 'function' ? await probe.fastest() : null
          }
        } catch {
          ctxServices.registryProbe = null
        }

        const locale = ctx.get?.('locale')
        const disposers = []
        let translate = null
        if (locale) {
          try {
            disposers.push(locale.register(NS, 'zh', ZH))
            disposers.push(locale.register(NS, 'en', EN))
          } catch {
            /* a duplicate namespace keeps the local dictionaries */
          }
          try {
            translate = locale.bind(NS)
            activeLanguage = () => locale.getLocale?.()?.active || ''
          } catch {
            translate = null
          }
        }

        settingsEntryLabel = () => {
          try {
            const value = translate?.('settingsEntry')
            if (value && value !== 'settingsEntry') return value
          } catch {
            /* fall through to the local dictionary */
          }
          return dict().settingsEntry
        }

        entryLabel = () => {
          try {
            const value = translate?.('entry')
            if (value && value !== 'entry') return value
          } catch {
            /* fall through to the local dictionary */
          }
          return dict().entry
        }

        const subscriptions = [
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              { name: 'settings.section', id: 'update-center', order: 90, label: settingsEntryLabel },
              SettingsSection,
            ),
          ),
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              { name: 'sidebar.panellist', id: 'update-center', order: 30, label: entryLabel },
              PanelGlyph,
            ),
          ),
          ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: 'update-center' }, UpdatePage),
          ),
        ]

        ctx.effect(() => {
          refreshApp()
          const repeating = setInterval(() => {
            if (disposed) return
            if ((current().items || []).length) return
            if (pluginManager && !current().checking) checkPlugins()
          }, CHECK_INTERVAL_MS)
          schedule()
          return () => {
            disposed = true
            clearTimeout(timer)
            clearInterval(repeating)
            for (const dispose of [...subscriptions, ...disposers]) {
              try {
                dispose()
              } catch {
                /* already gone */
              }
            }
          }
        }, 'update-center: check schedule')
      },
    }
  },
})







