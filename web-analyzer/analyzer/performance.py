"""
Performance analysis module - measures load times, page size, and HTTP requests.
"""

import time
import re
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


class PerformanceAnalyzer:
    """Analyze website performance metrics."""

    # Performance thresholds
    THRESHOLDS = {
        "load_time": {
            "good": 2.0,      # seconds
            "moderate": 4.0,
            "poor": 6.0
        },
        "page_size": {
            "good": 1_000_000,       # 1MB
            "moderate": 3_000_000,   # 3MB
            "poor": 5_000_000        # 5MB
        },
        "requests": {
            "good": 50,
            "moderate": 100,
            "poor": 150
        }
    }

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
        })

    def analyze(
        self,
        url: str,
        soup: Optional[BeautifulSoup] = None,
        html: Optional[str] = None,
        resources: Optional[Dict[str, List[str]]] = None,
        precomputed_load_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Analyze page performance.

        Args:
            url: URL to analyze
            soup: Pre-fetched BeautifulSoup object
            html: Pre-fetched HTML content
            resources: Pre-computed resources dict
            precomputed_load_time: Load time from initial fetch

        Returns:
            Performance analysis results
        """
        results = {
            "load_time": precomputed_load_time or 0,
            "load_time_rating": "unknown",
            "page_size": 0,
            "page_size_rating": "unknown",
            "html_size": 0,
            "total_requests": 0,
            "requests_rating": "unknown",
            "resource_breakdown": {
                "css": {"count": 0, "size": 0},
                "js": {"count": 0, "size": 0},
                "images": {"count": 0, "size": 0},
                "fonts": {"count": 0, "size": 0},
                "other": {"count": 0, "size": 0}
            },
            "compression": {
                "gzip_enabled": False,
                "potential_savings": 0
            },
            "caching": {
                "has_cache_headers": False,
                "cache_control": None
            },
            "issues": [],
            "recommendations": []
        }

        # Measure load time if not provided
        if not precomputed_load_time and not html:
            start_time = time.time()
            try:
                response = self.session.get(url, timeout=self.timeout)
                results["load_time"] = time.time() - start_time
                html = response.text
                soup = BeautifulSoup(html, "lxml")

                # Check compression
                if response.headers.get("content-encoding") in ["gzip", "br", "deflate"]:
                    results["compression"]["gzip_enabled"] = True

                # Check caching
                cache_control = response.headers.get("cache-control")
                if cache_control:
                    results["caching"]["has_cache_headers"] = True
                    results["caching"]["cache_control"] = cache_control

            except requests.exceptions.RequestException as e:
                results["issues"].append(f"Failed to fetch page: {str(e)}")
                return results

        # Calculate HTML size
        if html:
            results["html_size"] = len(html.encode('utf-8'))
            results["page_size"] = results["html_size"]

        # Analyze resources
        if resources:
            self._analyze_resources(results, resources, url)
        elif soup:
            # Extract resources from soup if not provided
            resources = self._extract_resources(soup, url)
            self._analyze_resources(results, resources, url)

        # Calculate ratings
        results["load_time_rating"] = self._rate_metric(
            results["load_time"],
            self.THRESHOLDS["load_time"]
        )

        results["page_size_rating"] = self._rate_metric(
            results["page_size"],
            self.THRESHOLDS["page_size"]
        )

        results["requests_rating"] = self._rate_metric(
            results["total_requests"],
            self.THRESHOLDS["requests"]
        )

        # Generate issues and recommendations
        self._generate_recommendations(results)

        return results

    def _extract_resources(self, soup: BeautifulSoup, base_url: str) -> Dict[str, List[str]]:
        """Extract resource URLs from soup."""
        resources = {"css": [], "js": [], "images": [], "fonts": []}

        # CSS
        for link in soup.find_all("link", rel="stylesheet"):
            href = link.get("href")
            if href:
                resources["css"].append(urljoin(base_url, href))

        # JS
        for script in soup.find_all("script", src=True):
            src = script.get("src")
            if src:
                resources["js"].append(urljoin(base_url, src))

        # Images
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src:
                resources["images"].append(urljoin(base_url, src))

        return resources

    def _analyze_resources(self, results: Dict, resources: Dict, base_url: str):
        """Analyze resource sizes and counts."""
        total_size = results["html_size"]
        total_requests = 1  # HTML request

        for resource_type in ["css", "js", "images", "fonts"]:
            urls = resources.get(resource_type, [])
            results["resource_breakdown"][resource_type]["count"] = len(urls)
            total_requests += len(urls)

            # Sample a few resources to estimate size
            sample = urls[:5] if len(urls) > 5 else urls
            sampled_size = 0

            for url in sample:
                try:
                    head_response = self.session.head(url, timeout=5)
                    size = int(head_response.headers.get("content-length", 0))
                    sampled_size += size
                except:
                    pass

            # Estimate total size for this type
            if sample and sampled_size > 0:
                avg_size = sampled_size / len(sample)
                estimated_size = int(avg_size * len(urls))
                results["resource_breakdown"][resource_type]["size"] = estimated_size
                total_size += estimated_size

        results["page_size"] = total_size
        results["total_requests"] = total_requests

    def _rate_metric(self, value: float, thresholds: Dict[str, float]) -> str:
        """Rate a metric against thresholds."""
        if value <= thresholds["good"]:
            return "good"
        elif value <= thresholds["moderate"]:
            return "moderate"
        elif value <= thresholds["poor"]:
            return "poor"
        return "critical"

    def _generate_recommendations(self, results: Dict):
        """Generate performance issues and recommendations."""
        # Load time issues
        if results["load_time_rating"] in ["poor", "critical"]:
            results["issues"].append(f"Slow load time: {results['load_time']:.2f}s")
            results["recommendations"].append("Optimize server response time and reduce blocking resources")

        # Page size issues
        if results["page_size_rating"] in ["poor", "critical"]:
            size_mb = results["page_size"] / 1_000_000
            results["issues"].append(f"Large page size: {size_mb:.1f}MB")
            results["recommendations"].append("Compress images and minify CSS/JS")

        # Request count issues
        if results["requests_rating"] in ["poor", "critical"]:
            results["issues"].append(f"Too many HTTP requests: {results['total_requests']}")
            results["recommendations"].append("Combine CSS/JS files and use CSS sprites")

        # Compression
        if not results["compression"]["gzip_enabled"]:
            results["issues"].append("Gzip compression not enabled")
            results["recommendations"].append("Enable Gzip/Brotli compression on server")

        # Caching
        if not results["caching"]["has_cache_headers"]:
            results["issues"].append("No cache headers detected")
            results["recommendations"].append("Add cache-control headers for static assets")

        # Large images
        img_size = results["resource_breakdown"]["images"]["size"]
        if img_size > 2_000_000:
            results["issues"].append(f"Large image payload: {img_size / 1_000_000:.1f}MB")
            results["recommendations"].append("Optimize images with WebP format and lazy loading")

        # Too many JS files
        js_count = results["resource_breakdown"]["js"]["count"]
        if js_count > 20:
            results["issues"].append(f"Many JavaScript files: {js_count}")
            results["recommendations"].append("Bundle JavaScript files to reduce requests")

    def close(self):
        """Close session."""
        self.session.close()


def analyze_performance(
    url: str,
    soup: Optional[BeautifulSoup] = None,
    html: Optional[str] = None,
    resources: Optional[Dict[str, List[str]]] = None,
    load_time: Optional[float] = None
) -> Dict[str, Any]:
    """
    Convenience function for performance analysis.

    Args:
        url: URL to analyze
        soup: Pre-fetched BeautifulSoup object
        html: Pre-fetched HTML content
        resources: Pre-computed resources dict
        load_time: Pre-computed load time

    Returns:
        Performance analysis results
    """
    analyzer = PerformanceAnalyzer()
    try:
        return analyzer.analyze(url, soup, html, resources, load_time)
    finally:
        analyzer.close()
