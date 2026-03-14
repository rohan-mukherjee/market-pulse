/* ================================================================
   MARKET PULSE — Configuration & Utilities
   ================================================================ */

const Config = {
  dataPath: 'data',
  manifestFile: 'data/manifest.json',
  reportPath: 'data/reports',
  siteName: 'Market Pulse',
  siteTagline: 'Daily Market Intelligence',
};

/* --- Date Utilities --- */
const DateUtils = {
  /** Formats YYYY-MM-DD into a readable date string */
  format(dateStr, style) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = {
      long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
      medium: { year: 'numeric', month: 'short', day: 'numeric' },
      short: { month: 'short', day: 'numeric' },
    };
    return date.toLocaleDateString('en-IN', options[style] || options.medium);
  },

  /** Formats ISO timestamp into readable time */
  formatTime(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'short',
    });
  },

  /** Returns relative day label */
  relativeDay(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((today - target) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return diff + ' days ago';
    return '';
  },
};

/* --- HTML Utilities --- */
const HtmlUtils = {
  /** Escapes HTML entities to prevent XSS */
  esc(str) {
    if (typeof str !== 'string') return String(str ?? '');
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  /** Returns CSS class name for a sentiment value */
  sentimentClass(sentiment) {
    const map = { positive: 'positive', negative: 'negative', neutral: 'neutral' };
    return map[sentiment] || 'neutral';
  },

  /** Returns CSS class name for market status */
  statusClass(status) {
    const map = { open: 'open', closed: 'closed', 'pre-open': 'pre-open', holiday: 'closed' };
    return map[status] || 'closed';
  },

  /** Determines mood sentiment from label text */
  moodSentiment(label) {
    if (!label) return 'neutral';
    const lower = label.toLowerCase();
    if (lower.includes('bullish') && !lower.includes('cautious')) return 'positive';
    if (lower.includes('bearish')) return 'negative';
    return 'neutral';
  },
};

/* --- Data Fetching --- */
const DataLoader = {
  async fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load ' + url + ' (' + response.status + ')');
    return response.json();
  },

  async loadManifest() {
    return this.fetchJSON(Config.manifestFile);
  },

  async loadReport(date) {
    return this.fetchJSON(Config.reportPath + '/' + date + '.json');
  },
};
