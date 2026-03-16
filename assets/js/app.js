/* ================================================================
   MARKET PULSE — Main Application
   Handles report loading, tab switching, and navigation.
   ================================================================ */

var App = {
  manifest: null,
  reportData: null,
  currentDate: null,
  currentIndex: -1,

  /* ---- Bootstrap ---- */
  async init() {
    try {
      this.manifest = await DataLoader.loadManifest();
      var requestedDate = this.getRequestedDate();
      var reports = this.manifest.reports || [];

      if (reports.length === 0) {
        this.showError('No reports available yet.');
        return;
      }

      /* Determine which report to load */
      if (requestedDate) {
        this.currentIndex = reports.findIndex(function (r) { return r.date === requestedDate; });
        if (this.currentIndex === -1) {
          this.showError('Report for ' + requestedDate + ' not found.');
          return;
        }
        this.currentDate = requestedDate;
      } else {
        /* Load the latest (first in manifest since reverse-chronological) */
        this.currentIndex = 0;
        this.currentDate = reports[0].date;
      }

      this.reportData = await DataLoader.loadReport(this.currentDate);
      this.render();
      this.setupTabs();
      this.setupNavigation();
      this.setupScrollTop();
      this.showContent();
      this.updatePageTitle();
    } catch (err) {
      console.error('App init error:', err);
      this.showError('Failed to load report. Please try again later.');
    }
  },

  /* ---- URL Param Parsing ---- */
  getRequestedDate() {
    var params = new URLSearchParams(window.location.search);
    return params.get('date') || null;
  },

  /* ---- Render Full Report ---- */
  render() {
    var data = this.reportData;

    /* Hero */
    document.getElementById('report-hero').innerHTML = Renderer.hero(data);

    /* Tab panels */
    document.getElementById('tab-overview').innerHTML = Renderer.overviewTab(data);
    document.getElementById('tab-markets').innerHTML = Renderer.marketsTab(data);
    document.getElementById('tab-ideas').innerHTML = Renderer.ideasTab(data);
    document.getElementById('tab-global').innerHTML = Renderer.globalNewsTab(data);
    document.getElementById('tab-india').innerHTML = Renderer.indiaNewsTab(data);
    document.getElementById('tab-stocks').innerHTML = Renderer.stocksTab(data);
    document.getElementById('tab-plan').innerHTML = Renderer.planTab(data);

    /* Footer sections */
    document.getElementById('report-sources').innerHTML = Renderer.sources(data.sources);
    document.getElementById('report-disclaimer').innerHTML = Renderer.disclaimer(data.disclaimer);
  },

  /* ---- Tab Switching ---- */
  setupTabs() {
    var self = this;
    var navEl = document.getElementById('tab-nav');
    navEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      var tabId = btn.getAttribute('data-tab');
      self.switchTab(tabId);
    });

    /* Restore tab from URL hash */
    var hash = window.location.hash.replace('#', '');
    if (['overview', 'markets', 'ideas', 'global', 'india', 'stocks', 'plan'].indexOf(hash) !== -1) {
      this.switchTab(hash);
    }
  },

  switchTab(tabId) {
    /* Update buttons */
    var buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    /* Update panels */
    var panels = document.querySelectorAll('.tab-panel');
    panels.forEach(function (panel) {
      var isTarget = panel.id === 'tab-' + tabId;
      panel.classList.toggle('hidden', !isTarget);
      panel.classList.toggle('active', isTarget);
    });

    /* Update hash without scrolling */
    history.replaceState(null, '', window.location.pathname + window.location.search + '#' + tabId);
  },

  /* ---- Report Navigation (Prev / Next / Latest / Archive) ---- */
  setupNavigation() {
    var reports = this.manifest.reports || [];
    var idx = this.currentIndex;
    var total = reports.length;

    var hasPrev = idx < total - 1;
    var hasNext = idx > 0;
    var isLatest = idx === 0;

    var navHtml = '<button class="nav-btn" data-action="prev"' +
      (hasPrev ? '' : ' disabled') + '>&larr; Previous</button>';
    navHtml += '<span class="nav-date">' + HtmlUtils.esc(this.currentDate) + '</span>';
    navHtml += '<button class="nav-btn" data-action="next"' +
      (hasNext ? '' : ' disabled') + '>Next &rarr;</button>';
    navHtml += '<button class="nav-btn" data-action="latest"' +
      (isLatest ? ' disabled' : '') + '>Latest</button>';
    navHtml += '<a href="archive.html" class="nav-btn">Archive</a>';

    var navEl = document.getElementById('report-nav');
    navEl.innerHTML = navHtml;

    var self = this;
    navEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.nav-btn[data-action]');
      if (!btn || btn.disabled) return;
      var action = btn.getAttribute('data-action');
      self.navigate(action);
    });
  },

  navigate(action) {
    var reports = this.manifest.reports || [];
    var targetDate = null;

    if (action === 'prev' && this.currentIndex < reports.length - 1) {
      targetDate = reports[this.currentIndex + 1].date;
    } else if (action === 'next' && this.currentIndex > 0) {
      targetDate = reports[this.currentIndex - 1].date;
    } else if (action === 'latest') {
      targetDate = null; /* Go to index.html without date param */
    }

    if (action === 'latest') {
      window.location.href = 'index.html';
    } else if (targetDate) {
      window.location.href = 'index.html?date=' + targetDate;
    }
  },

  /* ---- Scroll to Top ---- */
  setupScrollTop() {
    var btn = document.getElementById('scroll-top-btn');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('hidden', window.scrollY < 300);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  },

  /* ---- Page Title ---- */
  updatePageTitle() {
    var meta = this.reportData.meta || {};
    var title = (meta.title || Config.siteName) + ' — ' + DateUtils.format(meta.date, 'medium');
    document.title = title;
  },

  /* ---- State Management ---- */
  showLoading() {
    document.getElementById('loading-state').classList.remove('hidden');
    document.getElementById('error-state').classList.add('hidden');
    document.getElementById('report-content').classList.add('hidden');
  },

  showError(msg) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
    document.getElementById('report-content').classList.add('hidden');
    document.querySelector('.error-message').textContent = msg;
  },

  showContent() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.add('hidden');
    document.getElementById('report-content').classList.remove('hidden');
  },
};

/* ---- Launch ---- */
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
