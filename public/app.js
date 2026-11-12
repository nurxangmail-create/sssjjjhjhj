/* ==========================================================================
   TikSave — frontend controller (vanilla JS, no dependencies)
   ========================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- i18n */
  const I18N = {
    az: {
      heroTitle1: 'TikTok videosunu',
      heroTitle2: 'logotipsiz yüklə',
      heroSub: 'Linki yerləşdir — video, səs və HD keyfiyyət avtomatik tapılır. Qeydiyyat yoxdur, ödəniş yoxdur.',
      paste: 'Yapışdır',
      downloadBtn: 'Yüklə',
      badgeNoWatermark: 'Logotipsiz',
      badgeHD: 'HD keyfiyyət',
      badgeAudio: 'Səsli MP3',
      badgeFast: 'Sürətli',
      historyTitle: 'Son yükləmələr',
      clearAll: 'Hamısını sil',
      f1Title: 'Logotipsiz MP4',
      f1Text: 'Videolar TikTok loqosu olmadan, orijinal keyfiyyətdə gəlir.',
      f2Title: 'MP3 səs',
      f2Text: 'Videodan təmiz audio çıxar — musiqi və ya səs yazısı.',
      f3Title: 'Mobil üçün',
      f3Text: 'Android və iOS-da sürətli, donmayan interfeys.',
      f4Title: 'Təhlükəsiz',
      f4Text: 'Serverdə video saxlanmır. Yalnız icazəli media ötürülür.',
      faqTitle: 'Tez-tez verilən suallar',
      q1: 'Video niyə tapılmır?',
      a1: 'Video silinmiş, özəl hesabda və ya bölgə məhdudiyyətli ola bilər. Linkin tam olduğuna əmin olun.',
      q2: 'Logotip (watermark) varmı?',
      a2: 'Xeyr. Yüklənən fayllar TikTok-un logotipsiz media versiyasıdır.',
      q3: 'Maksimum keyfiyyət nədir?',
      a3: 'Platformanın təqdim etdiyi ən yüksək versiya göstərilir — adətən 720p və ya 1080p. Hər variantın ölçüsü və kodeki göstərilir.',
      q4: 'Hansı videoları yükləmək olmaz?',
      a4: 'Özəl, silinmiş və müəllif hüququ ilə qorunan videolar. Yalnız icazəniz olan məzmunu yükləyin.',
      footerNote: 'Yalnız şəxsi istifadə və müəllif hüququ qaydalarına uyğun istifadə üçün.',
      providers: 'Provayderlər',
      loading: 'Video axtarılır…',
      loadingHint: 'TikTok-dan məlumat alınır, bir neçə saniyə çəkə bilər.',
      errTitle: 'Alınmadı',
      retry: 'Yenidən cəhd et',
      quality: 'Keyfiyyət seçin',
      download: 'Yüklə',
      downloadBest: 'Ən yaxşısını yüklə',
      mp3: 'MP3 səs',
      gif: 'GIF',
      copyCaption: 'Mətni kopyala',
      copyLink: 'Linki kopyala',
      openTikTok: 'TikTok-da aç',
      share: 'Paylaş',
      plays: 'baxış',
      likes: 'bəyənmə',
      comments: 'şərh',
      shares: 'paylaşma',
      saves: 'saxlama',
      music: 'Musiqi',
      downloading: 'Yükləmə başladı',
      copied: 'Kopyalandı',
      copyFail: 'Kopyalamaq alınmadı',
      pasted: 'Link yapışdırıldı',
      pasteFail: 'Buferə giriş yoxdur — linki əl ilə yapışdırın',
      emptyInput: 'Zəhmət olmasa TikTok linkini daxil edin',
      invalidUrl: 'Bu TikTok video linkinə oxşamır',
      converting: 'Çevrilir',
      convertDone: 'Hazırdır',
      convertFail: 'Çevirmə alınmadı',
      photoPost: 'Foto qalereya',
      downloadPhoto: 'Şəkli yüklə',
      downloadAll: 'Şəkilləri yüklə',
      noStream: 'Bu video üçün yükləmə mənbəyi tapılmadı',
      notice: 'Qeyd',
      close: 'Bağla',
      themeLight: 'İşıqlı tema',
      themeDark: 'Tünd tema',
      historyEmpty: 'Hələ heç nə yüklənməyib',
      historyRemoved: 'Tarixçə silindi',
      hdBadge: 'HD',
      hevcWarn: 'HEVC (H.265) — köhnə cihazlarda açılmaya bilər',
      compat: 'Uyğun',
      source: 'Mənbə',
      size: 'Ölçü',
      duration: 'Müddət',
      cancel: 'Ləğv et',
      noAudio: 'Səssiz video',
      withAudio: 'Səsli',
      offline: 'İnternet bağlantısı yoxdur',
      serverBusy: 'Server məşğuldur, bir az sonra cəhd edin',
      jobWait: 'Serverdə çevrilir…',
      expired: 'Linkin vaxtı bitdi — videonu yenidən axtarın',
      qr: 'QR kod',
    },
    en: {
      heroTitle1: 'Download TikTok videos',
      heroTitle2: 'without watermark',
      heroSub: 'Paste the link — video, audio and HD quality are detected automatically. No signup, no payment.',
      paste: 'Paste',
      downloadBtn: 'Download',
      badgeNoWatermark: 'No watermark',
      badgeHD: 'HD quality',
      badgeAudio: 'MP3 audio',
      badgeFast: 'Fast',
      historyTitle: 'Recent downloads',
      clearAll: 'Clear all',
      f1Title: 'Watermark-free MP4',
      f1Text: 'Videos come in original quality with no TikTok logo.',
      f2Title: 'MP3 audio',
      f2Text: 'Extract clean audio from any video — music or voice.',
      f3Title: 'Mobile ready',
      f3Text: 'Fast, lag-free interface on Android and iOS.',
      f4Title: 'Safe',
      f4Text: 'No videos are stored on the server. Only authorised media is relayed.',
      faqTitle: 'Frequently asked questions',
      q1: 'Why is the video not found?',
      a1: 'The video may be deleted, private, or region-restricted. Make sure the link is complete.',
      q2: 'Is there a watermark?',
      a2: 'No. Downloaded files are the watermark-free media version.',
      q3: 'What is the maximum quality?',
      a3: 'The highest version the platform provides — usually 720p or 1080p. Each variant shows its size and codec.',
      q4: 'Which videos cannot be downloaded?',
      a4: 'Private, deleted and copyrighted videos. Only download content you have permission to use.',
      footerNote: 'For personal use only, in compliance with copyright rules.',
      providers: 'Providers',
      loading: 'Looking up the video…',
      loadingHint: 'Fetching data from TikTok, this can take a few seconds.',
      errTitle: 'Failed',
      retry: 'Try again',
      quality: 'Choose quality',
      download: 'Download',
      downloadBest: 'Download best',
      mp3: 'MP3 audio',
      gif: 'GIF',
      copyCaption: 'Copy caption',
      copyLink: 'Copy link',
      openTikTok: 'Open in TikTok',
      share: 'Share',
      plays: 'views',
      likes: 'likes',
      comments: 'comments',
      shares: 'shares',
      saves: 'saves',
      music: 'Music',
      downloading: 'Download started',
      copied: 'Copied',
      copyFail: 'Could not copy',
      pasted: 'Link pasted',
      pasteFail: 'Clipboard unavailable — paste manually',
      emptyInput: 'Please enter a TikTok link',
      invalidUrl: 'This does not look like a TikTok video link',
      converting: 'Converting',
      convertDone: 'Ready',
      convertFail: 'Conversion failed',
      photoPost: 'Photo gallery',
      downloadPhoto: 'Download image',
      downloadAll: 'Download images',
      noStream: 'No downloadable source found for this video',
      notice: 'Note',
      close: 'Close',
      themeLight: 'Light theme',
      themeDark: 'Dark theme',
      historyEmpty: 'Nothing downloaded yet',
      historyRemoved: 'History cleared',
      hdBadge: 'HD',
      hevcWarn: 'HEVC (H.265) — may not play on older devices',
      compat: 'Compatible',
      source: 'Source',
      size: 'Size',
      duration: 'Duration',
      cancel: 'Cancel',
      noAudio: 'Silent video',
      withAudio: 'With audio',
      offline: 'No internet connection',
      serverBusy: 'Server busy, please retry shortly',
      jobWait: 'Converting on the server…',
      expired: 'Link expired — search the video again',
      qr: 'QR code',
    },
    ru: {
      heroTitle1: 'Скачать видео TikTok',
      heroTitle2: 'без водяного знака',
      heroSub: 'Вставьте ссылку — видео, звук и HD-качество определяются автоматически. Без регистрации и оплаты.',
      paste: 'Вставить',
      downloadBtn: 'Скачать',
      badgeNoWatermark: 'Без логотипа',
      badgeHD: 'HD качество',
      badgeAudio: 'MP3 звук',
      badgeFast: 'Быстро',
      historyTitle: 'Недавние загрузки',
      clearAll: 'Очистить всё',
      f1Title: 'MP4 без логотипа',
      f1Text: 'Видео в оригинальном качестве без логотипа TikTok.',
      f2Title: 'MP3 звук',
      f2Text: 'Извлеките чистый звук из любого видео.',
      f3Title: 'Для мобильных',
      f3Text: 'Быстрый интерфейс на Android и iOS.',
      f4Title: 'Безопасно',
      f4Text: 'Видео не хранятся на сервере. Передаётся только разрешённый контент.',
      faqTitle: 'Частые вопросы',
      q1: 'Почему видео не найдено?',
      a1: 'Видео может быть удалено, приватным или ограниченным по региону.',
      q2: 'Есть водяной знак?',
      a2: 'Нет. Скачиваемые файлы — версия без логотипа.',
      q3: 'Максимальное качество?',
      a3: 'Самая высокая доступная версия — обычно 720p или 1080p.',
      q4: 'Какие видео нельзя скачивать?',
      a4: 'Приватные, удалённые и защищённые авторским правом.',
      footerNote: 'Только для личного использования с соблюдением авторских прав.',
      providers: 'Провайдеры',
      loading: 'Ищем видео…',
      loadingHint: 'Получаем данные из TikTok, это может занять несколько секунд.',
      errTitle: 'Не удалось',
      retry: 'Повторить',
      quality: 'Выберите качество',
      download: 'Скачать',
      downloadBest: 'Скачать лучшее',
      mp3: 'MP3 звук',
      gif: 'GIF',
      copyCaption: 'Копировать текст',
      copyLink: 'Копировать ссылку',
      openTikTok: 'Открыть в TikTok',
      share: 'Поделиться',
      plays: 'просмотры',
      likes: 'лайки',
      comments: 'комментарии',
      shares: 'репосты',
      saves: 'сохранения',
      music: 'Музыка',
      downloading: 'Загрузка началась',
      copied: 'Скопировано',
      copyFail: 'Не удалось скопировать',
      pasted: 'Ссылка вставлена',
      pasteFail: 'Буфер недоступен — вставьте вручную',
      emptyInput: 'Введите ссылку TikTok',
      invalidUrl: 'Это не похоже на ссылку TikTok',
      converting: 'Конвертация',
      convertDone: 'Готово',
      convertFail: 'Конвертация не удалась',
      photoPost: 'Фотогалерея',
      downloadPhoto: 'Скачать фото',
      downloadAll: 'Скачать фото',
      noStream: 'Не найден источник для скачивания',
      notice: 'Примечание',
      close: 'Закрыть',
      themeLight: 'Светлая тема',
      themeDark: 'Тёмная тема',
      historyEmpty: 'Пока ничего не скачано',
      historyRemoved: 'История очищена',
      hdBadge: 'HD',
      hevcWarn: 'HEVC (H.265) — может не работать на старых устройствах',
      compat: 'Совместимо',
      source: 'Источник',
      size: 'Размер',
      duration: 'Длительность',
      cancel: 'Отмена',
      noAudio: 'Без звука',
      withAudio: 'Со звуком',
      offline: 'Нет подключения к интернету',
      serverBusy: 'Сервер занят, попробуйте позже',
      jobWait: 'Конвертация на сервере…',
      expired: 'Ссылка истекла — найдите видео заново',
      qr: 'QR-код',
    },
  };

  let lang = localStorage.getItem('ttdl:lang') || 'az';
  const t = (key) => (I18N[lang] && I18N[lang][key]) || I18N.az[key] || key;

  /* --------------------------------------------------------------- state */
  const state = {
    video: null,
    selectedIndex: 0,
    loading: false,
    resolveAbort: null,
    lastInput: '',
    job: null,
    jobTimer: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const el = {
    form: $('#resolve-form'),
    input: $('#url-input'),
    submit: $('#submit-btn'),
    paste: $('#paste-btn'),
    clear: $('#clear-btn'),
    status: $('#status-area'),
    result: $('#result-area'),
    history: $('#history-section'),
    historyList: $('#history-list'),
    clearHistory: $('#clear-history'),
    theme: $('#theme-toggle'),
    toasts: $('#toast-stack'),
  };

  /* ------------------------------------------------------------- helpers */
  const esc = (str) =>
    String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const fmtBytes = (n) => {
    const num = Number(n);
    if (!num || num <= 0) return null;
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = num;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')} ${u[i]}`;
  };

  function toast(message, type = 'ok', ms = 3200) {
    const icons = {
      ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>',
      err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
      warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17v.01"/></svg>',
    };
    const node = document.createElement('div');
    node.className = `toast is-${type}`;
    node.innerHTML = `${icons[type] || icons.ok}<span>${esc(message)}</span>`;
    el.toasts.appendChild(node);
    setTimeout(() => {
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 260);
    }, ms);
    // Keep the stack bounded on long sessions.
    while (el.toasts.children.length > 3) el.toasts.firstElementChild.remove();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  /* --------------------------------------------------------------- theme */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ttdl:theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f7fb' : '#0b1020');
    el.theme?.setAttribute('title', theme === 'light' ? t('themeDark') : t('themeLight'));
  }

  (function initTheme() {
    const saved = localStorage.getItem('ttdl:theme');
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    applyTheme(saved || (prefersLight ? 'light' : 'dark'));
  })();

  el.theme?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });

  /* ---------------------------------------------------------------- i18n */
  function applyLanguage(next) {
    lang = next;
    localStorage.setItem('ttdl:lang', lang);
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      const val = t(key);
      if (val) node.textContent = val;
    });
    document.querySelectorAll('.lang-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.lang === lang);
    });
    if (state.video) renderResult(state.video);
    renderHistory();
    el.theme?.setAttribute(
      'title',
      document.documentElement.getAttribute('data-theme') === 'light' ? t('themeDark') : t('themeLight'),
    );
  }

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyLanguage(btn.dataset.lang));
  });

  /* ------------------------------------------------------------ url check */
  function looksLikeTikTok(value) {
    const v = String(value || '').trim();
    if (!v) return false;
    if (/^\d{6,25}$/.test(v)) return true;
    return /(tiktok\.com|tiktokv\.com)/i.test(v) || /^https?:\/\/\S+/i.test(v);
  }

  /* -------------------------------------------------------------- status */
  function showStatus(html) {
    el.status.innerHTML = html;
  }
  function clearStatus() {
    el.status.innerHTML = '';
  }

  function alertBlock({ type = 'info', title, text, actions = '' }) {
    const icons = {
      error:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
      warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17v.01"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
    };
    return `<div class="alert is-${type}">${icons[type] || icons.info}<div class="alert-body">
      ${title ? `<div class="alert-title">${esc(title)}</div>` : ''}
      ${text ? `<div class="alert-text">${esc(text)}</div>` : ''}
      ${actions ? `<div class="alert-actions">${actions}</div>` : ''}
    </div></div>`;
  }

  function skeleton() {
    return `<div class="skeleton-card" role="status" aria-label="${esc(t('loading'))}">
      <div class="sk sk-thumb"></div>
      <div class="sk-lines">
        <div class="sk sk-line w40"></div>
        <div class="sk sk-line w80"></div>
        <div class="sk sk-line w60"></div>
        <div class="sk sk-line" style="height:52px;margin-top:4px"></div>
        <div class="sk sk-line w40"></div>
      </div>
    </div>`;
  }

  /* -------------------------------------------------------------- resolve */
  async function doResolve(rawInput, { refresh = false } = {}) {
    const value = String(rawInput ?? el.input.value ?? '').trim();

    if (!value) {
      showStatus(alertBlock({ type: 'warn', title: t('errTitle'), text: t('emptyInput') }));
      el.input.focus();
      return;
    }
    if (!looksLikeTikTok(value)) {
      showStatus(alertBlock({ type: 'warn', title: t('errTitle'), text: t('invalidUrl') }));
      el.input.focus();
      return;
    }
    if (!navigator.onLine) {
      showStatus(alertBlock({ type: 'error', title: t('errTitle'), text: t('offline') }));
      return;
    }

    state.lastInput = value;
    state.loading = true;
    el.submit.classList.add('is-loading');
    el.submit.disabled = true;
    el.result.hidden = true;
    el.history.hidden = true;
    showStatus(skeleton());

    // Cancel a previous in-flight request (double-tap protection).
    state.resolveAbort?.abort();
    const ctrl = new AbortController();
    state.resolveAbort = ctrl;
    const timeout = setTimeout(() => ctrl.abort('timeout'), 25_000);

    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value, refresh }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);

      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok || !payload?.ok) {
        handleResolveError(res, payload);
        return;
      }

      const video = payload.video;
      state.video = video;
      state.selectedIndex = Math.max(0, video.qualities.findIndex((q) => q.id === video.bestQuality?.id));
      if (state.selectedIndex < 0) state.selectedIndex = 0;

      clearStatus();
      renderResult(video);
      saveHistory(video);
      renderHistory();

      if (!video.qualities.length && !video.isPhoto) {
        showStatus(
          alertBlock({
            type: 'warn',
            title: t('notice'),
            text: video.notice || t('noStream'),
            actions: `<button class="btn btn-sm" data-action="retry">${esc(t('retry'))}</button>`,
          }),
        );
      }

      // Scroll the result into view on phones (where the form fills the screen).
      if (window.matchMedia('(max-width: 640px)').matches) {
        requestAnimationFrame(() => {
          el.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') {
        const reason = String(ctrl.signal.reason || '');
        if (reason === 'timeout') {
          showStatus(
            alertBlock({
              type: 'error',
              title: t('errTitle'),
              text: I18N[lang].loadingHint,
              actions: `<button class="btn btn-sm" data-action="retry">${esc(t('retry'))}</button>`,
            }),
          );
        }
        return; // superseded by a newer request — stay silent
      }
      showStatus(
        alertBlock({
          type: 'error',
          title: t('errTitle'),
          text: navigator.onLine ? String(err?.message || 'network') : t('offline'),
          actions: `<button class="btn btn-sm" data-action="retry">${esc(t('retry'))}</button>`,
        }),
      );
    } finally {
      state.loading = false;
      el.submit.classList.remove('is-loading');
      el.submit.disabled = false;
      state.resolveAbort = null;
    }
  }

  function handleResolveError(res, payload) {
    const code = payload?.error?.code || `HTTP_${res.status}`;
    // Prefer the server's localised (Azerbaijani) message, fall back to ours.
    let message = payload?.error?.message || '';
    if (!message) {
      if (res.status === 429) message = t('serverBusy');
      else if (res.status === 404) message = I18N[lang].q1;
      else message = t('errTitle');
    }

    // Localise the retry action label and severity by error class.
    const severity =
      code === 'INVALID_URL'
        ? 'warn'
        : code === 'RATE_LIMITED' || code === 'TIMEOUT'
          ? 'warn'
          : 'error';

    const actions = `
      <button class="btn btn-sm" data-action="retry">${esc(t('retry'))}</button>
      ${
        code === 'INVALID_URL'
          ? `<a class="btn btn-sm" href="https://www.tiktok.com" target="_blank" rel="noopener">${esc(t('openTikTok'))}</a>`
          : ''
      }
    `;
    showStatus(alertBlock({ type: severity, title: t('errTitle'), text: message, actions }));
  }

  /* --------------------------------------------------------------- render */
  function renderResult(video) {
    const q = video.qualities[state.selectedIndex] || video.qualities[0] || null;
    const hasQualities = video.qualities.length > 0;
    const poster = video.coverPath || video.cover || '';

    const stats = [
      video.stats?.playsLabel && { icon: 'eye', value: video.stats.playsLabel, label: t('plays') },
      video.stats?.likesLabel && { icon: 'heart', value: video.stats.likesLabel, label: t('likes') },
      video.stats?.commentsLabel && { icon: 'chat', value: video.stats.commentsLabel, label: t('comments') },
      video.stats?.sharesLabel && { icon: 'share', value: video.stats.sharesLabel, label: t('shares') },
    ].filter(Boolean);

    const statIcons = {
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
      heart:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-9.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4Z"/></svg>',
      chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8 8 0 1 1 21 12Z"/></svg>',
      share:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="m8 8 4-4 4 4"/><path d="M12 4v12"/></svg>',
    };

    const qualityHtml = hasQualities
      ? video.qualities
          .map((item, idx) => {
            const selected = idx === state.selectedIndex;
            const tags = [];
            if (item.codec === 'h265')
              tags.push(`<span class="tag tag-hevc" title="${esc(t('hevcWarn'))}">HEVC</span>`);
            if (item.recommended && item.codec !== 'h265')
              tags.push(`<span class="tag tag-best">${esc(t('downloadBest'))}</span>`);
            if (item.height >= 720) tags.push(`<span class="tag tag-hd">HD</span>`);
            if (!item.watermark) tags.push(`<span class="tag tag-nw">${esc(t('badgeNoWatermark'))}</span>`);

            const subParts = [];
            if (item.resolution) subParts.push(item.resolution);
            if (item.fps) subParts.push(`${item.fps}fps`);
            if (item.codec && item.codec !== 'unknown') subParts.push(item.codec.toUpperCase());
            if (item.bitrate) subParts.push(`${Math.round(item.bitrate / 1000)} kbps`);
            if (item.source) subParts.push(`${t('source')}: ${item.source}`);

            return `<button type="button" class="quality-option${selected ? ' is-selected' : ''}" data-qindex="${idx}" role="radio" aria-checked="${selected}">
              <span class="radio-dot" aria-hidden="true"></span>
              <span class="q-main">
                <span class="q-title">${esc(item.label)}${tags.join('')}</span>
                <span class="q-sub">${esc(subParts.join(' · '))}</span>
              </span>
              <span class="q-size">${item.sizeLabel ? esc(item.sizeLabel) : ''}</span>
            </button>`;
          })
          .join('')
      : `<div class="alert is-warn" style="margin:0">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17v.01"/></svg>
           <div class="alert-body"><div class="alert-text">${esc(video.notice || t('noStream'))}</div></div>
         </div>`;

    const photosHtml =
      video.isPhoto && video.images?.length
        ? `<div class="photo-grid">
             ${video.images
               .map(
                 (src, i) =>
                   `<a href="${esc(src)}" target="_blank" rel="noopener" download="tiktok-photo-${i + 1}.jpg" title="${esc(t('downloadPhoto'))}">
                      <img src="${esc(src)}" alt="photo ${i + 1}" loading="lazy" referrerpolicy="no-referrer" />
                    </a>`,
               )
               .join('')}
           </div>`
        : '';

    const authorInitial = (video.author?.nickname || video.author?.username || 'T').trim().charAt(0).toUpperCase();
    const avatar = video.author?.avatarPath || video.author?.avatar;

    el.result.innerHTML = `
      <article class="result-card">
        <div class="result-grid">
          <div class="preview-pane">
            <div class="preview-shell" id="preview-shell">
              ${
                hasQualities
                  ? `<video id="preview-video" playsinline webkit-playsinline preload="metadata"
                       poster="${esc(poster)}" controlsList="nodownload noplaybackrate"
                       disablepictureinpicture="false" crossorigin="anonymous"></video>
                     <div class="duration-chip" id="duration-chip">${esc(video.durationLabel || '')}</div>`
                  : `<img src="${esc(poster)}" alt="${esc(video.title || 'TikTok video')}" loading="eager" referrerpolicy="no-referrer" />`
              }
            </div>
          </div>

          <div class="detail-pane">
            <div class="author-row">
              ${
                avatar
                  ? `<img class="avatar" src="${esc(avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer"
                        onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar-fallback',textContent:'${esc(authorInitial)}'}))" />`
                  : `<div class="avatar-fallback" aria-hidden="true">${esc(authorInitial)}</div>`
              }
              <div class="author-meta">
                <div class="author-name">
                  <span>${esc(video.author?.nickname || video.author?.username || 'TikTok')}</span>
                  ${
                    video.author?.verified
                      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.1 3.2-.4 1.3 2.9 2.9 1.3-.4 3.2L23 14l-1.6 2.9.4 3.2-2.9 1.3-1.3 2.9-3.2-.4L12 26l-2.4-2.1-3.2.4-1.3-2.9L2.2 20l.4-3.2L1 14l1.6-2.9-.4-3.2 2.9-1.3L6.4 3.7l3.2.4Z" transform="translate(0 -2)"/></svg>'
                      : ''
                  }
                </div>
                <div class="author-handle">${video.author?.username ? `@${esc(video.author.username)}` : ''}</div>
              </div>
            </div>

            ${video.title ? `<p class="video-title">${esc(video.title)}</p>` : ''}

            ${
              stats.length
                ? `<div class="stat-row">${stats
                    .map(
                      (s) =>
                        `<span class="stat">${statIcons[s.icon] || ''}${esc(s.value)} ${esc(s.label)}</span>`,
                    )
                    .join('')}</div>`
                : ''
            }

            ${
              hasQualities
                ? `<span class="field-label">${esc(t('quality'))}</span>
                   <div class="quality-list" role="radiogroup" aria-label="${esc(t('quality'))}">${qualityHtml}</div>
                   <div class="action-row">
                     <button type="button" class="btn btn-primary" id="btn-download" data-action="download">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
                       ${esc(t('download'))}${q?.sizeLabel ? ` (${esc(q.sizeLabel)})` : ''}
                     </button>
                     <button type="button" class="btn btn-ghost" data-action="mp3" title="${esc(t('mp3'))}">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                       ${esc(t('mp3'))}
                     </button>
                     <button type="button" class="btn btn-ghost" data-action="share" title="${esc(t('share'))}">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
                       ${esc(t('share'))}
                     </button>
                     <button type="button" class="btn btn-ghost" data-action="copy-link" title="${esc(t('copyLink'))}">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
                     </button>
                   </div>`
                : ''
            }

            ${photosHtml}

            ${
              video.music
                ? `<div class="stat-row" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);border-bottom:0;margin-bottom:0">
                     <span class="stat">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                       ${esc(t('music'))}: ${esc(video.music.title || 'original sound')}${video.music.author ? ` — ${esc(video.music.author)}` : ''}
                     </span>
                   </div>`
                : ''
            }
          </div>
        </div>
      </article>
    `;

    el.result.hidden = false;

    // ---- wire preview video -------------------------------------------------
    const videoEl = document.getElementById('preview-video');
    if (videoEl && hasQualities && q) {
      const chip = document.getElementById('duration-chip');
      const setSrc = () => {
        // If a compatibility conversion exists for this exact variant, the
        // server already produced a playable H.264 file — prefer it.
        if (state.job?.state === 'done' && state.job.kind === 'mp4' && state.job.previewPath) {
          videoEl.src = state.job.previewPath;
        } else {
          videoEl.src = q.streamPath;
        }
        videoEl.load();
        if (chip && !videoEl.dataset.chipBound) {
          videoEl.dataset.chipBound = '1';
          videoEl.addEventListener('loadedmetadata', () => {
            if (Number.isFinite(videoEl.duration) && videoEl.duration > 0 && chip) {
              const s = Math.round(videoEl.duration);
              const m = Math.floor(s / 60);
              const sec = s % 60;
              chip.textContent = `${m}:${String(sec).padStart(2, '0')}`;
            }
          });
        }
        videoEl.addEventListener(
          'error',
          () => {
            // HEVC on old Chrome -> surface the honest hint instead of a black box.
            if (q.codec === 'h265') toast(t('hevcWarn'), 'warn', 4200);
          },
          { once: true },
        );
      };
      setSrc();
      videoEl.play?.().catch(() => {}); // muted autoplay is blocked; controls remain
    }
  }

  /* ------------------------------------------------------- quality select */
  el.result.addEventListener('click', (e) => {
    const opt = e.target.closest('.quality-option');
    if (opt) {
      const idx = Number(opt.dataset.qindex);
      if (Number.isFinite(idx) && state.video?.qualities[idx]) {
        state.selectedIndex = idx;
        renderResult(state.video); // re-render keeps preview in sync with the selection
      }
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'download') startDownload(actionEl);
    else if (action === 'mp3') startConversion('mp3', actionEl);
    else if (action === 'gif') startConversion('gif', actionEl);
    else if (action === 'share') shareVideo();
    else if (action === 'copy-link') copyVideoLink();
    else if (action === 'copy-caption') copyCaption();
    else if (action === 'retry') doResolve(state.lastInput || el.input.value, { refresh: true });
  });

  /* ------------------------------------------------------------ download */
  function startDownload(buttonEl) {
    const q = state.video?.qualities[state.selectedIndex];
    if (!q?.downloadPath) {
      toast(t('noStream'), 'err');
      return;
    }
    // Use an anchor so the browser streams straight to disk/memory manager:
    // the response carries Content-Disposition: attachment, so no JS buffering
    // (which would freeze phones) and no CORS issues (same origin).
    const a = document.createElement('a');
    a.href = q.downloadPath;
    a.rel = 'noopener';
    a.setAttribute('download', q.filename || 'tiktok-video.mp4');
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(`${t('downloading')} · ${q.filename || ''}`.trim(), 'ok');
  }

  /* ------------------------------------------------------------- convert */
  async function startConversion(kind, buttonEl) {
    const q = state.video?.qualities[state.selectedIndex];
    if (!q?.downloadToken) {
      toast(t('noStream'), 'err');
      return;
    }
    if (buttonEl) buttonEl.disabled = true;
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: q.downloadToken,
          kind,
          title: state.video.title,
          username: state.video.author?.username,
          durationSeconds: state.video.durationSeconds,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        const code = payload?.error?.code;
        toast(code === 'FFMPEG_MISSING' ? payload.error.message : payload?.error?.message || t('convertFail'), 'warn', 5200);
        return;
      }
      pollJob(payload.job.id, kind);
    } catch (err) {
      toast(t('convertFail'), 'err');
    } finally {
      if (buttonEl) buttonEl.disabled = false;
    }
  }

  function pollJob(jobId, kind) {
    clearInterval(state.jobTimer);
    const statusId = 'job-status-node';
    let node = document.getElementById(statusId);
    if (!node) {
      node = document.createElement('div');
      node.id = statusId;
      node.className = 'job-status';
      const pane = el.result.querySelector('.detail-pane');
      pane?.appendChild(node);
    }
    node.innerHTML = `<span>${esc(t('jobWait'))}</span><div class="job-bar"><i style="width:4%"></i></div>`;

    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          clearInterval(state.jobTimer);
          node.remove();
          toast(payload?.error?.message || t('convertFail'), 'err');
          return;
        }
        const job = payload.job;
        const bar = node.querySelector('.job-bar > i');
        if (bar) bar.style.width = `${Math.max(4, job.progress || 0)}%`;

        if (job.state === 'done') {
          clearInterval(state.jobTimer);
          state.job = job;
          node.innerHTML = `<span>${esc(t('convertDone'))} · ${esc(job.sizeLabel || '')}</span>`;
          const a = document.createElement('a');
          a.href = job.downloadPath;
          a.setAttribute('download', job.filename);
          document.body.appendChild(a);
          a.click();
          a.remove();
          toast(`${t('convertDone')} · ${job.filename}`, 'ok');
          setTimeout(() => node.remove(), 4500);
        } else if (job.state === 'error') {
          clearInterval(state.jobTimer);
          node.remove();
          toast(job.error ? `${t('convertFail')}: ${job.error}` : t('convertFail'), 'err', 5200);
        }
      } catch {
        clearInterval(state.jobTimer);
        node.remove();
        toast(t('convertFail'), 'err');
      }
    };

    state.jobTimer = setInterval(tick, 1200);
    tick();
  }

  /* --------------------------------------------------------------- share */
  async function shareVideo() {
    const url = state.video?.url || location.href;
    const title = state.video?.title || 'TikTok video';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    const ok = await copyText(url);
    toast(ok ? t('copied') : t('copyFail'), ok ? 'ok' : 'err');
  }

  async function copyVideoLink() {
    const ok = await copyText(state.video?.url || '');
    toast(ok ? t('copied') : t('copyFail'), ok ? 'ok' : 'err');
  }

  async function copyCaption() {
    const ok = await copyText(state.video?.title || '');
    toast(ok ? t('copied') : t('copyFail'), ok ? 'ok' : 'err');
  }

  /* ------------------------------------------------------------- history */
  const HKEY = 'ttdl:history';

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HKEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveHistory(video) {
    try {
      const entry = {
        id: video.id,
        url: video.url,
        title: (video.title || '').slice(0, 140),
        cover: video.coverPath || video.cover || '',
        author: video.author?.username || '',
        duration: video.durationLabel || '',
        at: Date.now(),
      };
      const list = loadHistory().filter((x) => x.id !== entry.id);
      list.unshift(entry);
      localStorage.setItem(HKEY, JSON.stringify(list.slice(0, 12)));
    } catch {
      /* storage full / private mode — history is a nice-to-have */
    }
  }

  function renderHistory() {
    const list = loadHistory();
    if (!list.length) {
      el.history.hidden = true;
      return;
    }
    el.history.hidden = false;
    el.historyList.innerHTML = list
      .map(
        (item) => `<button type="button" class="history-item" data-url="${esc(item.url)}">
          ${
            item.cover
              ? `<img class="history-thumb" src="${esc(item.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'" />`
              : '<div class="history-thumb"></div>'
          }
          <div class="history-meta">
            <div class="history-title">${esc(item.title || item.url)}</div>
            <div class="history-sub">${item.author ? `@${esc(item.author)}` : ''}${item.duration ? ` · ${esc(item.duration)}` : ''}</div>
          </div>
        </button>`,
      )
      .join('');
  }

  el.historyList?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-url]');
    if (!item) return;
    const url = item.dataset.url;
    el.input.value = url;
    el.clear.hidden = false;
    doResolve(url);
  });

  el.clearHistory?.addEventListener('click', () => {
    localStorage.removeItem(HKEY);
    renderHistory();
    toast(t('historyRemoved'), 'ok');
  });

  /* ---------------------------------------------------------------- form */
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.loading) return;
    doResolve(el.input.value);
  });

  el.input.addEventListener('input', () => {
    el.clear.hidden = !el.input.value;
  });

  el.clear.addEventListener('click', () => {
    el.input.value = '';
    el.clear.hidden = true;
    el.input.focus();
    clearStatus();
    el.result.hidden = true;
    state.video = null;
    renderHistory();
  });

  el.paste.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported');
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast(t('pasteFail'), 'warn');
        return;
      }
      el.input.value = text.trim();
      el.clear.hidden = false;
      toast(t('pasted'), 'ok', 1600);
      doResolve(el.input.value);
    } catch {
      toast(t('pasteFail'), 'warn', 3400);
      el.input.focus();
    }
  });

  // Enter key on the input submits (some mobile keyboards don't fire submit).
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doResolve(el.input.value);
    }
  });

  // Global "/" shortcut focuses the input.
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== el.input) {
      e.preventDefault();
      el.input.focus();
      el.input.select();
    }
  });

  /* ---------------------------------------------------------------- boot */
  (function boot() {
    applyLanguage(lang);
    renderHistory();

    // Deep link support: /?url=<encoded tiktok link>
    const params = new URLSearchParams(location.search);
    const deep = params.get('url');
    if (deep) {
      el.input.value = deep;
      el.clear.hidden = false;
      doResolve(deep);
    }

    // Cross-tab theme sync
    window.addEventListener('storage', (e) => {
      if (e.key === 'ttdl:theme' && e.newValue) applyTheme(e.newValue);
      if (e.key === 'ttdl:lang' && e.newValue && e.newValue !== lang) applyLanguage(e.newValue);
    });

    window.addEventListener('offline', () => toast(t('offline'), 'warn'));
  })();
})();
