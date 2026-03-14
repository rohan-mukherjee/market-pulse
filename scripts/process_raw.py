#!/usr/bin/env python3
"""
Market Pulse — Raw-to-Report Conversion Script
Converts raw daily research JSON files from data/raw/ into
renderer-ready report JSON files in data/reports/,
and updates data/manifest.json.

Usage:
    python scripts/process_raw.py            # delta processing (only new dates)
    python scripts/process_raw.py --force    # reprocess all dates
"""

import json
import os
import re
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW_DIR = os.path.join(BASE_DIR, 'data', 'raw')
REPORTS_DIR = os.path.join(BASE_DIR, 'data', 'reports')
MANIFEST_PATH = os.path.join(BASE_DIR, 'data', 'manifest.json')


# ─── Citation Stripping ───────────────────────────────────────────

CITE_RE = re.compile(r'\s*citeturn\d+(?:view|news|search)\d+(?:turn\d+(?:view|news|search)\d+)*')
PUA_RE  = re.compile(r'[\ue000-\uf8ff]')   # Unicode Private Use Area chars

def strip_citations(text):
    """Remove citation markers like citeturn18view0turn23news36.
    Raw files may contain invisible PUA Unicode chars (U+E200–E202) around citations;
    strip those first so the regex can match."""
    if not isinstance(text, str):
        return text
    # 1. Remove invisible PUA characters that wrap/split citation tokens
    cleaned = PUA_RE.sub('', text)
    # 2. Remove the citation tokens themselves
    cleaned = CITE_RE.sub('', cleaned)
    cleaned = re.sub(r'  +', ' ', cleaned).strip()
    return cleaned

def strip_deep(obj):
    """Recursively strip citations from all string values."""
    if isinstance(obj, str):
        return strip_citations(obj)
    elif isinstance(obj, list):
        return [strip_deep(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: strip_deep(v) for k, v in obj.items()}
    return obj


# ─── Sentiment Helpers ─────────────────────────────────────────────

def change_sentiment(change_str):
    """Derive sentiment from a change string like '-0.95%' or '+0.08%'."""
    if not change_str or not isinstance(change_str, str):
        return 'neutral'
    s = change_str.strip()
    if s.startswith('+'):
        return 'positive'
    elif s.startswith('-'):
        return 'negative'
    return 'neutral'

def direction_sentiment(direction, label=''):
    """Convert direction to sentiment, adjusting for 'bad up' metrics."""
    label_lower = label.lower()
    bad_up = any(x in label_lower for x in ['vix', 'crude', 'brent', 'usd/inr', 'dollar', 'wti', 'us 10y'])
    good_up = any(x in label_lower for x in ['dii', 'advance'])

    if direction == 'up':
        if bad_up:
            return 'negative'
        return 'positive'
    elif direction == 'down':
        if 'fii' in label_lower:
            return 'negative'
        return 'negative'
    return 'neutral'


# ─── Conversion Function ──────────────────────────────────────────

def convert(raw):
    """Convert a raw JSON object to renderer-ready report format."""
    raw = strip_deep(raw)

    md   = raw.get('metadata', {})
    hero = raw.get('hero', {})
    t30  = raw.get('todayIn30Seconds', {})
    chg  = raw.get('changedSinceYesterday', {})
    ovm  = raw.get('overviewMetrics', {})
    gm   = raw.get('globalMacro', {})
    ip   = raw.get('indiaPulse', {})
    reg  = raw.get('regime', {})
    sr   = raw.get('sectorRotation', {})
    bis  = raw.get('breadthInternalStrength', {})
    swr  = raw.get('swingRadar', {})
    dsi  = raw.get('directStockInvestorAngle', {})
    mfi  = raw.get('mutualFundInvestorAngle', {})
    dd   = raw.get('dosAndDonts', {})
    klt  = raw.get('keyLevelsAndTriggers', {})
    fbl  = raw.get('finalBottomLine', {})
    am   = raw.get('archiveMeta', {})
    ft   = raw.get('footer', {})

    report_date = md.get('reportDate', '')
    data_as_of  = md.get('dataAsOf', report_date)

    # ── meta ──
    mkt_status = md.get('marketStatus', 'closed')
    if 'closed' in mkt_status.lower():
        mkt_status = 'closed'
    elif 'open' in mkt_status.lower():
        mkt_status = 'open'

    subtitle = ''
    if data_as_of and data_as_of != report_date:
        subtitle = f'Weekend Edition (data as of {data_as_of})'
    elif hero.get('regime'):
        subtitle = hero['regime']

    # Convert "2026-03-14 16:19 IST" → "2026-03-14T16:19:00+05:30"
    last_upd = md.get('lastUpdated', '')
    if last_upd:
        last_upd = re.sub(
            r'(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*IST',
            r'\1T\2:00+05:30',
            last_upd,
        )

    meta = {
        'date': report_date,
        'title': 'Market Pulse Daily',
        'subtitle': subtitle,
        'marketStatus': mkt_status,
        'lastUpdated': last_upd,
        'author': 'Market Pulse Research',
    }

    # ── mood ──
    mood_label = hero.get('regime', '')
    mood_sent = 'negative'
    ll = mood_label.lower()
    if 'bullish' in ll and 'cautious' not in ll:
        mood_sent = 'positive'
    elif 'neutral' in ll:
        mood_sent = 'neutral'

    mood = {
        'label': mood_label,
        'sentiment': mood_sent,
        'pills': hero.get('moodPills', []),
    }

    # ── todayIn30Seconds (flat array of strings) ──
    today_items = []
    if t30.get('regime'):
        today_items.append(t30['regime'])
    if t30.get('investorStance'):
        today_items.append(t30['investorStance'])
    for d in t30.get('topDrivers', []):
        today_items.append(d)
    for a in t30.get('topActions', []):
        today_items.append(a)
    if t30.get('bottomLine'):
        today_items.append(t30['bottomLine'])

    # ── whatChanged ──
    what_changed = []
    for item in chg.get('items', []):
        old_v = item.get('oldValue', '')
        new_v = item.get('newValue', '')
        desc  = f"{old_v} \u2192 {new_v}"
        if item.get('comment'):
            desc += f". {item['comment']}"
        what_changed.append({
            'title': item.get('label', ''),
            'description': desc,
            'sentiment': direction_sentiment(item.get('direction', ''), item.get('label', '')),
        })

    # ── overview.metrics ──
    METRIC_MAP = [
        ('nifty',       'Nifty 50'),
        ('sensex',      'Sensex'),
        ('bankNifty',   'Bank Nifty'),
        ('midcap150',   'Nifty Midcap 150'),
        ('smallcap250', 'Nifty Smallcap 250'),
        ('indiaVix',    'India VIX'),
        ('usdInr',      'USD/INR'),
        ('fiiFlow',     'FII Net Flow'),
        ('diiFlow',     'DII Net Flow'),
    ]

    metrics = []
    for key, label in METRIC_MAP:
        m = ovm.get(key, {})
        if not m:
            continue
        val = str(m.get('value', ''))
        chg_pct = str(m.get('changePct', ''))

        # Determine sentiment per metric type
        if key == 'indiaVix':
            chg_pct = m.get('zone', chg_pct)
            try:
                num = float(re.sub(r'[^0-9.]', '', val) or '0')
                sent = 'negative' if num > 20 else 'neutral'
            except ValueError:
                sent = 'neutral'
        elif key == 'usdInr':
            sent = 'negative'
        elif key == 'fiiFlow':
            sent = 'negative' if '-' in val else 'positive'
        elif key == 'diiFlow':
            sent = 'positive' if '+' in val else 'negative'
        else:
            sent = change_sentiment(chg_pct)

        metrics.append({'label': label, 'value': val, 'change': chg_pct, 'sentiment': sent})

    overview = {'metrics': metrics}

    # ── globalMacro ──
    regions = []
    key_drivers = []

    # US
    us = gm.get('us', {})
    if us:
        for ik, iname in [('sp500','S&P 500'), ('nasdaq','Nasdaq'), ('dow','Dow Jones')]:
            idx = us.get(ik, {})
            if idx:
                regions.append({
                    'name': 'US', 'index': iname,
                    'value': str(idx.get('value','')),
                    'change': str(idx.get('changePct','')),
                    'sentiment': change_sentiment(str(idx.get('changePct',''))),
                    'note': '',
                })
        if us.get('indiaRelevance'):
            key_drivers.append(us['indiaRelevance'])

    # Asia
    asia = gm.get('asia', {})
    if asia:
        for ik, iname in [('nikkei','Nikkei 225'), ('hangSeng','Hang Seng'), ('shanghai','Shanghai Comp')]:
            idx = asia.get(ik, {})
            if idx:
                regions.append({
                    'name': 'Asia', 'index': iname,
                    'value': str(idx.get('value','')),
                    'change': str(idx.get('changePct','')),
                    'sentiment': change_sentiment(str(idx.get('changePct',''))),
                    'note': '',
                })
        if asia.get('indiaRelevance'):
            key_drivers.append(asia['indiaRelevance'])

    # Europe
    eu = gm.get('europe', {})
    if eu:
        for ik, iname in [('dax','DAX'), ('ftse','FTSE 100')]:
            idx = eu.get(ik, {})
            if idx:
                regions.append({
                    'name': 'Europe', 'index': iname,
                    'value': str(idx.get('value','')),
                    'change': str(idx.get('changePct','')),
                    'sentiment': change_sentiment(str(idx.get('changePct',''))),
                    'note': '',
                })
        if eu.get('indiaRelevance'):
            key_drivers.append(eu['indiaRelevance'])

    # Macro variables
    mv = gm.get('macroVariables', {})
    if mv:
        for vk, vname in [('dxy','Dollar Index (DXY)'), ('us10y','US 10Y Yield'),
                          ('brent','Brent Crude'), ('gold','Gold'), ('wti','WTI Crude')]:
            var = mv.get(vk, {})
            if var:
                sent = change_sentiment(str(var.get('changePct','')))
                # Invert for India-negative-on-rise metrics
                if vk in ('dxy','us10y','brent','wti'):
                    sent = 'negative' if sent == 'positive' else ('positive' if sent == 'negative' else sent)
                regions.append({
                    'name': 'Macro', 'index': vname,
                    'value': str(var.get('value','')),
                    'change': str(var.get('changePct','')),
                    'sentiment': sent,
                    'note': var.get('indiaRelevance', ''),
                })

    global_macro = {
        'summary': hero.get('mainDriver', ''),
        'regions': regions,
        'keyDrivers': key_drivers,
    }

    # ── indianMarket ──
    india_indices = []
    for key, label in [('nifty','Nifty 50'), ('sensex','Sensex'), ('bankNifty','Bank Nifty'),
                       ('midcap150','Midcap 150'), ('smallcap250','Smallcap 250')]:
        m = ovm.get(key, {})
        if m:
            india_indices.append({
                'name': label,
                'close': str(m.get('value','')),
                'change': str(m.get('changePct','')),
                'sentiment': change_sentiment(str(m.get('changePct',''))),
            })

    fii_v = str(ovm.get('fiiFlow', {}).get('value', ''))
    dii_v = str(ovm.get('diiFlow', {}).get('value', ''))

    highlights = []
    if ip.get('fact'):
        highlights.append(ip['fact'])
    if ip.get('interpretation'):
        highlights.append(ip['interpretation'])
    if ip.get('view'):
        highlights.append(ip['view'])
    for g in ip.get('topGainers', [])[:3]:
        highlights.append(f"Gainer: {g['name']} ({g.get('changePct','')}) — {g.get('sector','')}")
    for l in ip.get('topLosers', [])[:3]:
        highlights.append(f"Loser: {l['name']} ({l.get('changePct','')}) — {l.get('sector','')}")

    indian_market = {
        'summary': ip.get('marketType', ''),
        'indices': india_indices,
        'flows': {
            'fii': {'value': fii_v, 'sentiment': 'negative' if '-' in fii_v else 'positive'},
            'dii': {'value': dii_v, 'sentiment': 'positive' if '+' in dii_v else 'negative'},
        },
        'highlights': highlights,
    }

    # ── marketRegime ──
    regime_signals = []
    if reg.get('riskScore'):
        rs = reg['riskScore']
        regime_signals.append({
            'label': 'Risk Score',
            'value': f"{rs}/100",
            'sentiment': 'negative' if rs > 60 else ('neutral' if rs > 40 else 'positive'),
        })
    for w in reg.get('whatWorks', []):
        regime_signals.append({'label': 'What Works', 'value': w, 'sentiment': 'positive'})
    for f in reg.get('whatFails', []):
        regime_signals.append({'label': 'What Fails', 'value': f, 'sentiment': 'negative'})

    desc_parts = [p for p in [
        reg.get('fact',''), reg.get('interpretation',''), reg.get('view',''),
        ('Sizing: ' + reg['sizingNote']) if reg.get('sizingNote') else '',
    ] if p]

    market_regime = {
        'current': reg.get('label', ''),
        'description': ' '.join(desc_parts),
        'signals': regime_signals,
    }

    # ── sectorRotation ──
    sector_list = []
    for s in sr.get('sectors', []):
        perf = s.get('dayPerformance', '')
        stance = s.get('stance', '')
        sl = stance.lower()
        if any(x in sl for x in ['avoid','underweight']):
            sent = 'negative'
        elif any(x in sl for x in ['overweight','accumulate']):
            sent = 'positive'
        else:
            sent = 'neutral'
        sector_list.append({
            'name': s.get('sector',''),
            'note': f"{perf} | {s.get('comment','')}",
            'status': stance,
            'sentiment': sent,
        })

    sr_summary_parts = [p for p in [sr.get('fact',''), sr.get('interpretation','')] if p]
    sector_rotation = {
        'summary': ' '.join(sr_summary_parts),
        'sectors': sector_list,
    }

    # ── breadth ──
    breadth_indicators = []
    for lbl, key in [('Advance/Decline','advanceDecline'), ('Sector Breadth','sectorBreadth'),
                     ('Defensives Leading?','defensivesLeading'), ('Cyclicals Weak?','cyclicalsWeak'),
                     ('Buying Type','buyingType')]:
        val = bis.get(key, '')
        if val:
            s = 'negative'
            if key == 'defensivesLeading':
                s = 'positive' if val.lower().startswith('yes') else 'neutral'
            elif key == 'buyingType':
                s = 'neutral'
            breadth_indicators.append({'label': lbl, 'value': val, 'sentiment': s})

    breadth = {
        'summary': bis.get('summary', ''),
        'indicators': breadth_indicators,
    }

    # ── swingSetups ──
    swing_setups = []
    for setup in swr.get('setups', []):
        targets = setup.get('targets', [])
        target_str = ', '.join(targets) if isinstance(targets, list) else str(targets)
        conv = setup.get('conviction', 'medium').lower()
        if 'high' in conv:
            confidence = 'high'
        elif 'low' in conv:
            confidence = 'low'
        else:
            confidence = 'medium'

        thesis_parts = [p for p in [
            setup.get('technicalReason',''),
            setup.get('fundamentalTrigger',''),
            ('Invalidation: ' + setup['invalidation']) if setup.get('invalidation') else '',
            ('Sizing: ' + setup['positionSizeTone']) if setup.get('positionSizeTone') else '',
        ] if p]

        swing_setups.append({
            'symbol': setup.get('stock',''),
            'direction': 'long',
            'entry': setup.get('entryZone',''),
            'target': target_str,
            'stopLoss': setup.get('stopLoss',''),
            'timeframe': setup.get('timeframe',''),
            'thesis': ' '.join(thesis_parts),
            'confidence': confidence,
        })

    # ── avoidList ──
    avoid_list = [
        {'symbol': a.get('name',''), 'reason': a.get('reason','')}
        for a in swr.get('avoidList', [])
    ]

    # ── keyLevels ──
    key_levels = {}
    if klt.get('niftySupport') or klt.get('niftyResistance'):
        key_levels['nifty'] = {
            'instrument': 'Nifty 50',
            'support': [klt['niftySupport']] if klt.get('niftySupport') else [],
            'resistance': [klt['niftyResistance']] if klt.get('niftyResistance') else [],
        }
    if klt.get('bankNiftySupport') or klt.get('bankNiftyResistance'):
        key_levels['bankNifty'] = {
            'instrument': 'Bank Nifty',
            'support': [klt['bankNiftySupport']] if klt.get('bankNiftySupport') else [],
            'resistance': [klt['bankNiftyResistance']] if klt.get('bankNiftyResistance') else [],
        }
    if klt.get('vixKeyLevel'):
        key_levels['vix'] = {
            'instrument': 'India VIX',
            'pivot': klt['vixKeyLevel'],
            'support': [], 'resistance': [],
        }
    if klt.get('brentKeyLevel'):
        key_levels['brent'] = {
            'instrument': 'Brent Crude',
            'pivot': klt['brentKeyLevel'],
            'support': [], 'resistance': [],
        }
    if klt.get('usdInrKeyLevel'):
        key_levels['usdInr'] = {
            'instrument': 'USD/INR',
            'pivot': klt['usdInrKeyLevel'],
            'support': [], 'resistance': [],
        }
    impr = klt.get('improvingTriggers', [])
    wors = klt.get('worseningTriggers', [])
    if impr or wors:
        key_levels['triggers'] = {
            'instrument': 'Market Triggers',
            'support': impr,
            'resistance': wors,
        }

    # ── investorPlan ──
    inv_actions = []
    for b in dsi.get('buckets', []):
        sl = b.get('stance','').lower()
        if any(x in sl for x in ['avoid','underweight','reduce','trim']):
            prio = 'high'
        elif any(x in sl for x in ['accumulate','overweight','add']):
            prio = 'low'
        else:
            prio = 'medium'
        inv_actions.append({
            'action': f"{b.get('bucket','')}: {b.get('stance','')}. {b.get('comment','')}",
            'priority': prio,
        })

    inv_summary_parts = [p for p in [dsi.get('fact',''), dsi.get('interpretation',''), dsi.get('view','')] if p]
    investor_plan = {
        'stance': hero.get('stance', ''),
        'summary': ' '.join(inv_summary_parts),
        'actions': inv_actions,
    }

    # ── mutualFundView ──
    mf_recs = []
    for cat in mfi.get('categories', []):
        stance = cat.get('stance','')
        sl = stance.lower()
        if any(x in sl for x in ['avoid','cautious','no fresh']):
            sent = 'negative'
        elif any(x in sl for x in ['accumulate','hold','sip','add']):
            sent = 'positive'
        else:
            sent = 'neutral'
        mf_recs.append({
            'category': cat.get('category',''),
            'action': f"{stance}. {cat.get('comment','')}",
            'sentiment': sent,
        })

    mf_summary_parts = [p for p in [
        mfi.get('sip',''), mfi.get('lumpsum',''),
        ('Dry powder: ' + mfi['dryPowder']) if mfi.get('dryPowder') else '',
    ] if p]

    mutual_fund_view = {
        'summary': ' '.join(mf_summary_parts),
        'recommendations': mf_recs,
    }

    # ── dosAndDonts ──
    dos_donts = {
        'dos': dd.get('dos', []),
        'donts': dd.get('donts', []),
    }

    # ── news (from finalBottomLine) ──
    news = []
    if fbl.get('investorConclusion'):
        news.append({'title': 'Investor Bottom Line', 'summary': fbl['investorConclusion'], 'impact': 'neutral'})
    if fbl.get('swingTraderConclusion'):
        news.append({'title': 'Swing Trader Bottom Line', 'summary': fbl['swingTraderConclusion'], 'impact': 'neutral'})
    if fbl.get('mfConclusion'):
        news.append({'title': 'MF Investor Bottom Line', 'summary': fbl['mfConclusion'], 'impact': 'neutral'})

    # ── sources ──
    sources = ft.get('sourceContext', [])

    # ── disclaimer ──
    disclaimer = ft.get('disclaimer',
        'This report is for educational and informational purposes only. '
        'It does not constitute investment advice. '
        'Always consult a qualified financial advisor before making investment decisions.')

    # ── Assemble report ──
    report = {
        'meta': meta,
        'mood': mood,
        'todayIn30Seconds': today_items,
        'whatChanged': what_changed,
        'overview': overview,
        'globalMacro': global_macro,
        'indianMarket': indian_market,
        'marketRegime': market_regime,
        'sectorRotation': sector_rotation,
        'breadth': breadth,
        'swingSetups': swing_setups,
        'avoidList': avoid_list,
        'keyLevels': key_levels,
        'investorPlan': investor_plan,
        'mutualFundView': mutual_fund_view,
        'dosAndDonts': dos_donts,
        'news': news,
        'sources': sources,
        'disclaimer': disclaimer,
    }

    return report, am, hero


def build_manifest_entry(report, archive_meta, hero, report_date):
    """Build a manifest entry combining renderer-required + enriched fields."""
    meta = report['meta']
    mood = report['mood']
    return {
        'date': report_date,
        'file': f"{report_date}.json",
        'title': meta.get('title', 'Market Pulse Daily'),
        'subtitle': meta.get('subtitle', ''),
        'mood': mood.get('label', ''),
        'marketStatus': meta.get('marketStatus', 'closed'),
        'regime': hero.get('regime', ''),
        'stance': hero.get('stance', ''),
        'mainDriver': hero.get('mainDriver', ''),
        'summary': archive_meta.get('summary', ''),
        'tags': archive_meta.get('tags', []),
    }


# ─── Main ─────────────────────────────────────────────────────────

def main():
    force = '--force' in sys.argv

    # Discover raw files
    raw_files = sorted([f for f in os.listdir(RAW_DIR) if f.endswith('.json')])
    raw_dates = [f.replace('.json', '') for f in raw_files]

    # Discover already-processed reports
    existing = [f.replace('.json', '') for f in os.listdir(REPORTS_DIR)
                if f.endswith('.json') and f != '_template.json']

    # Delta
    if force:
        to_process = raw_dates[:]
    else:
        to_process = [d for d in raw_dates if d not in existing]

    print(f"Raw dates found     : {', '.join(raw_dates)}")
    print(f"Already processed   : {', '.join(existing) if existing else 'None'}")
    print(f"To process          : {', '.join(to_process) if to_process else 'None'}")

    if not to_process:
        print("\nNothing to process!")
        return

    # Load existing manifest
    manifest = {
        'site': {
            'name': 'Market Pulse',
            'tagline': 'Daily Market Intelligence',
            'author': 'Market Pulse Research',
        },
        'reports': [],
    }
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, 'r', encoding='utf-8') as fh:
            manifest = json.load(fh)

    new_entries = []

    for date_str in to_process:
        raw_path = os.path.join(RAW_DIR, f"{date_str}.json")
        out_path = os.path.join(REPORTS_DIR, f"{date_str}.json")

        print(f"\n--- Processing {date_str} ---")

        with open(raw_path, 'r', encoding='utf-8') as fh:
            raw = json.load(fh)

        report, archive_meta, hero = convert(raw)

        with open(out_path, 'w', encoding='utf-8') as fh:
            json.dump(report, fh, indent=2, ensure_ascii=False)

        print(f"  Created: {out_path}")
        print(f"  Sections: {len([k for k,v in report.items() if v])}")
        print(f"  Swing setups: {len(report['swingSetups'])}")
        print(f"  Avoid list: {len(report['avoidList'])}")

        entry = build_manifest_entry(report, archive_meta, hero, date_str)
        new_entries.append(entry)

    # ── Update manifest ──
    # Keep valid existing entries
    valid = []
    for r in manifest.get('reports', []):
        rd = r.get('date', '')
        if rd and os.path.exists(os.path.join(REPORTS_DIR, f"{rd}.json")):
            valid.append(r)

    # Merge (new entries overwrite same dates)
    all_entries = {e['date']: e for e in valid}
    for e in new_entries:
        all_entries[e['date']] = e

    sorted_entries = sorted(all_entries.values(), key=lambda x: x['date'], reverse=True)

    manifest['reports'] = sorted_entries
    manifest['latestReport'] = sorted_entries[0]['date'] if sorted_entries else ''

    with open(MANIFEST_PATH, 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)

    print(f"\nManifest updated: {MANIFEST_PATH}")

    # ── Summary Report ──
    skipped = [d for d in raw_dates if d not in to_process]
    print("\n" + "=" * 56)
    print("  PROCESSING SUMMARY")
    print("=" * 56)
    print(f"  Raw dates found       : {', '.join(raw_dates)}")
    print(f"  Previously processed  : {', '.join(existing) if existing else 'None'}")
    print(f"  Newly processed       : {', '.join(to_process)}")
    print(f"  Files created         : {len(to_process)} report(s)")
    print(f"  Files updated         : manifest.json")
    print(f"  Dates skipped         : {', '.join(skipped) if skipped else 'None'}")
    print(f"  Total in manifest     : {len(sorted_entries)}")
    print("=" * 56)

    # Validation notes
    print("\n  Swing setup validation:")
    for date_str in to_process:
        rp = os.path.join(REPORTS_DIR, f"{date_str}.json")
        with open(rp, 'r', encoding='utf-8') as fh:
            rpt = json.load(fh)
        for s in rpt.get('swingSetups', []):
            line = (f"    [{date_str}] {s['symbol']}: entry={s['entry']}, SL={s['stopLoss']}, "
                    f"target={s['target']}, tf={s['timeframe']}, confidence={s['confidence']}")
            print(line.encode('ascii', 'replace').decode('ascii'))

    print("\n  Done.\n")


if __name__ == '__main__':
    main()
