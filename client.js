/**
 * Client half of the page-context plugin.
 *
 * Registers a right-Sidebar tab type ("page-context"), its body and a composer
 * tool-row button. The body loads pages through the Host's same-origin proxy so
 * it can read the frame's DOM: hovering highlights an element and clicking it
 * writes a compact context line into the current Session's composer through the
 * standard `inputActions` prop.
 */

window.__ModuleLoader__.load({
  id: 'dsh-page-context',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const PLUGIN_ID = 'dsh-page-context'
    const KIND = 'page-context'
    const NS = 'pageContext'
    const PROXY_PATH = '/page-context/proxy'

    const DICTS = {
      en: {
        tabTitle: 'Page context',
        guideTitle: 'Page context',
        guideDescription: 'Open a page and pick its elements into the message',
        open: 'Open the page context browser',
        back: 'Back',
        forward: 'Forward',
        reload: 'Reload',
        urlPlaceholder: 'Enter a page URL (https://…)',
        pickStart: 'Select element',
        pickStop: 'Stop selecting',
        pickHint: 'Hover a page element, then click it to add it to the message.',
        chipLabel: '[Page element]',
        inserted: 'Element added to the message.',
        insertFailed: 'The input changed before the element could be added. Retry.',
        composerMissing: 'The message input is not available in this session.',
        retryInsert: 'Insert again',
        loading: 'Loading page…',
        truncated: 'The page was truncated before preview.',
        frameBlocked: 'This page could not be read. Open it again.',
        webOnly: 'The page browser needs the Web GUI or the Desktop app; it cannot read pages in a file:// shell.',
        staticFallback: 'The embedded browser is unavailable; showing a static preview without page scripts.',
        guestFailed: 'The embedded browser could not open this page.',
        emptyTitle: 'Page context browser',
        emptyBody: 'Open a page, then pick the elements you want the agent to know about.',
        emptyHint: 'On Desktop the page renders in an embedded browser, with its scripts running.',
        frameTitle: 'Page preview',
        recent: 'Added:',
        urlRequired: 'Enter a page URL.',
        urlInvalid: 'That is not a valid URL.',
        urlScheme: 'Only http and https pages can be opened.',
      },
      zh: {
        tabTitle: '页面上下文',
        guideTitle: '页面上下文',
        guideDescription: '打开网页并选取元素加入消息',
        open: '打开页面上下文浏览器',
        back: '后退',
        forward: '前进',
        reload: '刷新',
        urlPlaceholder: '输入网页地址（https://…）',
        pickStart: '选择元素',
        pickStop: '退出选择',
        pickHint: '悬停页面元素后点击，即可加入消息。',
        chipLabel: '【页面元素】',
        inserted: '已插入输入框。',
        insertFailed: '输入框已变化，请重试插入。',
        composerMissing: '当前会话的输入框不可用。',
        retryInsert: '再次插入',
        loading: '正在加载页面…',
        truncated: '页面内容已截断。',
        frameBlocked: '无法读取该页面，请重新打开。',
        webOnly: '页面浏览器需要 Web 或桌面端环境；无法在 file:// 外壳中使用。',
        staticFallback: '桌面内嵌浏览器不可用，已切换为静态预览（页面脚本不执行）。',
        guestFailed: '内嵌浏览器无法打开该页面。',
        emptyTitle: '页面上下文浏览器',
        emptyBody: '打开网页，然后选取希望智能体了解的元素。',
        emptyHint: '桌面端在真实浏览器内核中渲染页面，脚本正常执行。',
        frameTitle: '网页预览',
        recent: '已插入：',
        urlRequired: '请输入网页地址。',
        urlInvalid: '网址格式不正确。',
        urlScheme: '只支持 http/https 网页。',
      },
    }

    const CSS = [
      '.dsh-pc-open{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsh-pc-open:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsh-pc-open:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsh-pc-panel{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.5}',
      '.dsh-pc-toolbar{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto}',
      '.dsh-pc-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:0 0 auto}',
      '.dsh-pc-icon:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsh-pc-icon:disabled{opacity:.4;cursor:default}',
      '.dsh-pc-address{flex:1 1 auto;min-width:0;display:flex}',
      '.dsh-pc-address input{width:100%;min-width:0;height:24px;box-sizing:border-box;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font:inherit;outline:none}',
      '.dsh-pc-address input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dsh-pc-pick{flex:0 0 auto;height:24px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;white-space:nowrap}',
      '.dsh-pc-pick:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsh-pc-pick.is-active{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff}',
      '.dsh-pc-pick:disabled{opacity:.4;cursor:default}',
      '.dsh-pc-status{padding:4px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11px;flex:0 0 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh-pc-status[data-kind="error"]{color:var(--dsw-alias-state-error-primary)}',
      '.dsh-pc-status[data-kind="ok"]{color:var(--dsw-alias-state-success-primary)}',
      '.dsh-pc-status-protocol{margin-left:6px;padding:0 4px;font-size:10px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);border-radius:3px}',
      '.dsh-pc-frame{flex:1 1 auto;width:100%;min-height:0;border:0;background:#fff}',
      '.dsh-pc-guest{position:relative;display:flex;flex:1 1 auto;min-height:0;background:var(--dsw-alias-bg-base)}',
      '.dsh-pc-webview{display:flex;flex:1 1 auto;width:100%;height:100%;min-height:0;border:0;background:var(--dsw-alias-bg-base)}',
      '.dsh-pc-empty{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px;text-align:center;color:var(--dsw-alias-label-secondary)}',
      '.dsh-pc-empty-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dsh-pc-empty-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-pc-hint{position:absolute;left:8px;right:8px;bottom:8px;display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay);box-shadow:0 4px 12px rgba(0,0,0,.12);pointer-events:none}',
      '.dsh-pc-hint-label{color:var(--dsw-alias-label-secondary);font-size:11px;flex:0 0 auto}',
      '.dsh-pc-hint-code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-brand-primary)}',
      '.dsh-pc-recent{display:flex;align-items:center;gap:6px;padding:5px 8px;border-top:1px solid var(--dsw-alias-border-l1);overflow:hidden;flex:0 0 auto}',
      '.dsh-pc-recent-label{color:var(--dsw-alias-label-tertiary);font-size:11px;flex:0 0 auto}',
      '.dsh-pc-chip{max-width:120px;padding:1px 7px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh-pc-retry{position:absolute;right:8px;bottom:8px;height:24px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}',
    ].join('')

    const RUNTIME_CSS = [
      '.dsh-pc-hover{outline:2px solid #4f8cff !important;outline-offset:1px !important;',
      'background-color:rgba(79,140,255,.10) !important}',
      'body.dsh-pc-picking,body.dsh-pc-picking *{cursor:crosshair !important}',
    ].join('')

    const ICONS = {
      back: 'M9.5 3.5 5 8l4.5 4.5',
      forward: 'M6.5 3.5 11 8l-4.5 4.5',
      reload: 'M13 8a5 5 0 1 1-1.7-3.7M13 3.2V6h-2.8',
    }

    let translate = null
    let localeVersion = 0
    const localeListeners = new Set()

    function notifyLocale() {
      localeVersion += 1
      for (const listener of Array.from(localeListeners)) {
        try {
          listener()
        } catch {
          // A broken subscriber must not stop the rest.
        }
      }
    }

    function subscribeLocale(listener) {
      localeListeners.add(listener)
      return () => {
        localeListeners.delete(listener)
      }
    }

    function detectedLocale() {
      const language = typeof navigator !== 'undefined' ? String(navigator.language || '') : ''
      return /^zh/i.test(language) ? 'zh' : 'en'
    }

    function t(key) {
      if (typeof translate === 'function') {
        try {
          const value = translate(key)
          if (typeof value === 'string' && value.length > 0 && value !== key) return value
        } catch {
          // Fall back to the bundled dictionary.
        }
      }
      return DICTS[detectedLocale()][key] ?? DICTS.en[key] ?? key
    }

    function useLocale() {
      React.useSyncExternalStore(subscribeLocale, () => localeVersion, () => localeVersion)
    }

    function normalizeText(text) {
      return String(text ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    function cssPath(element) {
      const parts = []
      let node = element
      let depth = 0
      while (node && node.nodeType === 1 && depth < 6) {
        if (node.id && /^[A-Za-z_][\w-]*$/.test(node.id)) {
          parts.unshift(`#${node.id}`)
          break
        }
        let part = String(node.tagName || '').toLowerCase()
        const testId = node.getAttribute('data-testid') || node.getAttribute('data-test')
        if (testId) {
          parts.unshift(`${part}[data-testid="${String(testId).replace(/"/g, '')}"]`)
          break
        }
        const classes = Array.from(node.classList || [])
          .filter((name) => /^[A-Za-z_-][\w-]*$/.test(name))
          .slice(0, 2)
        if (classes.length > 0) part += `.${classes.join('.')}`
        const parent = node.parentElement
        if (parent) {
          const sameTag = Array.from(parent.children).filter((child) => child.tagName === node.tagName)
          if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`
        }
        parts.unshift(part)
        node = node.parentElement
        depth += 1
      }
      return parts.join(' > ')
    }

    function normalizeInput(raw) {
      const text = String(raw ?? '').trim()
      if (!text) throw new Error(t('urlRequired'))
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text)
      const hostPort = /^[a-zA-Z0-9.-]+:\d+(?:[/?#]|$)/.test(text)
        || /^\[[0-9a-fA-F:.]+\](?::\d+)?(?:[/?#]|$)/.test(text)
      let candidate
      if (hasScheme) candidate = text
      else if (hostPort || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) {
        candidate = `${defaultScheme(hostOf(text))}//${text}`
      } else {
        candidate = text
      }
      let parsed
      try {
        parsed = new URL(candidate)
      } catch {
        throw new Error(t('urlInvalid'))
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(t('urlScheme'))
      return parsed.toString()
    }

    function hostOf(text) {
      const authority = text.split(/[/?#]/)[0]
      return authority.replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
    }

    function defaultScheme(host) {
      const name = String(host ?? '')
      if (!name) return 'https://'
      if (/^localhost$/i.test(name) || /\.localhost$/i.test(name)) return 'http://'
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(name)) return 'http://'
      if (/^[0-9a-fA-F:]*:[0-9a-fA-F:]*$/.test(name)) return 'http://'
      return 'https://'
    }

    /** Right-Sidebar controller; assigned when the plugin activates. */
    let controller = null

    function openPanel() {
      try {
        if (controller && typeof controller.openTab === 'function') {
          controller.openTab(KIND)
          return
        }
        console.error('[page-context] the right Sidebar controller is unavailable')
      } catch (error) {
        console.error('[page-context] could not open the page browser', error)
      }
    }

    /**
     * Desktop shell browser bridge. The official Browser tab uses the same
     * `dshDesktop` product API; absent in the Web GUI.
     */
    const DESKTOP_BUS = (() => {
      try {
        const carrier = typeof globalThis !== 'undefined' ? globalThis.dshDesktop : undefined
        return carrier && carrier.protocolVersion === 1 && carrier.browser
          && typeof carrier.browser.acquire === 'function'
          ? carrier.browser
          : null
      } catch {
        return null
      }
    })()

    /**
     * Runs inside the embedded page. Self-contained on purpose: it is
     * serialized with `Function.prototype.toString` and executed in the guest.
     */
    function pickerMain() {
      var MARK = '__dshPageContextPicker'
      var previous = window[MARK]
      if (previous && previous.stop) previous.stop()
      var state = { hover: null, hoverLabel: '', result: null, cancelled: false }

      function classesOf(element) {
        return Array.prototype.slice.call(element.classList || [])
          .filter(function (name) { return /^[A-Za-z_-][\w-]*$/.test(name) })
      }

      function labelOf(element) {
        var label = String(element.tagName || '').toLowerCase()
        if (element.id) label += '#' + element.id
        else {
          var classes = classesOf(element)
          if (classes.length) label += '.' + classes.slice(0, 2).join('.')
        }
        var text = String(element.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)
        return text ? label + ' · ' + text : label
      }

      function pathOf(element) {
        var parts = []
        var node = element
        var depth = 0
        while (node && node.nodeType === 1 && depth < 6) {
          if (node.id && /^[A-Za-z_][\w-]*$/.test(node.id)) {
            parts.unshift('#' + node.id)
            break
          }
          var part = String(node.tagName || '').toLowerCase()
          var classes = classesOf(node)
          if (classes.length) part += '.' + classes.slice(0, 2).join('.')
          var parent = node.parentElement
          if (parent) {
            var same = Array.prototype.filter.call(parent.children, function (child) {
              return child.tagName === node.tagName
            })
            if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')'
          }
          parts.unshift(part)
          node = node.parentElement
          depth += 1
        }
        return parts.join(' > ')
      }

      function describe(element) {
        return {
          url: location.href,
          title: String(document.title || '').slice(0, 80),
          selector: pathOf(element),
          tag: String(element.tagName || '').toLowerCase(),
          text: String(element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
          html: String(element.outerHTML || '').replace(/\s+/g, ' ').trim().slice(0, 500),
        }
      }

      function clearHover() {
        var hover = state.hover
        if (hover && hover.style) {
          hover.style.removeProperty('outline')
          hover.style.removeProperty('outline-offset')
          hover.style.removeProperty('background-color')
        }
        state.hover = null
      }

      function onMove(event) {
        var element = event.target
        if (!element || element.nodeType !== 1 || element === state.hover) return
        clearHover()
        state.hover = element
        try {
          element.style.setProperty('outline', '2px solid #4f8cff', 'important')
          element.style.setProperty('outline-offset', '1px', 'important')
          element.style.setProperty('background-color', 'rgba(79,140,255,0.10)', 'important')
        } catch (error) {}
        state.hoverLabel = labelOf(element)
      }

      function finish() {
        document.removeEventListener('mousemove', onMove, true)
        document.removeEventListener('click', onClick, true)
        document.removeEventListener('keydown', onKey, true)
        clearHover()
        try { document.documentElement.style.cursor = '' } catch (error) {}
      }

      function onClick(event) {
        var element = event.target
        if (!element || element.nodeType !== 1) return
        event.preventDefault()
        event.stopPropagation()
        if (event.stopImmediatePropagation) event.stopImmediatePropagation()
        state.result = describe(element)
        finish()
      }

      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          state.cancelled = true
          finish()
        }
      }

      function stop() {
        state.cancelled = true
        finish()
      }

      try { document.documentElement.style.cursor = 'crosshair' } catch (error) {}
      document.addEventListener('mousemove', onMove, true)
      document.addEventListener('click', onClick, true)
      document.addEventListener('keydown', onKey, true)
      window[MARK] = { state: state, stop: stop }
      return 'ok'
    }

    /**
     * Polled inside the embedded page. Self-contained, see {@link pickerMain}.
     */
    function pickerPoll() {
      var picker = window.__dshPageContextPicker
      if (!picker || !picker.state) return null
      var state = picker.state
      if (state.result) return { picked: state.result }
      if (state.cancelled) return { cancelled: true }
      return { hoverLabel: state.hoverLabel || '' }
    }

    const PICKER_INSTALL = '(' + pickerMain.toString() + ')()'
    const PICKER_POLL = '(' + pickerPoll.toString() + ')()'

    /**
     * Embedded Chromium guest for one panel occurrence. Owns the shell lease,
     * navigation, the injected picker and the rendered-DOM snapshot.
     */
    const WebviewStage = React.forwardRef(function WebviewStage(props, ref) {
      const containerRef = React.useRef(null)
      const elementRef = React.useRef(null)
      const readyRef = React.useRef(false)
      const pendingRef = React.useRef('')
      const pollingRef = React.useRef(false)
      const pickTimerRef = React.useRef(0)
      const propsRef = React.useRef(props)
      propsRef.current = props

      function notify(name, value) {
        const listener = propsRef.current ? propsRef.current[name] : undefined
        if (typeof listener === 'function') listener(value)
      }

      function exec(code) {
        const element = elementRef.current
        if (!element || !readyRef.current) return Promise.resolve(undefined)
        try {
          return Promise.resolve(element.executeJavaScript(code))
        } catch (error) {
          return Promise.reject(error)
        }
      }

      function schedulePick(delay) {
        clearTimeout(pickTimerRef.current)
        pickTimerRef.current = setTimeout(pollPick, delay)
      }

      function pollPick() {
        if (!pollingRef.current) return
        exec(PICKER_POLL).then((state) => {
          if (!pollingRef.current) return
          if (state && state.picked) {
            pollingRef.current = false
            notify('onPick', state.picked)
            return
          }
          if (state && state.cancelled) {
            pollingRef.current = false
            notify('onCancel')
            return
          }
          if (state) notify('onHover', state.hoverLabel || '')
          schedulePick(140)
        }).catch(() => schedulePick(320))
      }

      function startPick() {
        if (!readyRef.current) return
        exec(PICKER_INSTALL).catch(() => {})
        pollingRef.current = true
        schedulePick(140)
      }

      function stopPick() {
        pollingRef.current = false
        clearTimeout(pickTimerRef.current)
        exec('window.__dshPageContextPicker && window.__dshPageContextPicker.stop()').catch(() => {})
        notify('onHover', '')
      }

      function snapshot() {
        const element = elementRef.current
        if (!element || !readyRef.current) return
        let url = ''
        try { url = element.getURL() } catch (error) { return }
        if (!url || url.indexOf('about:') === 0) return
        exec('document.documentElement.outerHTML').then((html) => {
          if (typeof html !== 'string' || html.length === 0) return
          const limit = 1500000
          const capped = html.length > limit ? html.slice(0, limit) : html
          return fetch('/page-context/snapshot', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: url, html: capped, truncated: html.length > limit }),
          })
        }).catch(() => {})
      }

      React.useImperativeHandle(ref, () => ({
        load(url) {
          if (!url) return
          if (!readyRef.current) {
            pendingRef.current = url
            return
          }
          try {
            const loading = elementRef.current.loadURL(url)
            if (loading && typeof loading.catch === 'function') loading.catch(() => {})
          } catch (error) {
            console.error('[page-context] could not load the address', error)
            notify('onFallback', error)
          }
        },
        back() {
          try { elementRef.current.goBack() } catch (error) { /* no history yet */ }
        },
        forward() {
          try { elementRef.current.goForward() } catch (error) { /* no history yet */ }
        },
        reload() {
          try { elementRef.current.reload() } catch (error) { /* not ready */ }
        },
        snapshot() {
          snapshot()
        },
      }), [])

      React.useEffect(() => {
        if (props.picking) startPick()
        else stopPick()
      }, [props.picking])

      React.useEffect(() => {
        const host = containerRef.current
        const bridge = DESKTOP_BUS
        if (!host || !bridge) {
          notify('onFallback', new Error('the desktop browser bridge is unavailable'))
          return undefined
        }
        let cancelled = false
        let element = null
        let lease = ''
        let readyTimeout = 0
        let snapshotTimer = 0

        function safeUrl() {
          try { return elementRef.current ? elementRef.current.getURL() : '' } catch (error) { return '' }
        }

        function readState() {
          const target = elementRef.current
          const state = { ready: readyRef.current, loading: false, title: '', url: safeUrl(), canBack: false, canForward: false }
          if (!target) return state
          try { state.loading = target.isLoading() } catch (error) {}
          try { state.title = target.getTitle() } catch (error) {}
          try { state.canBack = target.canGoBack() } catch (error) {}
          try { state.canForward = target.canGoForward() } catch (error) {}
          return state
        }

        function scheduleSnapshot(delay) {
          clearTimeout(snapshotTimer)
          snapshotTimer = setTimeout(() => { snapshot() }, delay)
        }

        function onReady() {
          readyRef.current = true
          clearTimeout(readyTimeout)
          notify('onState', readState())
          const next = pendingRef.current || (propsRef.current ? propsRef.current.initialUrl : '')
          pendingRef.current = ''
          if (next && element) {
            try {
              const loading = element.loadURL(next)
              if (loading && typeof loading.catch === 'function') loading.catch(() => {})
            } catch (error) {
              notify('onFallback', error)
            }
          }
        }

        function onStartLoading() {
          notify('onState', { loading: true })
        }

        function onStopLoading() {
          notify('onState', readState())
          scheduleSnapshot(1200)
          setTimeout(() => { snapshot() }, 4000)
        }

        function onNavigated() {
          const state = readState()
          notify('onState', state)
          notify('onNavigate', state.url)
          if (propsRef.current && propsRef.current.picking) {
            stopPick()
            startPick()
          }
        }

        function onNavigatedInPage(event) {
          if (event && event.isMainFrame === false) return
          onNavigated()
        }

        function onFailLoad(event) {
          if (!event || event.isMainFrame === false || event.errorCode === -3) return
          notify('onState', { loading: false, error: String(event.errorDescription || 'load failed') })
        }

        function onGone() {
          notify('onFallback', new Error('the embedded browser closed'))
        }

        async function start() {
          try {
            const sessionId = propsRef.current ? propsRef.current.sessionId : ''
            const reservation = await bridge.acquire('session:' + String(sessionId || 'page-context'))
            if (cancelled) {
              bridge.release(reservation.lease).catch(() => {})
              return
            }
            lease = reservation.lease
            element = document.createElement('webview')
            element.className = 'dsh-pc-webview'
            element.setAttribute('name', reservation.lease)
            element.setAttribute('partition', reservation.partition)
            element.setAttribute('allowpopups', '')
            element.setAttribute('src', 'about:blank#' + reservation.lease)
            element.addEventListener('dom-ready', onReady)
            element.addEventListener('did-start-loading', onStartLoading)
            element.addEventListener('did-stop-loading', onStopLoading)
            element.addEventListener('did-navigate', onNavigated)
            element.addEventListener('did-navigate-in-page', onNavigatedInPage)
            element.addEventListener('did-fail-load', onFailLoad)
            element.addEventListener('render-process-gone', onGone)
            element.addEventListener('destroyed', onGone)
            elementRef.current = element
            host.appendChild(element)
            readyTimeout = setTimeout(() => {
              if (!readyRef.current) notify('onFallback', new Error('the embedded browser did not start'))
            }, 10000)
          } catch (error) {
            if (!cancelled) notify('onFallback', error)
          }
        }

        start()

        return () => {
          cancelled = true
          clearTimeout(readyTimeout)
          clearTimeout(snapshotTimer)
          pollingRef.current = false
          clearTimeout(pickTimerRef.current)
          const current = elementRef.current
          elementRef.current = null
          readyRef.current = false
          if (current) {
            try { current.remove() } catch (error) {}
          }
          if (element) {
            try { element.remove() } catch (error) {}
          }
          if (lease) bridge.release(lease).catch(() => {})
        }
      }, [])

      return h('div', { className: 'dsh-pc-guest', ref: containerRef })
    })

    function PageContextBody(props) {
      useLocale()
      const inputActions = props ? props.inputActions : undefined

      const [address, setAddress] = React.useState('')
      const [target, setTarget] = React.useState('')
      const [nonce, setNonce] = React.useState(0)
      const [nav, setNav] = React.useState({ list: [], index: -1 })
      const [picking, setPicking] = React.useState(false)
      const [status, setStatus] = React.useState({ kind: 'idle', text: '' })
      const [hoverLabel, setHoverLabel] = React.useState('')
      const [picked, setPicked] = React.useState([])
      const [pending, setPending] = React.useState(null)
      const [mode, setMode] = React.useState(DESKTOP_BUS ? 'webview' : 'iframe')
      const [guest, setGuest] = React.useState({ ready: false, loading: false, canBack: false, canForward: false })
      const stageRef = React.useRef(null)

      const frameRef = React.useRef(null)
      const frameDocRef = React.useRef(null)
      const detachRef = React.useRef(null)
      const linksRef = React.useRef(null)
      const pickRef = React.useRef(false)
      const hoverRef = React.useRef(null)
      const rafRef = React.useRef(0)
      const urlRef = React.useRef('')

      const protocol = typeof location !== 'undefined' ? String(location.protocol || '').toLowerCase() : ''
      const pageTransport = protocol === 'http:' || protocol === 'https:' || protocol === 'dsh-app:'

      React.useEffect(() => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        if (detachRef.current) detachRef.current()
        if (linksRef.current) linksRef.current()
      }, [])

      React.useEffect(() => {
        if (!picking) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            stopPicking()
          }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [picking])

      function setPickState(next) {
        pickRef.current = next
        setPicking(next)
        if (next) return
        setHoverLabel('')
        if (detachRef.current) {
          const detach = detachRef.current
          detachRef.current = null
          detach()
        }
      }

      function stopPicking() {
        setPickState(false)
      }

      function togglePick() {
        if (pickRef.current) {
          stopPicking()
          return
        }
        if (mode === 'webview') {
          if (!guest.ready || !stageRef.current) return
          setPickState(true)
          return
        }
        if (!frameDocRef.current) {
          setStatus({ kind: 'error', text: t('frameBlocked') })
          return
        }
        setPickState(true)
        attachPicker(frameDocRef.current)
      }

      function onGuestState(next) {
        if (!next) return
        if (next.error) setStatus({ kind: 'error', text: String(next.error) })
        else if (next.loading) setStatus({ kind: 'loading', text: t('loading') })
        else if (next.loading === false) setStatus({ kind: 'idle', text: '' })
        setGuest((previous) => ({ ...previous, ...next }))
      }

      function onGuestNavigate(url) {
        if (!url || url.indexOf('about:') === 0) return
        setAddress(url)
        urlRef.current = url
        setStatus({ kind: 'idle', text: '' })
      }

      function onGuestPick(payload) {
        setPickState(false)
        insertPayload(payload)
        if (stageRef.current) stageRef.current.snapshot()
      }

      function onGuestFallback(error) {
        console.error('[page-context] embedded browser unavailable', error)
        setMode('iframe')
        setStatus({ kind: 'error', text: t('staticFallback') })
        if (address) {
          setTarget(address)
          setNonce((value) => value + 1)
        }
      }

      function attachPicker(doc) {
        if (detachRef.current) {
          const previous = detachRef.current
          detachRef.current = null
          previous()
        }
        if (!doc) return
        const hoverClass = 'dsh-pc-hover'
        let style = doc.getElementById('dsh-pc-runtime-style')
        if (!style) {
          style = doc.createElement('style')
          style.id = 'dsh-pc-runtime-style'
          style.textContent = RUNTIME_CSS
          const parent = doc.head || doc.documentElement
          if (parent) parent.appendChild(style)
        }
        if (doc.body && doc.body.classList) doc.body.classList.add('dsh-pc-picking')

        const setHovered = (element) => {
          if (hoverRef.current === element) return
          if (hoverRef.current && hoverRef.current.classList) hoverRef.current.classList.remove(hoverClass)
          hoverRef.current = element || null
          if (element && element.classList) element.classList.add(hoverClass)
          const label = element ? describeLabel(element) : ''
          setHoverLabel((previous) => (previous === label ? previous : label))
        }

        const onMove = (event) => {
          if (rafRef.current) return
          const candidate = event.target
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0
            if (!pickRef.current) return
            setHovered(candidate && candidate.nodeType === 1 ? candidate : null)
          })
        }

        const onClick = (event) => {
          if (!pickRef.current) {
            const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null
            if (anchor && anchor.href) {
              event.preventDefault()
              event.stopPropagation()
              navigate(anchor.href)
            }
            return
          }
          event.preventDefault()
          event.stopPropagation()
          const element = event.target
          if (!element || element.nodeType !== 1) return
          const payload = describeElement(element, doc)
          setHovered(null)
          stopPicking()
          insertPayload(payload)
        }

        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            stopPicking()
          }
        }

        doc.addEventListener('mousemove', onMove, true)
        doc.addEventListener('click', onClick, true)
        doc.addEventListener('keydown', onKey, true)

        detachRef.current = () => {
          doc.removeEventListener('mousemove', onMove, true)
          doc.removeEventListener('click', onClick, true)
          doc.removeEventListener('keydown', onKey, true)
          if (hoverRef.current && hoverRef.current.classList) hoverRef.current.classList.remove(hoverClass)
          hoverRef.current = null
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = 0
          }
          if (doc.body && doc.body.classList) doc.body.classList.remove('dsh-pc-picking')
          if (style && style.parentNode) style.parentNode.removeChild(style)
        }
      }

      function describeLabel(element) {
        let label = String(element.tagName || '').toLowerCase()
        if (element.id) label += `#${element.id}`
        else if (element.classList && element.classList.length > 0) {
          label += `.${Array.from(element.classList).slice(0, 2).join('.')}`
        }
        const text = normalizeText(element.innerText || '').slice(0, 40)
        return text ? `${label} · ${text}` : label
      }

      function describeElement(element, doc) {
        const attrs = {}
        for (const name of ['id', 'role', 'name', 'type', 'href', 'src', 'alt', 'placeholder', 'aria-label', 'title']) {
          const value = element.getAttribute(name)
          if (value) attrs[name] = value.slice(0, 200)
        }
        return {
          url: urlRef.current,
          title: String(doc.title || '').slice(0, 80),
          selector: cssPath(element),
          tag: String(element.tagName || '').toLowerCase(),
          text: normalizeText(element.innerText || element.textContent || '').slice(0, 300)
            || attrs['aria-label'] || attrs.alt || attrs.placeholder || '',
          html: normalizeText(element.outerHTML || '').slice(0, 500),
        }
      }

      function formatPayload(payload) {
        const parts = [`${t('chipLabel')} ${payload.url || ''}`, `selector=${payload.selector}`]
        if (payload.tag) parts.push(`tag=${payload.tag}`)
        if (payload.text) parts.push(`text=${normalizeText(payload.text).slice(0, 300)}`)
        if (payload.title) parts.push(`page=${payload.title}`)
        return `${parts.join(' | ')}\n`
      }

      async function insertPayload(payload) {
        if (!inputActions || typeof inputActions.insertText !== 'function') {
          setPending(payload)
          setStatus({ kind: 'error', text: t('composerMissing') })
          return
        }
        let span
        try {
          span = typeof inputActions.captureInsertion === 'function'
            ? inputActions.captureInsertion()
            : undefined
        } catch {
          span = undefined
        }
        try {
          const result = await inputActions.insertText(formatPayload(payload), span)
          if (result === false || (result && result.ok === false)) throw new Error('insert rejected')
          setPending(null)
          setPicked((previous) => [payload, ...previous].slice(0, 5))
          setStatus({ kind: 'ok', text: t('inserted') })
        } catch {
          setPending(payload)
          setStatus({ kind: 'error', text: t('insertFailed') })
        }
      }

      function navigate(raw) {
        let next
        try {
          next = normalizeInput(raw)
        } catch (error) {
          setStatus({ kind: 'error', text: String(error && error.message ? error.message : error) })
          return
        }
        setAddress(next)
        if (pickRef.current) stopPicking()
        setStatus({ kind: 'loading', text: t('loading') })
        if (mode === 'webview') {
          if (stageRef.current) stageRef.current.load(next)
          else setTarget(next)
          return
        }
        setTarget(next)
        setNonce((value) => value + 1)
        setNav((previous) => {
          const list = previous.list.slice(0, previous.index + 1)
          list.push(next)
          return { list, index: list.length - 1 }
        })
        urlRef.current = next
        frameDocRef.current = null
      }

      function go(delta) {
        if (mode === 'webview') {
          if (!stageRef.current) return
          if (delta < 0) stageRef.current.back()
          else stageRef.current.forward()
          return
        }
        const index = nav.index + delta
        if (index < 0 || index >= nav.list.length) return
        const next = nav.list[index]
        setNav({ list: nav.list, index })
        setTarget(next)
        setAddress(next)
        setNonce((value) => value + 1)
        urlRef.current = next
        frameDocRef.current = null
        if (pickRef.current) stopPicking()
        setStatus({ kind: 'loading', text: t('loading') })
      }

      function attachLinks(doc) {
        if (!doc) return null
        const onClick = (event) => {
          if (pickRef.current) return
          const target = event.target
          const anchor = target && target.closest ? target.closest('a[href]') : null
          if (!anchor || !anchor.href) return
          event.preventDefault()
          event.stopPropagation()
          navigate(anchor.href)
        }
        doc.addEventListener('click', onClick, true)
        return () => doc.removeEventListener('click', onClick, true)
      }

      function onFrameLoad() {
        const frame = frameRef.current
        if (!frame) return
        let doc = null
        try {
          doc = frame.contentDocument
        } catch {
          doc = null
        }
        if (!doc || !doc.documentElement) {
          frameDocRef.current = null
          setStatus({ kind: 'error', text: t('frameBlocked') })
          return
        }
        if (linksRef.current) {
          const detachLink = linksRef.current
          linksRef.current = null
          detachLink()
        }
        frameDocRef.current = doc
        linksRef.current = attachLinks(doc)
        let truncated = null
        try {
          truncated = doc.querySelector('meta[name="dsh-page-context-truncated"]')
        } catch {
          truncated = null
        }
        setStatus({ kind: 'idle', text: truncated ? t('truncated') : '' })
        if (pickRef.current) attachPicker(doc)
      }

      function proxySrc() {
        return `${PROXY_PATH}?url=${encodeURIComponent(target)}&r=${nonce}`
      }

      function iconButton(name, label, disabled, onClick) {
        return h('button', {
          type: 'button',
          className: 'dsh-pc-icon',
          title: label,
          'aria-label': label,
          disabled,
          onClick,
        }, h('svg', {
          viewBox: '0 0 16 16',
          width: 14,
          height: 14,
          'aria-hidden': true,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }, h('path', { d: ICONS[name] })))
      }

      const canBack = mode === 'webview' ? Boolean(guest.canBack) : nav.index > 0
      const canForward = mode === 'webview' ? Boolean(guest.canForward) : (nav.index >= 0 && nav.index < nav.list.length - 1)
      const canPick = mode === 'webview' ? Boolean(guest.ready) && Boolean(target) : Boolean(target) && pageTransport
      const canReload = mode === 'webview' ? Boolean(target) : Boolean(target)

      const rows = []
      rows.push(h('div', { key: 'toolbar', className: 'dsh-pc-toolbar' },
        iconButton('back', t('back'), !canBack, () => go(-1)),
        iconButton('forward', t('forward'), !canForward, () => go(1)),
        iconButton('reload', t('reload'), !canReload, () => {
          if (mode === 'webview') {
            if (stageRef.current) stageRef.current.reload()
          } else {
            setNonce((value) => value + 1)
          }
        }),
        h('form', {
          key: 'address',
          className: 'dsh-pc-address',
          onSubmit: (event) => {
            event.preventDefault()
            navigate(address)
          },
        }, h('input', {
          value: address,
          onChange: (event) => setAddress(event.target.value),
          placeholder: t('urlPlaceholder'),
          'aria-label': t('urlPlaceholder'),
          spellCheck: false,
        })),
        h('button', {
          key: 'pick',
          type: 'button',
          className: picking ? 'dsh-pc-pick is-active' : 'dsh-pc-pick',
          title: t(picking ? 'pickStop' : 'pickStart'),
          disabled: !canPick && !picking,
          onClick: togglePick,
        }, t(picking ? 'pickStop' : 'pickStart'))))

      if (status.text) {
        rows.push(h('div', { key: 'status', className: 'dsh-pc-status', 'data-kind': status.kind }, status.text))
      }
      if (mode === 'webview' && target) {
        rows.push(h(WebviewStage, {
          key: 'guest',
          ref: stageRef,
          sessionId: props ? props.sessionId : undefined,
          initialUrl: target,
          picking: picking,
          onState: onGuestState,
          onNavigate: onGuestNavigate,
          onPick: onGuestPick,
          onCancel: () => setPickState(false),
          onHover: setHoverLabel,
          onFallback: onGuestFallback,
        }))
      } else if (!pageTransport) {
        rows.push(h('div', { key: 'webonly', className: 'dsh-pc-status', 'data-kind': 'error' },
          t('webOnly'),
          protocol ? h('code', { className: 'dsh-pc-status-protocol' }, protocol) : null))
      } else if (target) {
        rows.push(h('iframe', {
          key: `frame-${nonce}`,
          ref: frameRef,
          className: 'dsh-pc-frame',
          src: proxySrc(),
          sandbox: 'allow-same-origin',
          referrerPolicy: 'no-referrer',
          title: t('frameTitle'),
          onLoad: onFrameLoad,
        }))
      } else {
        rows.push(h('div', { key: 'empty', className: 'dsh-pc-empty' },
          h('div', { className: 'dsh-pc-empty-title' }, t('emptyTitle')),
          h('div', { className: 'dsh-pc-empty-body' }, t('emptyBody')),
          h('div', { className: 'dsh-pc-empty-hint' }, t('emptyHint'))))
      }

      if (picking) {
        rows.push(h('div', { key: 'hint', className: 'dsh-pc-hint' },
          h('span', { className: 'dsh-pc-hint-label' }, t('pickHint')),
          hoverLabel ? h('code', { className: 'dsh-pc-hint-code' }, hoverLabel) : null))
      }

      if (picked.length > 0) {
        const chips = picked.slice(0, 3).map((entry, index) => h('code', {
          key: `picked-${index}`,
          className: 'dsh-pc-chip',
          title: entry.selector,
        }, `${entry.tag}${entry.text ? ` · ${entry.text.slice(0, 24)}` : ''}`))
        rows.push(h('div', { key: 'recent', className: 'dsh-pc-recent' },
          h('span', { className: 'dsh-pc-recent-label' }, t('recent')),
          chips))
      }

      if (pending) {
        rows.push(h('button', {
          key: 'retry',
          type: 'button',
          className: 'dsh-pc-retry',
          onClick: () => insertPayload(pending),
        }, t('retryInsert')))
      }

      return h(React.Fragment, null,
        h('style', { key: 'style' }, CSS),
        h('div', { key: 'panel', className: 'dsh-pc-panel' }, rows))
    }

    function OpenButton() {
      useLocale()
      return h(React.Fragment, null,
        h('style', { key: 'style' }, CSS),
        h('button', {
          key: 'button',
          type: 'button',
          className: 'dsh-pc-open',
          title: t('open'),
          'aria-label': t('open'),
          onClick: openPanel,
        }, h('svg', {
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          'aria-hidden': true,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        h('circle', { cx: 8, cy: 8, r: 5.6 }),
        h('path', { d: 'M2.4 8h11.2M8 2.4c1.6 1.7 2.4 3.6 2.4 5.6S9.6 12 8 13.6C6.4 12 5.6 10 5.6 8s.8-3.9 2.4-5.6z' }))))
    }

    function GuideIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 16,
        height: 16,
        'aria-hidden': true,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      h('circle', { cx: 7, cy: 7, r: 4.6 }),
      h('path', { d: 'M2.4 7h9.2M7 2.4c1.3 1.4 2 3 2 4.6s-.7 3.2-2 4.6M7 2.4C5.7 3.8 5 5.4 5 7s.7 3.2 2 4.6' }),
      h('path', { d: 'M10.6 9.4l4 1.8-1.8.6-.6 1.8z', fill: 'currentColor', stroke: 'none' }))
    }

    function apply(ctx) {
      const locale = ctx.get('locale')
      if (locale && typeof locale.register === 'function') {
        try {
          ctx.effect(() => locale.register(NS, 'en', DICTS.en))
          ctx.effect(() => locale.register(NS, 'zh', DICTS.zh))
          translate = typeof locale.bind === 'function' ? locale.bind(NS) : null
        } catch (error) {
          console.error('[page-context] locale registration failed', error)
        }
      }
      ctx.on('locale/change', notifyLocale)

      const tabs = ctx.get('sidebarRightTabs')
      const side = ctx.get('sidebarRight')
      controller = side && typeof side.openTab === 'function' ? side : null

      if (tabs && typeof tabs.register === 'function') {
        try {
          ctx.effect(() => tabs.register({
            id: PLUGIN_ID,
            kind: KIND,
            priority: 'builtin',
            title: () => t('tabTitle'),
            keepMounted: true,
            guide: [{
              id: 'page-context',
              order: 40,
              title: () => t('guideTitle'),
              description: () => t('guideDescription'),
              icon: GuideIcon,
            }],
          }))
        } catch (error) {
          console.error('[page-context] tab type registration failed', error)
        }
      } else {
        console.error('[page-context] sidebarRightTabs is unavailable; the page browser cannot open')
      }

      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: PLUGIN_ID,
      }, PageContextBody))

      if (controller) {
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'page-context',
          order: 10,
        }, OpenButton))
      } else {
        console.error('[page-context] sidebarRight is unavailable; the composer button is not registered')
      }
    }

    return { inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'], apply }
  },
})
