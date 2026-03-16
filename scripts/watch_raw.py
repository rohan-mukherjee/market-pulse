#!/usr/bin/env python3
"""
Market Pulse — Raw Directory Watcher
Watches data/raw/ for new or modified .json files and automatically
triggers scripts/process_raw.py to keep data/reports/ up to date.

Usage:
    python scripts/watch_raw.py                  # poll every 10 seconds (default)
    python scripts/watch_raw.py --interval 30    # poll every 30 seconds
    python scripts/watch_raw.py --once           # process all unprocessed files and exit (CI mode)
"""

import argparse
import os
import subprocess
import sys
import time
from datetime import datetime


BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW_DIR    = os.path.join(BASE_DIR, 'data', 'raw')
REPORTS_DIR = os.path.join(BASE_DIR, 'data', 'reports')
PROCESS_SCRIPT = os.path.join('scripts', 'process_raw.py')


# ─── Helpers ──────────────────────────────────────────────────────────────────

def ts():
    """Return a formatted timestamp string for log lines."""
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def log(msg):
    print(f'[{ts()}] {msg}', flush=True)


def report_exists(raw_filename):
    """Return True if a processed report already exists for the given raw filename."""
    stem = os.path.splitext(raw_filename)[0]          # e.g. '2026-03-15'
    report_path = os.path.join(REPORTS_DIR, f'{stem}.json')
    return os.path.isfile(report_path)


def run_processor(force=False):
    """Invoke process_raw.py, optionally with --force."""
    cmd = [sys.executable, PROCESS_SCRIPT]
    if force:
        cmd.append('--force')
    label = ' '.join(cmd[1:])  # skip the interpreter path for display
    log(f'Running: {label}')
    result = subprocess.run(cmd, cwd=BASE_DIR)
    if result.returncode == 0:
        log(f'Processor finished successfully.')
    else:
        log(f'Processor exited with code {result.returncode}.')
    return result.returncode


def scan_raw_dir():
    """
    Return a dict of {filename: mtime} for all *.json files in RAW_DIR.
    Returns an empty dict if the directory does not exist yet.
    """
    if not os.path.isdir(RAW_DIR):
        return {}
    result = {}
    for entry in os.listdir(RAW_DIR):
        if entry.lower().endswith('.json'):
            full_path = os.path.join(RAW_DIR, entry)
            try:
                result[entry] = os.path.getmtime(full_path)
            except OSError:
                pass  # file disappeared between listdir and stat — skip it
    return result


# ─── Modes ────────────────────────────────────────────────────────────────────

def run_once():
    """
    Process any raw files that do not yet have a corresponding report, then exit.
    Useful for CI pipelines or one-shot invocations.
    """
    log('Mode: --once  (process unprocessed files and exit)')
    current = scan_raw_dir()
    if not current:
        log(f'No .json files found in {RAW_DIR}')
        return

    unprocessed = [f for f in current if not report_exists(f)]
    if not unprocessed:
        log('All raw files already have corresponding reports. Nothing to do.')
        return

    log(f'Found {len(unprocessed)} unprocessed file(s): {", ".join(sorted(unprocessed))}')
    run_processor(force=False)


def watch_loop(interval):
    """
    Continuously poll RAW_DIR every *interval* seconds.
    - New files (no matching report yet)  → run processor in delta mode
    - Modified files (mtime changed)      → run processor with --force
    """
    log(f'Mode: watch  (polling every {interval}s)')
    log(f'Watching: {RAW_DIR}')
    log('Press Ctrl+C to stop.')
    print('-' * 60, flush=True)

    known = scan_raw_dir()

    # Bootstrap: flag any file that already lacks a report so we process it
    # on the very first tick if it was added before the watcher started.
    for filename in list(known):
        if not report_exists(filename):
            log(f'Startup: unprocessed file detected — {filename}')
    # Run once at startup to catch anything that arrived while we were offline
    unprocessed_at_start = [f for f in known if not report_exists(f)]
    if unprocessed_at_start:
        log(f'Processing {len(unprocessed_at_start)} file(s) found at startup ...')
        run_processor(force=False)
        # Refresh known after processing so we do not immediately re-trigger
        known = scan_raw_dir()

    while True:
        time.sleep(interval)
        current = scan_raw_dir()

        new_files      = []
        modified_files = []

        for filename, mtime in current.items():
            if filename not in known:
                if not report_exists(filename):
                    new_files.append(filename)
                    log(f'New file detected: {filename}')
                else:
                    log(f'New file detected (report already exists, skipping): {filename}')
            elif mtime != known[filename]:
                modified_files.append(filename)
                log(f'Modified file detected: {filename}  (mtime changed)')

        if new_files:
            log(f'Triggering processor (delta mode) for {len(new_files)} new file(s) ...')
            run_processor(force=False)

        if modified_files:
            log(f'Triggering processor (--force) for {len(modified_files)} modified file(s) ...')
            run_processor(force=True)

        # Update our snapshot regardless so the next tick starts fresh
        known = current


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Watch data/raw/ for .json changes and auto-run process_raw.py'
    )
    parser.add_argument(
        '--once',
        action='store_true',
        help='Process all unprocessed raw files once and exit (useful for CI)'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=10,
        metavar='N',
        help='Polling interval in seconds (default: 10)'
    )
    args = parser.parse_args()

    print('=' * 60, flush=True)
    print(' Market Pulse — Raw Directory Watcher', flush=True)
    print(f' BASE_DIR : {BASE_DIR}', flush=True)
    print(f' RAW_DIR  : {RAW_DIR}', flush=True)
    print('=' * 60, flush=True)

    try:
        if args.once:
            run_once()
        else:
            watch_loop(args.interval)
    except KeyboardInterrupt:
        print(flush=True)
        log('Interrupted by user. Exiting.')


if __name__ == '__main__':
    main()
