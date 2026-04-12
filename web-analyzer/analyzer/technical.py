"""
Technical analysis module - detects broken links, JS errors, SSL issues, and more.
"""

import re
import ssl
import socket
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup


class TechnicalAnalyzer:
    """Analyze technical aspects of a website."""

    def __init__(self, timeout: int = 10, max_links_to_check: int = 20):
        self.timeout = timeout
        self.max_links_to_check = max_links_to_check
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
        })

    def analyze(
        self,
        url: str,
        soup: BeautifulSoup,
        html: str,
        js_errors: Optional[List[str]] = None,
        check_links: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze technical aspects of the page.

        Args:
            url: Page URL
            soup: BeautifulSoup object
            html: Raw HTML content
            js_errors: List of JS errors from Playwright
            check_links: Whether to check for broken links

        Returns:
            Technical analysis results
        """
        results = {
            "ssl": {
                "has_ssl": False,
                "is_valid": False,
                "certificate_info": None,
                "issues": []
            },
            "broken_links": [],
            "broken_links_count": 0,
            "links_checked": 0,
            "mixed_content": [],
            "js_errors": js_errors or [],
            "console_errors": [],
            "deprecated_html": [],
            "accessibility_issues": [],
            "security_headers": {},
            "missing_security_headers": [],
            "performance_issues": [],
            "issues": [],
            "severity": "low"
        }

        parsed_url = urlparse(url)

        # Check SSL
        self._check_ssl(parsed_url.netloc, results)

        # Check for mixed content
        self._check_mixed_content(soup, html, parsed_url.scheme, results)

        # Check for broken links (if enabled)
        if check_links:
            self._check_broken_links(soup, url, results)

        # Check for deprecated HTML
        self._check_deprecated_html(soup, results)

        # Check accessibility basics
        self._check_accessibility(soup, results)

        # Check security headers
        self._check_security_headers(url, results)

        # Check for common technical issues
        self._check_common_issues(soup, html, results)

        # Calculate overall severity
        self._calculate_severity(results)

        return results

    def _check_ssl(self, hostname: str, results: Dict):
        """Check SSL certificate validity."""
        results["ssl"]["has_ssl"] = True  # Assume HTTPS was used to reach the site

        try:
            context = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=self.timeout) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    results["ssl"]["is_valid"] = True
                    results["ssl"]["certificate_info"] = {
                        "issuer": dict(x[0] for x in cert.get("issuer", [])),
                        "subject": dict(x[0] for x in cert.get("subject", [])),
                        "notAfter": cert.get("notAfter"),
                        "notBefore": cert.get("notBefore")
                    }
        except ssl.SSLCertVerificationError as e:
            results["ssl"]["is_valid"] = False
            results["ssl"]["issues"].append(f"SSL verification failed: {str(e)}")
            results["issues"].append("Invalid SSL certificate")
        except socket.timeout:
            results["ssl"]["issues"].append("SSL check timed out")
        except socket.gaierror:
            results["ssl"]["issues"].append("Could not resolve hostname")
        except Exception as e:
            results["ssl"]["issues"].append(f"SSL check error: {str(e)}")

    def _check_mixed_content(
        self,
        soup: BeautifulSoup,
        html: str,
        scheme: str,
        results: Dict
    ):
        """Check for mixed content (HTTP resources on HTTPS page)."""
        if scheme != "https":
            return

        # Check for HTTP resources
        http_patterns = [
            (r'src=["\']http://', "script/image source"),
            (r'href=["\']http://[^"\']+\.css', "CSS file"),
            (r'url\(["\']?http://', "CSS url()"),
        ]

        for pattern, resource_type in http_patterns:
            matches = re.findall(pattern, html, re.I)
            for match in matches[:5]:  # Limit to 5 per type
                results["mixed_content"].append({
                    "type": resource_type,
                    "url": match
                })

        if results["mixed_content"]:
            results["issues"].append(
                f"Mixed content: {len(results['mixed_content'])} HTTP resources on HTTPS page"
            )

    def _check_broken_links(self, soup: BeautifulSoup, base_url: str, results: Dict):
        """Check for broken internal links."""
        parsed_base = urlparse(base_url)
        links_to_check = []

        # Collect internal links
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")

            # Skip special links
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue

            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)

            # Only check internal links
            if parsed.netloc == parsed_base.netloc:
                links_to_check.append(full_url)

        # Deduplicate and limit
        links_to_check = list(set(links_to_check))[:self.max_links_to_check]
        results["links_checked"] = len(links_to_check)

        # Check links in parallel
        broken = []

        def check_link(url):
            try:
                response = self.session.head(url, timeout=self.timeout, allow_redirects=True)
                if response.status_code >= 400:
                    return {"url": url, "status": response.status_code}
            except requests.exceptions.RequestException as e:
                return {"url": url, "error": str(e)[:50]}
            return None

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(check_link, url): url for url in links_to_check}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    broken.append(result)

        results["broken_links"] = broken
        results["broken_links_count"] = len(broken)

        if broken:
            results["issues"].append(f"Found {len(broken)} broken links")

    def _check_deprecated_html(self, soup: BeautifulSoup, results: Dict):
        """Check for deprecated HTML elements."""
        deprecated_tags = [
            "font", "center", "strike", "big", "tt", "marquee",
            "blink", "spacer", "frame", "frameset", "noframes"
        ]

        for tag in deprecated_tags:
            elements = soup.find_all(tag)
            if elements:
                results["deprecated_html"].append({
                    "tag": tag,
                    "count": len(elements)
                })

        # Check for deprecated attributes
        deprecated_attrs = {
            "bgcolor": "Use CSS background-color",
            "align": "Use CSS text-align/margin",
            "border": "Use CSS border",
            "cellpadding": "Use CSS padding",
            "cellspacing": "Use CSS border-spacing",
            "valign": "Use CSS vertical-align",
            "width": "Use CSS width (on most elements)",
            "height": "Use CSS height (on most elements)"
        }

        for attr, suggestion in deprecated_attrs.items():
            elements = soup.find_all(attrs={attr: True})
            # Filter out elements where these attributes are valid
            invalid = [e for e in elements if e.name not in ["img", "video", "canvas", "svg", "iframe"]]
            if len(invalid) > 5:  # Only report if significant
                results["deprecated_html"].append({
                    "attribute": attr,
                    "count": len(invalid),
                    "suggestion": suggestion
                })

        if results["deprecated_html"]:
            results["issues"].append(
                f"Found {len(results['deprecated_html'])} types of deprecated HTML"
            )

    def _check_accessibility(self, soup: BeautifulSoup, results: Dict):
        """Check basic accessibility issues."""
        issues = []

        # Check images without alt text
        images = soup.find_all("img")
        no_alt = [img for img in images if not img.get("alt")]
        if len(no_alt) > 0:
            issues.append(f"{len(no_alt)} images without alt text")

        # Check form labels
        inputs = soup.find_all("input", {"type": lambda t: t not in ["hidden", "submit", "button"]})
        for inp in inputs:
            inp_id = inp.get("id")
            if inp_id:
                label = soup.find("label", {"for": inp_id})
                if not label:
                    aria_label = inp.get("aria-label") or inp.get("aria-labelledby")
                    if not aria_label:
                        issues.append("Form input without label")
                        break

        # Check heading hierarchy
        headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        if headings:
            levels = [int(h.name[1]) for h in headings]
            for i in range(len(levels) - 1):
                if levels[i + 1] - levels[i] > 1:
                    issues.append("Skipped heading level (poor hierarchy)")
                    break

        # Check for skip link
        first_links = soup.find_all("a")[:5]
        has_skip_link = any(
            "skip" in (link.get_text().lower() + str(link.get("href", "")))
            for link in first_links
        )
        if not has_skip_link:
            issues.append("No skip navigation link")

        # Check color contrast indicators (basic)
        low_contrast_patterns = [
            r'color\s*:\s*#[def]{6}',  # Very light colors
            r'color\s*:\s*#[abc]{6}',  # Light gray colors
        ]

        results["accessibility_issues"] = issues[:10]  # Limit to 10

    def _check_security_headers(self, url: str, results: Dict):
        """Check for important security headers."""
        important_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Strict-Transport-Security",
            "Content-Security-Policy",
            "Referrer-Policy"
        ]

        try:
            response = self.session.head(url, timeout=self.timeout)
            headers = {k.lower(): v for k, v in response.headers.items()}

            for header in important_headers:
                header_lower = header.lower()
                if header_lower in headers:
                    results["security_headers"][header] = headers[header_lower]
                else:
                    results["missing_security_headers"].append(header)

            if len(results["missing_security_headers"]) > 3:
                results["issues"].append(
                    f"Missing {len(results['missing_security_headers'])} security headers"
                )

        except requests.exceptions.RequestException:
            pass

    def _check_common_issues(self, soup: BeautifulSoup, html: str, results: Dict):
        """Check for common technical issues."""
        # Check for inline JavaScript
        inline_scripts = soup.find_all("script", src=False)
        inline_js_count = sum(1 for s in inline_scripts if s.string and len(s.string) > 100)
        if inline_js_count > 5:
            results["performance_issues"].append(
                f"Many inline scripts ({inline_js_count}) - consider externalizing"
            )

        # Check for inline CSS
        inline_styles = soup.find_all(style=True)
        if len(inline_styles) > 50:
            results["performance_issues"].append(
                f"Many inline styles ({len(inline_styles)}) - consider CSS classes"
            )

        # Check for render-blocking resources
        head = soup.find("head")
        if head:
            blocking_scripts = head.find_all("script", src=True)
            blocking_scripts = [s for s in blocking_scripts if not s.get("async") and not s.get("defer")]
            if len(blocking_scripts) > 3:
                results["performance_issues"].append(
                    f"{len(blocking_scripts)} render-blocking scripts in <head>"
                )

        # Check for missing favicon
        favicon = soup.find("link", rel=lambda r: r and "icon" in r.lower() if r else False)
        if not favicon:
            results["issues"].append("Missing favicon")

        # Check for very large inline styles
        for style in soup.find_all("style"):
            if style.string and len(style.string) > 10000:
                results["performance_issues"].append("Very large inline <style> block")
                break

    def _calculate_severity(self, results: Dict):
        """Calculate overall severity of technical issues."""
        critical_issues = 0
        major_issues = 0

        # Critical issues
        if not results["ssl"]["is_valid"]:
            critical_issues += 1
        if results["broken_links_count"] > 10:
            critical_issues += 1
        if len(results["js_errors"]) > 5:
            critical_issues += 1

        # Major issues
        major_issues += len(results["mixed_content"])
        major_issues += len(results["deprecated_html"])
        major_issues += len(results["missing_security_headers"]) // 2

        if critical_issues > 0:
            results["severity"] = "critical"
        elif major_issues > 5:
            results["severity"] = "high"
        elif major_issues > 2 or len(results["issues"]) > 3:
            results["severity"] = "medium"
        else:
            results["severity"] = "low"

    def close(self):
        """Close session."""
        self.session.close()


def analyze_technical(
    url: str,
    soup: BeautifulSoup,
    html: str,
    js_errors: Optional[List[str]] = None,
    check_links: bool = True
) -> Dict[str, Any]:
    """
    Convenience function for technical analysis.

    Args:
        url: Page URL
        soup: BeautifulSoup object
        html: Raw HTML content
        js_errors: List of JS errors from Playwright
        check_links: Whether to check for broken links

    Returns:
        Technical analysis results
    """
    analyzer = TechnicalAnalyzer()
    try:
        return analyzer.analyze(url, soup, html, js_errors, check_links)
    finally:
        analyzer.close()
