#!/usr/bin/env python3
"""
Analysis worker — polls analysis_jobs from PostgreSQL and processes them.

Run as a standalone process:
    python worker.py

Environment variables:
    DATABASE_URL            — PostgreSQL connection string (same as Prisma)
    DO_SPACES_KEY           — DigitalOcean Spaces access key
    DO_SPACES_SECRET        — DigitalOcean Spaces secret key
    DO_SPACES_ENDPOINT      — e.g. https://lon1.digitaloceanspaces.com
    DO_SPACES_BUCKET        — Bucket name
    DO_SPACES_CDN_URL       — (optional) CDN base URL
    BROWSER_RESTART_EVERY   — Jobs before browser restart (default: 75)
"""

import json
import os
import signal
import socket
import sys
import time
import shutil
from datetime import datetime, timezone

# Ensure the web-analyzer package root is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.scraper import WebScraper, AnalysisError, SiteDownError, SiteTimeoutError, SiteBlockedError
from utils.storage import SpacesUploader
from utils.db import get_connection

from analyzer.technology import analyze_technology
from analyzer.design import analyze_design
from analyzer.performance import analyze_performance
from analyzer.responsive import analyze_responsive
from analyzer.seo import analyze_seo
from analyzer.content import analyze_content
from analyzer.technical import analyze_technical
from analyzer.business import analyze_business
from analyzer.scoring import calculate_prospect_score


# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------

def log(level: str, msg: str, **extra):
    """Emit a structured JSON log line to stdout."""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "msg": msg,
        **extra,
    }
    print(json.dumps(entry, default=str), flush=True)


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

class AnalysisWorker:
    """Polls analysis_jobs and processes them one at a time."""

    POLL_QUERY = """
        SELECT *
        FROM "AnalysisJob"
        WHERE status = 'PENDING'
        ORDER BY "createdAt"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    """

    def __init__(self):
        self.playwright = None
        self.browser = None
        self.uploader = SpacesUploader()
        self.hostname = socket.gethostname()
        self.jobs_processed = 0
        self.max_jobs_before_restart = int(os.environ.get('BROWSER_RESTART_EVERY', '75'))
        self.shutdown_requested = False
        self.idle_cycles = 0
        self.orphan_check_every = 20  # every ~60s when idle (20 * 3s sleep)

    # ---- lifecycle --------------------------------------------------------

    def run(self):
        """Main entry point — setup, loop, shutdown."""
        self._register_signals()
        self._reclaim_orphaned_jobs()
        self._start_browser()
        log("info", "Worker started", hostname=self.hostname)

        try:
            while not self.shutdown_requested:
                job = self._poll_job()
                if job is None:
                    self.idle_cycles += 1
                    if self.idle_cycles % self.orphan_check_every == 0:
                        self._reclaim_orphaned_jobs()
                    time.sleep(3)
                    continue

                self.idle_cycles = 0
                self._process_job(job)
                self.jobs_processed += 1
                self._maybe_restart_browser()
        except Exception as e:
            log("error", "Worker loop crashed", error=str(e))
        finally:
            self._shutdown()

    def _register_signals(self):
        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)

    def _handle_signal(self, signum, frame):
        log("info", "Shutdown signal received", signal=signum)
        self.shutdown_requested = True

    def _start_browser(self):
        from playwright.sync_api import sync_playwright
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=True)
        log("info", "Browser started")

    def _stop_browser(self):
        if self.browser:
            try:
                self.browser.close()
            except Exception:
                pass
            self.browser = None
        if self.playwright:
            try:
                self.playwright.stop()
            except Exception:
                pass
            self.playwright = None

    def _maybe_restart_browser(self):
        if self.jobs_processed > 0 and self.jobs_processed % self.max_jobs_before_restart == 0:
            log("info", "Restarting browser", jobs_processed=self.jobs_processed)
            self._stop_browser()
            self._start_browser()

    def _shutdown(self):
        log("info", "Shutting down", jobs_processed=self.jobs_processed)
        self._stop_browser()

    # ---- job polling ------------------------------------------------------

    def _poll_job(self):
        """Claim the next pending job, or return None."""
        conn = get_connection()
        try:
            conn.autocommit = False
            with conn.cursor() as cur:
                cur.execute(self.POLL_QUERY)
                row = cur.fetchone()
                if row is None:
                    conn.commit()
                    return None

                now = datetime.now(timezone.utc)
                cur.execute(
                    """
                    UPDATE "AnalysisJob"
                    SET status = 'RUNNING',
                        "startedAt" = %s,
                        "lockedAt" = %s,
                        "lockedBy" = %s,
                        attempts = attempts + 1
                    WHERE id = %s
                    """,
                    (now, now, self.hostname, row['id']),
                )
                conn.commit()
                # Re-read to get updated values
                row['status'] = 'RUNNING'
                row['attempts'] = (row.get('attempts') or 0) + 1
                return row
        except Exception as e:
            conn.rollback()
            log("error", "Poll failed", error=str(e))
            return None
        finally:
            conn.close()

    # ---- job update -------------------------------------------------------

    def _update_job(self, job_id: str, **fields):
        """Update arbitrary fields on an analysis job."""
        if not fields:
            return
        set_clauses = []
        values = []
        for key, val in fields.items():
            set_clauses.append(f'"{key}" = %s')
            values.append(val)
        values.append(job_id)

        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f'UPDATE "AnalysisJob" SET {", ".join(set_clauses)} WHERE id = %s',
                    values,
                )
            conn.commit()
        except Exception as e:
            conn.rollback()
            log("error", "Job update failed", job_id=job_id, error=str(e))
        finally:
            conn.close()

    def _update_prospect(self, prospect_id: str, **fields):
        """Update fields on the linked Prospect row."""
        if not fields or not prospect_id:
            return
        set_clauses = []
        values = []
        for key, val in fields.items():
            set_clauses.append(f'"{key}" = %s')
            values.append(val)
        values.append(prospect_id)

        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f'UPDATE "Prospect" SET {", ".join(set_clauses)} WHERE id = %s',
                    values,
                )
            conn.commit()
        except Exception as e:
            conn.rollback()
            log("error", "Prospect update failed", prospect_id=prospect_id, error=str(e))
        finally:
            conn.close()

    # ---- orphan reclaim ---------------------------------------------------

    def _reclaim_orphaned_jobs(self):
        """Reset RUNNING jobs with stale locks back to PENDING."""
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE "AnalysisJob"
                    SET status = 'PENDING',
                        "lockedAt" = NULL,
                        "lockedBy" = NULL,
                        "currentStep" = NULL
                    WHERE status = 'RUNNING'
                      AND "lockedAt" < NOW() - INTERVAL '10 minutes'
                """)
                reclaimed = cur.rowcount
            conn.commit()
            if reclaimed > 0:
                log("info", "Reclaimed orphaned jobs", count=reclaimed)
        except Exception as e:
            conn.rollback()
            log("error", "Orphan reclaim failed", error=str(e))
        finally:
            conn.close()

    # ---- job processing ---------------------------------------------------

    def _process_job(self, job):
        job_id = job['id']
        url = job['url']
        prospect_id = job.get('prospectId')
        max_attempts = job.get('maxAttempts') or 3

        log("info", "Processing job", job_id=job_id, url=url, attempt=job['attempts'])

        scraper = WebScraper(timeout=45, browser=self.browser)
        tmp_dir = None

        try:
            # Step 1: Fetch with capture
            self._update_job(job_id, currentStep='fetching')
            fetch_result = scraper.fetch_with_capture(url)

            if fetch_result.get('error') and not fetch_result.get('soup'):
                raise RuntimeError(fetch_result['error'])

            soup = fetch_result.get('soup')
            html = fetch_result.get('html', '')
            load_time = fetch_result.get('load_time', 0)
            headers = fetch_result.get('headers', {})
            final_url = fetch_result.get('final_url', url)
            js_errors = fetch_result.get('js_errors', [])
            screenshots_local = fetch_result.get('screenshots', {})
            extracted_assets = fetch_result.get('extracted_assets', {})

            if not soup or not html:
                raise RuntimeError('Failed to parse page content')

            # Step 2: Get resources
            resources = scraper.get_resources(soup, final_url)

            # Step 3-10: Run analyzers
            def run_step(step_name, fn, *args):
                self._update_job(job_id, currentStep=step_name)
                try:
                    return fn(*args)
                except Exception as e:
                    return {"error": str(e)}

            technology = run_step('analyzing_technology', analyze_technology, soup, html, resources)
            design = run_step('analyzing_design', analyze_design, soup, html)
            performance = run_step('analyzing_performance', analyze_performance, final_url, soup, html, resources, load_time)
            responsive = run_step('analyzing_responsive', analyze_responsive, soup, html)
            seo = run_step('analyzing_seo', analyze_seo, final_url, soup, html, headers)
            content_result = run_step('analyzing_content', analyze_content, final_url, soup, html)
            technical = run_step('analyzing_technical', analyze_technical, final_url, soup, html, js_errors, False)
            business = run_step('analyzing_business', analyze_business, final_url, soup, html, content_result)

            scoring = run_step('calculating_score', calculate_prospect_score,
                               technology, design, performance, responsive,
                               seo, content_result, technical, business)

            # Build result JSON
            analysis_result = {
                "url": final_url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "error": None,
                "technology": technology,
                "design": design,
                "performance": performance,
                "responsive": responsive,
                "seo": seo,
                "content": content_result,
                "technical": technical,
                "business": business,
                "scoring": scoring,
                "extracted_assets": extracted_assets,
            }

            # Step 11: Upload screenshots
            screenshot_urls = {}
            if screenshots_local:
                self._update_job(job_id, currentStep='uploading_screenshots')
                try:
                    screenshot_urls = self.uploader.upload_screenshots(job_id, screenshots_local)
                except Exception as e:
                    log("warn", "Screenshot upload failed", job_id=job_id, error=str(e))

            # Clean up tmp directory
            for path in screenshots_local.values():
                if path:
                    parent = os.path.dirname(path)
                    if parent and parent.startswith('/tmp/analysis_'):
                        tmp_dir = parent
                        break
            if tmp_dir and os.path.isdir(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)

            # Step 12: Mark done
            prospect_score = scoring.get('total_score') if isinstance(scoring, dict) else None

            now = datetime.now(timezone.utc)
            self._update_job(
                job_id,
                status='DONE',
                currentStep=None,
                result=json.dumps(analysis_result),
                screenshots=json.dumps(screenshot_urls) if screenshot_urls else None,
                prospectScore=prospect_score,
                finishedAt=now,
                errorMessage=None,
            )

            # Update Prospect with analysis data
            if prospect_id:
                extra = {}
                # Auto-populate contact fields if empty
                emails = content_result.get('emails', []) if isinstance(content_result, dict) else []
                social = content_result.get('social_media', {}) if isinstance(content_result, dict) else {}

                self._update_prospect(
                    prospect_id,
                    webAnalysis=json.dumps(analysis_result),
                    webAnalysisScore=prospect_score,
                    webAnalysisCategory=scoring.get('category') if isinstance(scoring, dict) else None,
                    webAnalyzedAt=now,
                )

                # Populate empty contact fields
                if emails or social:
                    conn = get_connection()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                'SELECT "contactEmail", "facebookUrl", "instagramUrl" FROM "Prospect" WHERE id = %s',
                                (prospect_id,),
                            )
                            current = cur.fetchone()
                        conn.commit()
                    finally:
                        conn.close()

                    if current:
                        updates = {}
                        if not current.get('contactEmail') and emails:
                            updates['contactEmail'] = emails[0]
                        if not current.get('facebookUrl') and social.get('facebook'):
                            fb = social['facebook']
                            updates['facebookUrl'] = fb if fb.startswith('http') else f'https://{fb}'
                        if not current.get('instagramUrl') and social.get('instagram'):
                            ig = social['instagram']
                            updates['instagramUrl'] = ig if ig.startswith('http') else f'https://{ig}'
                        if updates:
                            self._update_prospect(prospect_id, **updates)

            log("info", "Job completed", job_id=job_id, score=prospect_score)

        except (SiteDownError, SiteTimeoutError) as e:
            # Retryable errors
            if job['attempts'] < max_attempts:
                log("warn", "Retryable error, re-queuing", job_id=job_id, error=str(e), attempts=job['attempts'])
                self._update_job(job_id, status='PENDING', currentStep=None, errorMessage=str(e))
            else:
                log("error", "Max retries exceeded", job_id=job_id, error=str(e))
                self._update_job(
                    job_id,
                    status='FAILED',
                    currentStep=None,
                    errorMessage=str(e),
                    finishedAt=datetime.now(timezone.utc),
                )

        except SiteBlockedError as e:
            log("warn", "Site blocked (not retryable)", job_id=job_id, error=str(e))
            self._update_job(
                job_id,
                status='FAILED',
                currentStep=None,
                errorMessage=str(e),
                finishedAt=datetime.now(timezone.utc),
            )

        except Exception as e:
            log("error", "Job failed", job_id=job_id, error=str(e))
            self._update_job(
                job_id,
                status='FAILED',
                currentStep=None,
                errorMessage=str(e),
                finishedAt=datetime.now(timezone.utc),
            )

        finally:
            # Cleanup temp dir if still around
            if tmp_dir and os.path.isdir(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    worker = AnalysisWorker()
    worker.run()
