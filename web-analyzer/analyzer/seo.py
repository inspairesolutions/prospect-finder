"""
SEO analysis module - checks title, meta tags, headings, alt attributes, and more.
"""

import re
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup


class SEOAnalyzer:
    """Analyze website SEO factors."""

    # SEO thresholds
    TITLE_MIN_LENGTH = 30
    TITLE_MAX_LENGTH = 60
    META_DESC_MIN_LENGTH = 120
    META_DESC_MAX_LENGTH = 160

    def __init__(self):
        self.results = {}

    def analyze(
        self,
        url: str,
        soup: BeautifulSoup,
        html: str,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze page SEO.

        Args:
            url: Page URL
            soup: BeautifulSoup object
            html: Raw HTML content
            headers: HTTP response headers

        Returns:
            SEO analysis results
        """
        self.results = {
            "score": 0,
            "max_score": 100,
            "has_title": False,
            "title": None,
            "title_length": 0,
            "title_issues": [],
            "has_meta_description": False,
            "meta_description": None,
            "meta_description_length": 0,
            "meta_description_issues": [],
            "has_h1": False,
            "h1_count": 0,
            "h1_content": [],
            "heading_structure": {},
            "uses_https": False,
            "has_canonical": False,
            "canonical_url": None,
            "has_robots_meta": False,
            "robots_content": None,
            "has_sitemap": False,
            "has_open_graph": False,
            "og_tags": {},
            "has_twitter_cards": False,
            "twitter_tags": {},
            "images_without_alt": 0,
            "total_images": 0,
            "alt_text_ratio": 0,
            "has_lang_attribute": False,
            "language": None,
            "has_viewport_meta": False,
            "internal_links": 0,
            "external_links": 0,
            "issues": [],
            "recommendations": []
        }

        if not soup:
            return self.results

        parsed_url = urlparse(url)
        self.results["uses_https"] = parsed_url.scheme == "https"

        # Analyze each SEO factor
        self._analyze_title(soup)
        self._analyze_meta_description(soup)
        self._analyze_headings(soup)
        self._analyze_canonical(soup, url)
        self._analyze_robots_meta(soup)
        self._analyze_open_graph(soup)
        self._analyze_twitter_cards(soup)
        self._analyze_images(soup)
        self._analyze_lang(soup)
        self._analyze_viewport(soup)
        self._analyze_links(soup, url)
        self._check_sitemap(headers)

        # Calculate score and generate recommendations
        self._calculate_score()
        self._generate_recommendations()

        return self.results

    def _analyze_title(self, soup: BeautifulSoup):
        """Analyze page title."""
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            self.results["has_title"] = True
            self.results["title"] = title_tag.string.strip()
            self.results["title_length"] = len(self.results["title"])

            # Check title length
            if self.results["title_length"] < self.TITLE_MIN_LENGTH:
                self.results["title_issues"].append("Title too short")
            elif self.results["title_length"] > self.TITLE_MAX_LENGTH:
                self.results["title_issues"].append("Title too long")
        else:
            self.results["title_issues"].append("Missing title tag")

    def _analyze_meta_description(self, soup: BeautifulSoup):
        """Analyze meta description."""
        meta_desc = soup.find("meta", {"name": "description"})
        if meta_desc:
            content = meta_desc.get("content", "").strip()
            if content:
                self.results["has_meta_description"] = True
                self.results["meta_description"] = content
                self.results["meta_description_length"] = len(content)

                # Check length
                if len(content) < self.META_DESC_MIN_LENGTH:
                    self.results["meta_description_issues"].append("Meta description too short")
                elif len(content) > self.META_DESC_MAX_LENGTH:
                    self.results["meta_description_issues"].append("Meta description too long")
            else:
                self.results["meta_description_issues"].append("Empty meta description")
        else:
            self.results["meta_description_issues"].append("Missing meta description")

    def _analyze_headings(self, soup: BeautifulSoup):
        """Analyze heading structure."""
        for level in range(1, 7):
            tag = f"h{level}"
            headings = soup.find_all(tag)
            self.results["heading_structure"][tag] = len(headings)

            if level == 1:
                self.results["h1_count"] = len(headings)
                self.results["has_h1"] = len(headings) > 0
                self.results["h1_content"] = [
                    h.get_text(strip=True)[:100] for h in headings[:3]
                ]

    def _analyze_canonical(self, soup: BeautifulSoup, current_url: str):
        """Analyze canonical tag."""
        canonical = soup.find("link", {"rel": "canonical"})
        if canonical:
            href = canonical.get("href")
            if href:
                self.results["has_canonical"] = True
                self.results["canonical_url"] = href

    def _analyze_robots_meta(self, soup: BeautifulSoup):
        """Analyze robots meta tag."""
        robots = soup.find("meta", {"name": "robots"})
        if robots:
            content = robots.get("content", "")
            self.results["has_robots_meta"] = True
            self.results["robots_content"] = content

            if "noindex" in content.lower():
                self.results["issues"].append("Page is set to noindex")
            if "nofollow" in content.lower():
                self.results["issues"].append("Page is set to nofollow")

    def _analyze_open_graph(self, soup: BeautifulSoup):
        """Analyze Open Graph tags."""
        og_tags = {}
        for meta in soup.find_all("meta", property=re.compile(r"^og:")):
            prop = meta.get("property", "")
            content = meta.get("content", "")
            if prop and content:
                og_tags[prop] = content

        self.results["og_tags"] = og_tags
        self.results["has_open_graph"] = bool(og_tags)

    def _analyze_twitter_cards(self, soup: BeautifulSoup):
        """Analyze Twitter Card tags."""
        twitter_tags = {}
        for meta in soup.find_all("meta", {"name": re.compile(r"^twitter:")}):
            name = meta.get("name", "")
            content = meta.get("content", "")
            if name and content:
                twitter_tags[name] = content

        self.results["twitter_tags"] = twitter_tags
        self.results["has_twitter_cards"] = bool(twitter_tags)

    def _analyze_images(self, soup: BeautifulSoup):
        """Analyze image alt attributes."""
        images = soup.find_all("img")
        self.results["total_images"] = len(images)

        without_alt = 0
        for img in images:
            alt = img.get("alt")
            if alt is None or alt.strip() == "":
                without_alt += 1

        self.results["images_without_alt"] = without_alt

        if self.results["total_images"] > 0:
            self.results["alt_text_ratio"] = (
                (self.results["total_images"] - without_alt) /
                self.results["total_images"]
            ) * 100

    def _analyze_lang(self, soup: BeautifulSoup):
        """Analyze language attribute."""
        html_tag = soup.find("html")
        if html_tag:
            lang = html_tag.get("lang")
            if lang:
                self.results["has_lang_attribute"] = True
                self.results["language"] = lang

    def _analyze_viewport(self, soup: BeautifulSoup):
        """Check for viewport meta tag."""
        viewport = soup.find("meta", {"name": "viewport"})
        self.results["has_viewport_meta"] = viewport is not None

    def _analyze_links(self, soup: BeautifulSoup, base_url: str):
        """Analyze internal and external links."""
        parsed_base = urlparse(base_url)
        base_domain = parsed_base.netloc

        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if not href or href.startswith("#") or href.startswith("javascript:"):
                continue

            try:
                parsed = urlparse(href)
                if parsed.netloc and parsed.netloc != base_domain:
                    self.results["external_links"] += 1
                else:
                    self.results["internal_links"] += 1
            except:
                self.results["internal_links"] += 1

    def _check_sitemap(self, headers: Optional[Dict[str, str]]):
        """Check for sitemap hints in headers."""
        # This is a simple check - a more thorough check would fetch robots.txt
        self.results["has_sitemap"] = False  # Needs external check

    def _calculate_score(self):
        """Calculate overall SEO score."""
        score = 0

        # Title (15 points)
        if self.results["has_title"]:
            score += 10
            if not self.results["title_issues"]:
                score += 5

        # Meta description (15 points)
        if self.results["has_meta_description"]:
            score += 10
            if not self.results["meta_description_issues"]:
                score += 5

        # H1 (10 points)
        if self.results["has_h1"]:
            score += 7
            if self.results["h1_count"] == 1:
                score += 3  # Exactly one H1 is ideal

        # HTTPS (10 points)
        if self.results["uses_https"]:
            score += 10

        # Canonical (5 points)
        if self.results["has_canonical"]:
            score += 5

        # Open Graph (10 points)
        if self.results["has_open_graph"]:
            score += 10

        # Images with alt text (10 points)
        if self.results["total_images"] > 0:
            if self.results["alt_text_ratio"] >= 90:
                score += 10
            elif self.results["alt_text_ratio"] >= 70:
                score += 7
            elif self.results["alt_text_ratio"] >= 50:
                score += 4
        else:
            score += 10  # No images, no penalty

        # Language attribute (5 points)
        if self.results["has_lang_attribute"]:
            score += 5

        # Viewport meta (10 points)
        if self.results["has_viewport_meta"]:
            score += 10

        # Internal links (10 points)
        if self.results["internal_links"] > 0:
            score += 10

        self.results["score"] = min(score, 100)

    def _generate_recommendations(self):
        """Generate SEO recommendations."""
        if not self.results["has_title"]:
            self.results["issues"].append("Missing page title")
            self.results["recommendations"].append("Add a descriptive title tag")
        elif self.results["title_issues"]:
            self.results["issues"].extend(self.results["title_issues"])
            self.results["recommendations"].append(
                f"Optimize title length ({self.TITLE_MIN_LENGTH}-{self.TITLE_MAX_LENGTH} chars)"
            )

        if not self.results["has_meta_description"]:
            self.results["issues"].append("Missing meta description")
            self.results["recommendations"].append("Add a compelling meta description")
        elif self.results["meta_description_issues"]:
            self.results["issues"].extend(self.results["meta_description_issues"])

        if not self.results["has_h1"]:
            self.results["issues"].append("Missing H1 heading")
            self.results["recommendations"].append("Add a single H1 heading")
        elif self.results["h1_count"] > 1:
            self.results["issues"].append(f"Multiple H1 headings ({self.results['h1_count']})")
            self.results["recommendations"].append("Use only one H1 per page")

        if not self.results["uses_https"]:
            self.results["issues"].append("Not using HTTPS")
            self.results["recommendations"].append("Install SSL certificate and redirect to HTTPS")

        if not self.results["has_canonical"]:
            self.results["recommendations"].append("Add canonical URL tag")

        if not self.results["has_open_graph"]:
            self.results["recommendations"].append("Add Open Graph tags for social sharing")

        if self.results["images_without_alt"] > 0:
            self.results["issues"].append(
                f"{self.results['images_without_alt']} images without alt text"
            )
            self.results["recommendations"].append("Add descriptive alt text to all images")

        if not self.results["has_lang_attribute"]:
            self.results["issues"].append("Missing lang attribute on HTML tag")
            self.results["recommendations"].append("Add lang attribute to HTML tag")

        if not self.results["has_viewport_meta"]:
            self.results["issues"].append("Missing viewport meta tag")
            self.results["recommendations"].append("Add viewport meta tag for mobile devices")


def analyze_seo(
    url: str,
    soup: BeautifulSoup,
    html: str,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Convenience function for SEO analysis.

    Args:
        url: Page URL
        soup: BeautifulSoup object
        html: Raw HTML content
        headers: HTTP response headers

    Returns:
        SEO analysis results
    """
    analyzer = SEOAnalyzer()
    return analyzer.analyze(url, soup, html, headers)
