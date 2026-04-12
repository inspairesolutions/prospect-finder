"""
Web scraping utilities with requests, BeautifulSoup, and Playwright support.
"""

import time
import re
from typing import Optional, Dict, List, Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


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

    def __init__(
        self,
        timeout: int = 30,
        max_requests_per_second: float = 5.0,
        user_agent: Optional[str] = None,
        respect_robots: bool = True
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
        self._playwright = None
        self._browser = None
        self.bs_parser = self._resolve_bs_parser()

    def _resolve_bs_parser(self) -> str:
        """Prefer lxml, fallback to built-in html.parser if unavailable."""
        try:
            BeautifulSoup("<html></html>", "lxml")
            return "lxml"
        except Exception:
            return "html.parser"

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
            from playwright.sync_api import sync_playwright

            start_time = time.time()

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
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

                browser.close()

        except ImportError:
            result["error"] = "Playwright not installed. Run: playwright install chromium"
        except Exception as e:
            result["error"] = f"Playwright error: {str(e)}"

        return result

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
            for url in urls:
                full_url = urljoin(base_url, url)
                if any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']):
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
                content = response.text.lower()

                # Parse disallow rules (simplified)
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
            # Get HTML
            response = self.session.get(url, timeout=self.timeout)
            result["html_size"] = len(response.content)
            result["total_size"] = result["html_size"]

            soup = BeautifulSoup(response.text, self.bs_parser)
            resources = self.get_resources(soup, url)

            # Count resources
            all_resources = (
                resources["css"] +
                resources["js"] +
                resources["images"]
            )
            result["resource_count"] = len(all_resources)

            # Sample some resources for size estimation (don't fetch all)
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

                # Estimate total based on sample
                if total_sampled > 0 and sample_size > 0:
                    avg_size = total_sampled / sample_size
                    result["total_size"] += int(avg_size * len(all_resources))

        except Exception as e:
            result["error"] = str(e)

        return result

    def close(self):
        """Close session and cleanup."""
        self.session.close()
