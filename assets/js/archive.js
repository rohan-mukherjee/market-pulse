/* ================================================================
   MARKET PULSE — Archive Page
   Loads manifest and renders a reverse-chronological list of reports.
   ================================================================ */

var ArchivePage = {
  manifest: null,

  async init() {
    try {
      this.manifest = await DataLoader.loadManifest();
      this.render();
      this.showContent();
    } catch (err) {
      console.error('Archive init error:', err);
      this.showError('Failed to load archive. Please try again later.');
    }
  },

  render() {
    var reports = this.manifest.reports || [];
    var countEl = document.getElementById('archive-count');
    var gridEl = document.getElementById('archive-grid');

    countEl.textContent = reports.length + ' report' + (reports.length !== 1 ? 's' : '') + ' available';

    if (reports.length === 0) {
      gridEl.innerHTML = '<div class="empty-section">No reports published yet.</div>';
      return;
    }

    var html = reports.map(function (r, index) {
      var dateFormatted = DateUtils.format(r.date, 'medium');
      var relative = DateUtils.relativeDay(r.date);
      var href = index === 0 ? 'index.html' : 'index.html?date=' + r.date;

      /* Determine mood class */
      var moodCls = 'neutral';
      if (r.mood) {
        var lower = r.mood.toLowerCase();
        if (lower.includes('bullish') && !lower.includes('cautious')) moodCls = 'positive';
        else if (lower.includes('bearish')) moodCls = 'negative';
      }

      return '<a href="' + href + '" class="archive-card">' +
        '<div class="archive-card-left">' +
          '<span class="archive-card-date">' + HtmlUtils.esc(r.date) +
            (relative ? ' &middot; ' + HtmlUtils.esc(relative) : '') + '</span>' +
          '<span class="archive-card-title">' + HtmlUtils.esc(r.title || 'Market Pulse Daily') + '</span>' +
          (r.subtitle ? '<span class="archive-card-subtitle">' + HtmlUtils.esc(r.subtitle) + '</span>' : '') +
        '</div>' +
        '<div class="archive-card-right">' +
          (r.mood ? '<span class="archive-mood ' + moodCls + '">' + HtmlUtils.esc(r.mood) + '</span>' : '') +
          '<span class="archive-arrow">&rarr;</span>' +
        '</div>' +
      '</a>';
    }).join('');

    gridEl.innerHTML = html;
  },

  showContent() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('archive-content').classList.remove('hidden');
  },

  showError(msg) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
    document.querySelector('.error-message').textContent = msg;
  },
};

document.addEventListener('DOMContentLoaded', function () {
  ArchivePage.init();
});
