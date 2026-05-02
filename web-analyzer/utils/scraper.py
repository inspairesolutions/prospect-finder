"""
Web scraping utilities with requests, BeautifulSoup, and Playwright support.
"""

import os
import time
import re
import uuid
from typing import Optional, Dict, List, Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


# ---------------------------------------------------------------------------
# Custom exceptions for error classification
# ---------------------------------------------------------------------------

class AnalysisError(Exception):
    """Base error for analysis failures."""
    retryable = False

class SiteDownError(AnalysisError):
    """DNS failure, connection refused, etc."""
    retryable = True

class SiteTimeoutError(AnalysisError):
    """Page load or navigation timeout."""
    retryable = True

class SiteBlockedError(AnalysisError):
    """403, Cloudflare challenge, bot detection."""
    retryable = False


# ---------------------------------------------------------------------------
# Cookie banner selectors — tried in order, failures are silently ignored
# ---------------------------------------------------------------------------

COOKIE_DISMISS_SELECTORS = [
    '#onetrust-accept-btn-handler',
    '.onetrust-close-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '[data-cookiefirst-action="accept"]',
    '#cookie-accept',
    '#accept-cookies',
    '#acceptCookies',
    '.cc-accept',
    '.cc-btn.cc-dismiss',
    '[class*="cookie"] button[class*="accept"]',
    '[class*="cookie"] button[class*="agree"]',
    '[class*="consent"] button[class*="accept"]',
    '[class*="consent"] button[class*="agree"]',
    '[id*="cookie"] button',
    '[aria-label*="accept cookie"]',
    '[aria-label*="Accept cookie"]',
    'button[data-gdpr="accept"]',
]


class RateLimiter:
    """Simple rate limiter to respect servers."""

    def __init__(self, max_requests_per_second: float = 5.0):
        self.min_interval = 1.0 / max_requests_per_second
        self.last_request_time = 0.0

    def wait(self):
        """Wait if necessary to respect rate limit."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request_time = time.time()


class WebScraper:
    """Web scraper with static and dynamic content support."""

    DEFAULT_USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    DESKTOP_VIEWPORT = {"width": 1440, "height": 900}
    MOBILE_VIEWPORT = {"width": 390, "height": 844}
    MOBILE_USER_AGENT = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
        "Mobile/15E148 Safari/604.1"
    )

    def __init__(
        self,
        timeout: int = 30,
        max_requests_per_second: float = 5.0,
        user_agent: Optional[str] = None,
        respect_robots: bool = True,
        browser=None,
    ):
        self.timeout = timeout
        self.rate_limiter = RateLimiter(max_requests_per_second)
        self.user_agent = user_agent or self.DEFAULT_USER_AGENT
        self.respect_robots = respect_robots
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        })
        # If a Playwright browser is injected, use it (worker mode).
        # Otherwise fall back to launching one on demand (CLI mode).
        self._external_browser = browser is not None
        self._browser = browser
        self._playwright = None
        self.bs_parser = self._resolve_bs_parser()

    def _resolve_bs_parser(self) -> str:
        """Prefer lxml, fallback to built-in html.parser if unavailable."""
        try:
            BeautifulSoup("<html></html>", "lxml")
            return "lxml"
        except Exception:
            return "html.parser"

    # ------------------------------------------------------------------
    # Static fetch (requests)
    # ------------------------------------------------------------------

    def fetch_html(self, url: str) -> Dict[str, Any]:
        """
        Fetch HTML content using requests (for static content).

        Returns dict with:
            - html: raw HTML content
            - soup: BeautifulSoup object
            - status_code: HTTP status code
            - headers: response headers
            - load_time: time to fetch in seconds
            - final_url: URL after redirects
            - error: error message if any
        """
        self.rate_limiter.wait()

        result = {
            "html": None,
            "soup": None,
            "status_code": None,
            "headers": {},
            "load_time": 0,
            "final_url": url,
            "error": None
        }

        try:
            start_time = time.time()
            response = self.session.get(
                url,
                timeout=self.timeout,
                allow_redirects=True
            )
            result["load_time"] = time.time() - start_time
            result["status_code"] = response.status_code
            result["headers"] = dict(response.headers)
            result["final_url"] = response.url

            if response.status_code == 200:
                result["html"] = response.text
                result["soup"] = BeautifulSoup(response.text, self.bs_parser)
            else:
                result["error"] = f"HTTP {response.status_code}"

        except requests.exceptions.Timeout:
            result["error"] = "Request timed out"
        except requests.exceptions.ConnectionError as e:
            result["error"] = f"Connection error: {str(e)}"
        except requests.exceptions.RequestException as e:
            result["error"] = f"Request failed: {str(e)}"

        return result

    # ------------------------------------------------------------------
    # Dynamic fetch (Playwright)
    # ------------------------------------------------------------------

    def _ensure_browser(self):
        """Ensure a Playwright browser is available."""
        if self._browser:
            return
        from playwright.sync_api import sync_playwright
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=True)

    def _release_browser(self):
        """Release browser only if we own it (not injected)."""
        if self._external_browser:
            return
        if self._browser:
            try:
                self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright:
            try:
                self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    def fetch_dynamic(self, url: str, wait_for: str = "load") -> Dict[str, Any]:
        """
        Fetch content using Playwright (for JavaScript-rendered pages).

        Args:
            url: URL to fetch
            wait_for: Wait condition - "load", "domcontentloaded", or "networkidle"

        Returns dict with same structure as fetch_html plus:
            - js_errors: list of JavaScript errors
            - console_logs: list of console messages
        """
        result = {
            "html": None,
            "soup": None,
            "status_code": None,
            "headers": {},
            "load_time": 0,
            "final_url": url,
            "error": None,
            "js_errors": [],
            "console_logs": []
        }

        try:
            self._ensure_browser()
            start_time = time.time()

            context = self._browser.new_context(
                user_agent=self.user_agent,
                viewport={"width": 1920, "height": 1080}
            )
            page = context.new_page()

            # Collect JS errors and console logs
            page.on("pageerror", lambda e: result["js_errors"].append(str(e)))
            page.on("console", lambda m: result["console_logs"].append({
                "type": m.type,
                "text": m.text
            }))

            response = page.goto(
                url,
                timeout=self.timeout * 1000,
                wait_until=wait_for
            )

            result["load_time"] = time.time() - start_time
            result["status_code"] = response.status if response else None
            result["headers"] = response.headers if response else {}
            result["final_url"] = page.url
            result["html"] = page.content()
            result["soup"] = BeautifulSoup(result["html"], self.bs_parser)

            context.close()

        except ImportError:
            result["error"] = "Playwright not installed. Run: playwright install chromium"
        except Exception as e:
            result["error"] = f"Playwright error: {str(e)}"
        finally:
            self._release_browser()

        return result

    # ------------------------------------------------------------------
    # fetch_with_capture — full fetch + screenshots + asset extraction
    # ------------------------------------------------------------------

    def fetch_with_capture(self, url: str) -> Dict[str, Any]:
        """
        Fetch page content with Playwright, take screenshots, and extract assets.

        Requires a Playwright browser (injected or auto-launched).

        Returns dict with:
            - html, soup, status_code, headers, load_time, final_url, error
            - js_errors, console_logs
            - screenshots: dict with local paths for desktop_full, desktop_viewport, mobile_full
            - extracted_assets: dict with logo_candidate (URL|None) and key_images (list of URLs)
        """
        capture_id = uuid.uuid4().hex[:12]
        tmp_dir = os.path.join('/tmp', f'analysis_{capture_id}')
        os.makedirs(tmp_dir, exist_ok=True)

        result = {
            "html": None,
            "soup": None,
            "status_code": None,
            "headers": {},
            "load_time": 0,
            "final_url": url,
            "error": None,
            "js_errors": [],
            "console_logs": [],
            "screenshots": {},
            "extracted_assets": {
                "logo_candidate": None,
                "key_images": [],
            },
        }

        context = None
        try:
            self._ensure_browser()

            # --- Desktop context ---
            context = self._browser.new_context(
                user_agent=self.user_agent,
                viewport=self.DESKTOP_VIEWPORT,
            )
            page = context.new_page()

            page.on("pageerror", lambda e: result["js_errors"].append(str(e)))
            page.on("console", lambda m: result["console_logs"].append({
                "type": m.type,
                "text": m.text,
            }))

            # Navigate with networkidle, fallback to domcontentloaded
            start_time = time.time()
            response = None
            try:
                response = page.goto(url, timeout=45000, wait_until="networkidle")
            except Exception:
                try:
                    response = page.goto(url, timeout=45000, wait_until="domcontentloaded")
                except Exception as nav_err:
                    err_msg = str(nav_err).lower()
                    if 'net::err_name_not_resolved' in err_msg or 'net::err_connection_refused' in err_msg:
                        raise SiteDownError(f"Site unreachable: {nav_err}")
                    elif 'timeout' in err_msg:
                        raise SiteTimeoutError(f"Navigation timeout: {nav_err}")
                    else:
                        raise

            result["load_time"] = time.time() - start_time

            # Check for blocking responses
            if response:
                result["status_code"] = response.status
                result["headers"] = response.headers
                if response.status == 403:
                    raise SiteBlockedError(f"Access denied (HTTP 403)")
                if response.status >= 500:
                    raise SiteDownError(f"Server error (HTTP {response.status})")

            result["final_url"] = page.url

            # Dismiss cookie banners
            self._dismiss_cookie_banners(page)

            # Small delay for banner animations to complete
            page.wait_for_timeout(500)

            # --- Desktop screenshots ---
            try:
                vp_path = os.path.join(tmp_dir, 'desktop_viewport.png')
                page.screenshot(path=vp_path)
                result["screenshots"]["desktop_viewport"] = vp_path
            except Exception:
                pass

            try:
                full_path = os.path.join(tmp_dir, 'desktop_full.png')
                page.screenshot(path=full_path, full_page=True)
                result["screenshots"]["desktop_full"] = full_path
            except Exception:
                pass

            # --- Extract HTML & parse ---
            result["html"] = page.content()
            result["soup"] = BeautifulSoup(result["html"], self.bs_parser)

            # --- Extract assets from DOM ---
            result["extracted_assets"] = self._extract_assets(page, url)

            context.close()
            context = None

            # --- Mobile screenshot ---
            mobile_ctx = None
            try:
                mobile_ctx = self._browser.new_context(
                    user_agent=self.MOBILE_USER_AGENT,
                    viewport=self.MOBILE_VIEWPORT,
                    is_mobile=True,
                    has_touch=True,
                )
                mobile_page = mobile_ctx.new_page()
                try:
                    mobile_page.goto(url, timeout=30000, wait_until="networkidle")
                except Exception:
                    mobile_page.goto(url, timeout=30000, wait_until="domcontentloaded")

                self._dismiss_cookie_banners(mobile_page)
                mobile_page.wait_for_timeout(500)

                mobile_path = os.path.join(tmp_dir, 'mobile_full.png')
                mobile_page.screenshot(path=mobile_path, full_page=True)
                result["screenshots"]["mobile_full"] = mobile_path
            except Exception:
                pass
            finally:
                if mobile_ctx:
                    try:
                        mobile_ctx.close()
                    except Exception:
                        pass

        except (SiteDownError, SiteTimeoutError, SiteBlockedError):
            raise
        except Exception as e:
            err_msg = str(e).lower()
            if 'net::err_name_not_resolved' in err_msg or 'net::err_connection_refused' in err_msg:
                raise SiteDownError(f"Site unreachable: {e}")
            elif 'timeout' in err_msg:
                raise SiteTimeoutError(f"Timeout: {e}")
            elif '403' in err_msg or 'access denied' in err_msg:
                raise SiteBlockedError(f"Blocked: {e}")
            result["error"] = f"Capture error: {e}"
        finally:
            if context:
                try:
                    context.close()
                except Exception:
                    pass
            # Don't release browser here — the worker manages its lifecycle
            if not self._external_browser:
                self._release_browser()

        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _dismiss_cookie_banners(page) -> None:
        """Attempt to dismiss cookie consent banners."""
        for selector in COOKIE_DISMISS_SELECTORS:
            try:
                btn = page.query_selector(selector)
                if btn and btn.is_visible():
                    btn.click(timeout=2000)
                    return  # One successful dismiss is enough
            except Exception:
                continue

    @staticmethod
    def _extract_assets(page, base_url: str) -> Dict[str, Any]:
        """Extract logo candidate and key images from the live DOM."""
        assets = {
            "logo_candidate": None,
            "key_images": [],
        }

        try:
            # Logo: first img in header/nav with "logo" in class/id/alt, or first img in header
            logo_url = page.evaluate("""() => {
                const selectors = [
                    'header img[class*="logo"]',
                    'header img[id*="logo"]',
                    'header img[alt*="logo"]',
                    'nav img[class*="logo"]',
                    'nav img[id*="logo"]',
                    'img[class*="logo"]',
                    'img[id*="logo"]',
                    'header img',
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.src) return el.src;
                }
                return null;
            }""")
            assets["logo_candidate"] = logo_url

            # Key images: large images (natural dimensions > 200x200), skip tiny/tracking
            key_imgs = page.evaluate("""() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                const results = [];
                for (const img of imgs) {
                    if (results.length >= 5) break;
                    const w = img.naturalWidth || img.width;
                    const h = img.naturalHeight || img.height;
                    if (w > 200 && h > 200 && img.src && !img.src.startsWith('data:')) {
                        results.push(img.src);
                    }
                }
                return results;
            }""")
            assets["key_images"] = key_imgs or []

        except Exception:
            pass

        return assets

    # ------------------------------------------------------------------
    # Resource extraction (unchanged)
    # ------------------------------------------------------------------

    def get_resources(self, soup: BeautifulSoup, base_url: str) -> Dict[str, List[str]]:
        """
        Extract all resources (CSS, JS, images) from HTML.

        Returns dict with:
            - css: list of CSS file URLs
            - js: list of JavaScript file URLs
            - images: list of image URLs
            - fonts: list of font URLs
        """
        resources = {
            "css": [],
            "js": [],
            "images": [],
            "fonts": []
        }

        if not soup:
            return resources

        # CSS files
        for link in soup.find_all("link", rel="stylesheet"):
            href = link.get("href")
            if href:
                resources["css"].append(urljoin(base_url, href))

        # Inline style imports
        for style in soup.find_all("style"):
            if style.string:
                imports = re.findall(r'@import\s+["\']([^"\']+)["\']', style.string)
                for imp in imports:
                    resources["css"].append(urljoin(base_url, imp))

        # JavaScript files
        for script in soup.find_all("script", src=True):
            src = script.get("src")
            if src:
                resources["js"].append(urljoin(base_url, src))

        # Images
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src:
                resources["images"].append(urljoin(base_url, src))

        # Background images in inline styles
        for elem in soup.find_all(style=True):
            style = elem.get("style", "")
            urls = re.findall(r'url\(["\']?([^"\')\s]+)["\']?\)', style)
            for u in urls:
                full_url = urljoin(base_url, u)
                if any(ext in u.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']):
                    resources["images"].append(full_url)

        # Fonts
        for link in soup.find_all("link", rel="preload"):
            if link.get("as") == "font":
                href = link.get("href")
                if href:
                    resources["fonts"].append(urljoin(base_url, href))

        # Deduplicate
        for key in resources:
            resources[key] = list(set(resources[key]))

        return resources

    def check_robots_txt(self, url: str) -> Dict[str, Any]:
        """
        Check robots.txt for the given URL.

        Returns dict with:
            - exists: whether robots.txt exists
            - allows_all: whether it allows all user agents
            - disallowed_paths: list of disallowed paths
            - sitemap_urls: list of sitemap URLs found
        """
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

        result = {
            "exists": False,
            "allows_all": True,
            "disallowed_paths": [],
            "sitemap_urls": []
        }

        try:
            response = self.session.get(robots_url, timeout=10)
            if response.status_code == 200:
                result["exists"] = True

                for line in response.text.split("\n"):
                    line = line.strip()
                    if line.lower().startswith("disallow:"):
                        path = line[9:].strip()
                        if path and path != "/":
                            result["disallowed_paths"].append(path)
                        elif path == "/":
                            result["allows_all"] = False
                    elif line.lower().startswith("sitemap:"):
                        sitemap = line[8:].strip()
                        if sitemap:
                            result["sitemap_urls"].append(sitemap)

        except requests.exceptions.RequestException:
            pass

        return result

    def get_page_size(self, url: str) -> Dict[str, Any]:
        """
        Calculate total page size including resources.

        Returns dict with:
            - html_size: size of HTML in bytes
            - total_size: estimated total size including resources
            - resource_count: number of external resources
        """
        result = {
            "html_size": 0,
            "total_size": 0,
            "resource_count": 0,
            "error": None
        }

        try:
            response = self.session.get(url, timeout=self.timeout)
            result["html_size"] = len(response.content)
            result["total_size"] = result["html_size"]

            soup = BeautifulSoup(response.text, self.bs_parser)
            resources = self.get_resources(soup, url)

            all_resources = (
                resources["css"] +
                resources["js"] +
                resources["images"]
            )
            result["resource_count"] = len(all_resources)

            sample_size = min(10, len(all_resources))
            if sample_size > 0:
                sampled = all_resources[:sample_size]
                total_sampled = 0
                for res_url in sampled:
                    try:
                        self.rate_limiter.wait()
                        res_response = self.session.head(res_url, timeout=5)
                        size = int(res_response.headers.get("content-length", 0))
                        total_sampled += size
                    except:
                        pass

                if total_sampled > 0 and sample_size > 0:
                    avg_size = total_sampled / sample_size
                    result["total_size"] += int(avg_size * len(all_resources))

        except Exception as e:
            result["error"] = str(e)

        return result

    def close(self):
        """Close session and cleanup."""
        self.session.close()
        self._release_browser()
