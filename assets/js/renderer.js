/* ================================================================
   MARKET PULSE — Section Renderer
   All render functions return HTML strings.
   Missing/empty data is handled gracefully.
   ================================================================ */

const Renderer = {
  /* ---- Hero Section ---- */
  hero(data) {
    const meta = data.meta || {};
    const mood = data.mood || {};
    const dateStr = DateUtils.format(meta.date, 'long');
    const relative = DateUtils.relativeDay(meta.date);
    const relBadge = relative ? '<span class="hero-relative">' + HtmlUtils.esc(relative) + '</span>' : '';
    const statusCls = HtmlUtils.statusClass(meta.marketStatus);
    const moodSent = mood.sentiment || HtmlUtils.moodSentiment(mood.label);
    const moodCls = HtmlUtils.sentimentClass(moodSent);
    const subtitle = meta.subtitle ? '<p class="hero-subtitle">' + HtmlUtils.esc(meta.subtitle) + '</p>' : '';
    const updated = meta.lastUpdated
      ? '<span class="hero-updated">Updated ' + DateUtils.formatTime(meta.lastUpdated) + '</span>'
      : '';

    const pills = (mood.pills || [])
      .map(function (p) { return '<span class="mood-pill">' + HtmlUtils.esc(p) + '</span>'; })
      .join('');

    return '<div class="hero-inner">' +
      '<p class="hero-date">' + HtmlUtils.esc(dateStr) + ' ' + relBadge + '</p>' +
      '<h2 class="hero-title">' + HtmlUtils.esc(meta.title || Config.siteName) + '</h2>' +
      '<p class="hero-author">By Rohan Mukherjee</p>' +
      subtitle +
      '<div class="hero-meta">' +
        (mood.label
          ? '<span class="mood-badge ' + moodCls + '">' + HtmlUtils.esc(mood.label) + '</span>'
          : '') +
        '<span class="market-status"><span class="status-dot ' + statusCls + '"></span>' +
          HtmlUtils.esc((meta.marketStatus || 'closed').toUpperCase()) + '</span>' +
        updated +
      '</div>' +
      (pills ? '<div class="mood-pills">' + pills + '</div>' : '') +
    '</div>';
  },

  /* ---- Today in 30 Seconds ---- */
  todayIn30Seconds(items) {
    if (!items || items.length === 0) return '';
    var listItems = items
      .map(function (item) {
        return '<li class="summary-item"><span class="summary-bullet"></span>' +
          HtmlUtils.esc(item) + '</li>';
      })
      .join('');
    return '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#9889;</span> Today in 30 Seconds</h3>' +
      '<ul class="summary-list">' + listItems + '</ul>' +
    '</div>';
  },

  /* ---- What Changed Since Yesterday ---- */
  whatChanged(items) {
    if (!items || items.length === 0) return '';
    var cards = items
      .map(function (item) {
        var cls = HtmlUtils.sentimentClass(item.sentiment);
        return '<div class="change-card ' + cls + '">' +
          '<div class="change-card-title">' + HtmlUtils.esc(item.title) + '</div>' +
          '<div class="change-card-desc">' + HtmlUtils.esc(item.description) + '</div>' +
        '</div>';
      })
      .join('');
    return '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128260;</span> What Changed Since Yesterday</h3>' +
      '<div class="change-cards">' + cards + '</div>' +
    '</div>';
  },

  /* ---- Overview Metrics ---- */
  overviewMetrics(overview) {
    if (!overview || !overview.metrics || overview.metrics.length === 0) return '';
    var cards = overview.metrics
      .map(function (m) {
        var cls = HtmlUtils.sentimentClass(m.sentiment);
        return '<div class="metric-card">' +
          '<div class="metric-label">' + HtmlUtils.esc(m.label) + '</div>' +
          '<div class="metric-value">' + HtmlUtils.esc(m.value) + '</div>' +
          (m.change ? '<div class="metric-change ' + cls + '">' + HtmlUtils.esc(m.change) + '</div>' : '') +
        '</div>';
      })
      .join('');
    return '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128200;</span> Market Snapshot</h3>' +
      '<div class="metrics-grid">' + cards + '</div>' +
    '</div>';
  },

  /* ---- Global Macro ---- */
  globalMacro(data) {
    if (!data) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#127758;</span> Global Macro</h3>';

    if (data.summary) {
      html += '<p class="section-summary">' + HtmlUtils.esc(data.summary) + '</p>';
    }

    if (data.regions && data.regions.length > 0) {
      html += '<div class="data-rows">';
      data.regions.forEach(function (r) {
        var cls = HtmlUtils.sentimentClass(r.sentiment);
        html += '<div class="data-row">' +
          '<div><div class="data-row-label">' + HtmlUtils.esc(r.name) +
            '<span style="color:var(--text-muted);font-size:0.75rem;margin-left:0.4rem">' +
              HtmlUtils.esc(r.index) + '</span></div>' +
            (r.note ? '<div class="data-row-sublabel">' + HtmlUtils.esc(r.note) + '</div>' : '') +
          '</div>' +
          '<div class="data-row-value">' + HtmlUtils.esc(r.value) + '</div>' +
          '<div class="data-row-change ' + cls + '">' + HtmlUtils.esc(r.change) + '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    if (data.keyDrivers && data.keyDrivers.length > 0) {
      html += '<ul class="drivers-list">';
      data.keyDrivers.forEach(function (d) {
        html += '<li class="driver-item"><span class="driver-bullet">&#9670;</span>' +
          HtmlUtils.esc(d) + '</li>';
      });
      html += '</ul>';
    }

    html += '</div>';
    return html;
  },

  /* ---- Indian Market Pulse ---- */
  indianMarket(data) {
    if (!data) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#127470;&#127475;</span> Indian Market Pulse</h3>';

    if (data.summary) {
      html += '<p class="section-summary">' + HtmlUtils.esc(data.summary) + '</p>';
    }

    if (data.flows) {
      var fiCls = HtmlUtils.sentimentClass((data.flows.fii || {}).sentiment);
      var diCls = HtmlUtils.sentimentClass((data.flows.dii || {}).sentiment);
      html += '<div class="flows-row">' +
        '<div class="flow-card"><div class="flow-label">FII Net</div>' +
          '<div class="flow-value ' + fiCls + '">' + HtmlUtils.esc((data.flows.fii || {}).value || '-') + '</div></div>' +
        '<div class="flow-card"><div class="flow-label">DII Net</div>' +
          '<div class="flow-value ' + diCls + '">' + HtmlUtils.esc((data.flows.dii || {}).value || '-') + '</div></div>' +
      '</div>';
    }

    if (data.indices && data.indices.length > 0) {
      html += '<div class="data-rows">';
      data.indices.forEach(function (idx) {
        var cls = HtmlUtils.sentimentClass(idx.sentiment);
        html += '<div class="data-row">' +
          '<div class="data-row-label">' + HtmlUtils.esc(idx.name) + '</div>' +
          '<div class="data-row-value">' + HtmlUtils.esc(idx.close) + '</div>' +
          '<div class="data-row-change ' + cls + '">' + HtmlUtils.esc(idx.change) + '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    if (data.highlights && data.highlights.length > 0) {
      html += '<ul class="drivers-list">';
      data.highlights.forEach(function (h) {
        html += '<li class="driver-item"><span class="driver-bullet">&#9670;</span>' +
          HtmlUtils.esc(h) + '</li>';
      });
      html += '</ul>';
    }

    html += '</div>';
    return html;
  },

  /* ---- Market Regime ---- */
  marketRegime(data) {
    if (!data) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#127919;</span> Market Regime</h3>';

    if (data.current) {
      html += '<div class="regime-label">' + HtmlUtils.esc(data.current) + '</div>';
    }
    if (data.description) {
      html += '<p class="section-summary">' + HtmlUtils.esc(data.description) + '</p>';
    }

    if (data.signals && data.signals.length > 0) {
      html += '<div class="signals-grid">';
      data.signals.forEach(function (s) {
        var cls = HtmlUtils.sentimentClass(s.sentiment);
        html += '<div class="signal-card">' +
          '<div class="signal-label">' + HtmlUtils.esc(s.label) + '</div>' +
          '<div class="signal-value ' + cls + '">' + HtmlUtils.esc(s.value) + '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /* ---- Sector Rotation ---- */
  sectorRotation(data) {
    if (!data) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128257;</span> Sector Rotation</h3>';

    if (data.summary) {
      html += '<p class="section-summary">' + HtmlUtils.esc(data.summary) + '</p>';
    }

    if (data.sectors && data.sectors.length > 0) {
      html += '<div class="sector-grid">';
      data.sectors.forEach(function (s) {
        var cls = HtmlUtils.sentimentClass(s.sentiment);
        html += '<div class="sector-row">' +
          '<div class="sector-name">' + HtmlUtils.esc(s.name) + '</div>' +
          '<div class="sector-note">' + HtmlUtils.esc(s.note || '') + '</div>' +
          '<span class="sector-status ' + cls + '">' + HtmlUtils.esc(s.status) + '</span>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /* ---- Breadth / Internal Strength ---- */
  breadth(data) {
    if (!data) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128202;</span> Breadth &amp; Internal Strength</h3>';

    if (data.summary) {
      html += '<p class="section-summary">' + HtmlUtils.esc(data.summary) + '</p>';
    }

    if (data.indicators && data.indicators.length > 0) {
      html += '<div class="data-rows">';
      data.indicators.forEach(function (ind) {
        var cls = HtmlUtils.sentimentClass(ind.sentiment);
        html += '<div class="data-row">' +
          '<div class="data-row-label">' + HtmlUtils.esc(ind.label) + '</div>' +
          '<div class="data-row-value ' + cls + '">' + HtmlUtils.esc(ind.value) + '</div>' +
          '<div></div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /* ---- Key Levels ---- */
  keyLevels(data) {
    if (!data || Object.keys(data).length === 0) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128207;</span> Key Levels</h3>' +
      '<div class="levels-grid">';

    Object.keys(data).forEach(function (key) {
      var lvl = data[key];
      var name = lvl.instrument || key;
      html += '<div class="levels-card">' +
        '<div class="levels-instrument">' + HtmlUtils.esc(name) + '</div>';

      if (lvl.pivot) {
        html += '<div class="levels-row">' +
          '<span class="levels-label">Pivot</span>' +
          '<span class="levels-values levels-pivot">' + HtmlUtils.esc(lvl.pivot) + '</span>' +
        '</div>';
      }
      if (lvl.support && lvl.support.length > 0) {
        html += '<div class="levels-row">' +
          '<span class="levels-label">Support</span>' +
          '<span class="levels-values">' + lvl.support.map(HtmlUtils.esc).join(' &nbsp;|&nbsp; ') + '</span>' +
        '</div>';
      }
      if (lvl.resistance && lvl.resistance.length > 0) {
        html += '<div class="levels-row">' +
          '<span class="levels-label">Resistance</span>' +
          '<span class="levels-values">' + lvl.resistance.map(HtmlUtils.esc).join(' &nbsp;|&nbsp; ') + '</span>' +
        '</div>';
      }
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  },

  /* ---- Swing Setups ---- */
  swingSetups(setups) {
    if (!setups || setups.length === 0) return '';
    var cards = setups.map(function (s) {
      var dir = (s.direction || 'long').toLowerCase();
      return '<div class="setup-card ' + dir + '">' +
        '<div class="setup-header">' +
          '<span class="setup-symbol">' + HtmlUtils.esc(s.symbol) + '</span>' +
          '<span class="setup-direction ' + dir + '">' + HtmlUtils.esc(dir) + '</span>' +
        '</div>' +
        '<div class="setup-levels">' +
          '<div class="setup-level-item"><span class="setup-level-label">Entry</span>' +
            '<span class="setup-level-value">' + HtmlUtils.esc(s.entry) + '</span></div>' +
          '<div class="setup-level-item"><span class="setup-level-label">Target</span>' +
            '<span class="setup-level-value">' + HtmlUtils.esc(s.target) + '</span></div>' +
          '<div class="setup-level-item"><span class="setup-level-label">Stop Loss</span>' +
            '<span class="setup-level-value">' + HtmlUtils.esc(s.stopLoss) + '</span></div>' +
          '<div class="setup-level-item"><span class="setup-level-label">Timeframe</span>' +
            '<span class="setup-level-value">' + HtmlUtils.esc(s.timeframe) + '</span></div>' +
        '</div>' +
        (s.thesis ? '<div class="setup-thesis">' + HtmlUtils.esc(s.thesis) + '</div>' : '') +
        (s.confidence
          ? '<span class="setup-confidence ' + s.confidence + '">' +
              HtmlUtils.esc(s.confidence) + ' confidence</span>'
          : '') +
      '</div>';
    }).join('');

    return '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128161;</span> Swing Setups</h3>' +
      '<div class="setups-grid">' + cards + '</div>' +
    '</div>';
  },

  /* ---- Avoid List ---- */
  avoidList(items) {
    if (!items || items.length === 0) return '';
    var cards = items.map(function (item) {
      return '<div class="avoid-card">' +
        '<div class="avoid-icon">&#10005;</div>' +
        '<div>' +
          '<div class="avoid-symbol">' + HtmlUtils.esc(item.symbol) + '</div>' +
          '<div class="avoid-reason">' + HtmlUtils.esc(item.reason) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128683;</span> Avoid List</h3>' +
      '<div class="avoid-grid">' + cards + '</div>' +
    '</div>';
  },

  /* ---- News & Opportunities ---- */
  news(items) {
    if (!items || items.length === 0) return '';
    var cards = items.map(function (n) {
      var cls = HtmlUtils.sentimentClass(n.impact);
      return '<div class="news-card">' +
        '<div class="news-header">' +
          '<span class="news-title">' + HtmlUtils.esc(n.title) + '</span>' +
          '<span class="news-impact ' + cls + '">' + HtmlUtils.esc(n.impact) + '</span>' +
        '</div>' +
        '<p class="news-summary">' + HtmlUtils.esc(n.summary) + '</p>' +
      '</div>';
    }).join('');

    return '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128240;</span> Key News &amp; Opportunities</h3>' +
      '<div class="news-grid">' + cards + '</div>' +
    '</div>';
  },

  /* ---- Investor Plan ---- */
  investorPlan(data) {
    if (!data) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#127919;</span> Investor Plan</h3>';

    if (data.stance) {
      html += '<div class="stance-badge">' + HtmlUtils.esc(data.stance) + '</div>';
    }
    if (data.summary) {
      html += '<p class="section-summary">' + HtmlUtils.esc(data.summary) + '</p>';
    }

    if (data.actions && data.actions.length > 0) {
      html += '<div class="action-list">';
      data.actions.forEach(function (a) {
        var pCls = (a.priority || 'medium').toLowerCase();
        html += '<div class="action-item">' +
          '<span class="action-text">' + HtmlUtils.esc(a.action) + '</span>' +
          '<span class="action-priority ' + pCls + '">' + HtmlUtils.esc(a.priority) + '</span>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /* ---- Mutual Fund View ---- */
  mutualFundView(data) {
    if (!data) return '';
    var html = '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#128176;</span> Mutual Fund View</h3>';

    if (data.summary) {
      html += '<p class="section-summary">' + HtmlUtils.esc(data.summary) + '</p>';
    }

    if (data.recommendations && data.recommendations.length > 0) {
      html += '<div class="mf-grid">';
      data.recommendations.forEach(function (r) {
        var cls = HtmlUtils.sentimentClass(r.sentiment);
        html += '<div class="mf-row">' +
          '<div>' +
            '<div class="mf-category">' + HtmlUtils.esc(r.category) + '</div>' +
            '<div class="mf-action">' + HtmlUtils.esc(r.action) + '</div>' +
          '</div>' +
          '<span class="mf-sentiment ' + cls + '"></span>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /* ---- Do's and Don'ts ---- */
  dosAndDonts(data) {
    if (!data) return '';
    var hasDos = data.dos && data.dos.length > 0;
    var hasDonts = data.donts && data.donts.length > 0;
    if (!hasDos && !hasDonts) return '';

    var dosHtml = '';
    if (hasDos) {
      var dosItems = data.dos.map(function (d) {
        return '<li class="do-dont-item"><span class="do-dont-marker">&#10003;</span>' +
          HtmlUtils.esc(d) + '</li>';
      }).join('');
      dosHtml = '<div class="do-dont-column">' +
        '<div class="do-dont-heading do-heading">Do\'s</div>' +
        '<ul class="do-dont-list">' + dosItems + '</ul></div>';
    }

    var dontsHtml = '';
    if (hasDonts) {
      var dontItems = data.donts.map(function (d) {
        return '<li class="do-dont-item"><span class="do-dont-marker">&#10007;</span>' +
          HtmlUtils.esc(d) + '</li>';
      }).join('');
      dontsHtml = '<div class="do-dont-column">' +
        '<div class="do-dont-heading dont-heading">Don\'ts</div>' +
        '<ul class="do-dont-list">' + dontItems + '</ul></div>';
    }

    return '<div class="section-card">' +
      '<h3 class="section-title"><span class="icon">&#9989;</span> Do\'s &amp; Don\'ts</h3>' +
      '<div class="do-dont-grid">' + dosHtml + dontsHtml + '</div>' +
    '</div>';
  },

  /* ---- Sources ---- */
  sources(list) {
    if (!list || list.length === 0) return '';
    var tags = list.map(function (s) {
      return '<span class="source-tag">' + HtmlUtils.esc(s) + '</span>';
    }).join('');
    return '<h3 class="section-title" style="font-size:0.8rem;margin-bottom:0.5rem;">' +
      '<span class="icon">&#128218;</span> Sources</h3>' +
      '<ul class="sources-list">' + tags + '</ul>';
  },

  /* ---- Disclaimer ---- */
  disclaimer(text) {
    if (!text) return '';
    return '<p class="disclaimer-text">' + HtmlUtils.esc(text) + '</p>';
  },

  /* ================ Tab Assembly ================ */

  overviewTab(data) {
    var html = '';
    html += this.todayIn30Seconds(data.todayIn30Seconds);
    html += this.whatChanged(data.whatChanged);
    html += this.overviewMetrics(data.overview);
    if (!html) html = '<div class="empty-section">No overview data available for this report.</div>';
    return html;
  },

  marketsTab(data) {
    var html = '';
    html += this.globalMacro(data.globalMacro);
    html += this.indianMarket(data.indianMarket);
    html += this.marketRegime(data.marketRegime);
    html += this.sectorRotation(data.sectorRotation);
    html += this.breadth(data.breadth);
    html += this.keyLevels(data.keyLevels);
    if (!html) html = '<div class="empty-section">No market data available for this report.</div>';
    return html;
  },

  ideasTab(data) {
    var html = '';
    html += this.swingSetups(data.swingSetups);
    html += this.avoidList(data.avoidList);
    html += this.news(data.news);
    if (!html) html = '<div class="empty-section">No ideas to share in this report.</div>';
    return html;
  },

  planTab(data) {
    var html = '';
    html += this.investorPlan(data.investorPlan);
    html += this.mutualFundView(data.mutualFundView);
    html += this.dosAndDonts(data.dosAndDonts);
    if (!html) html = '<div class="empty-section">No plan data available for this report.</div>';
    return html;
  },
};
