"""
Technology detection module - identifies CMS, frameworks, and page builders.
"""

import re
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup


class TechnologyAnalyzer:
    """Detect technologies used in a website."""

    # CMS detection patterns
    CMS_PATTERNS = {
        "wordpress": {
            "meta": [r"WordPress", r"wp-content", r"wp-includes"],
            "scripts": [r"/wp-content/", r"/wp-includes/", r"wp-emoji"],
            "links": [r"/wp-content/themes/", r"/wp-content/plugins/"],
            "generator": r"WordPress"
        },
        "wix": {
            "meta": [r"Wix\.com"],
            "scripts": [r"static\.wixstatic\.com", r"wix-code-sdk"],
            "links": [r"wixsite\.com"],
            "generator": r"Wix"
        },
        "squarespace": {
            "meta": [r"Squarespace"],
            "scripts": [r"squarespace\.com", r"squarespace-cdn"],
            "links": [r"squarespace"],
            "generator": r"Squarespace"
        },
        "shopify": {
            "meta": [r"Shopify"],
            "scripts": [r"cdn\.shopify\.com", r"shopify\.com"],
            "links": [r"shopify"],
            "generator": r"Shopify"
        },
        "drupal": {
            "meta": [r"Drupal"],
            "scripts": [r"/sites/default/files/", r"drupal\.js"],
            "links": [r"/sites/all/"],
            "generator": r"Drupal"
        },
        "joomla": {
            "meta": [r"Joomla"],
            "scripts": [r"/media/jui/", r"/media/system/"],
            "links": [r"/components/com_"],
            "generator": r"Joomla"
        },
        "webflow": {
            "meta": [r"Webflow"],
            "scripts": [r"webflow\.com", r"webflow\.js"],
            "links": [r"webflow"],
            "generator": r"Webflow"
        },
        "weebly": {
            "meta": [r"Weebly"],
            "scripts": [r"weebly\.com", r"editmysite\.com"],
            "links": [r"weebly"],
            "generator": r"Weebly"
        },
        "ghost": {
            "meta": [r"Ghost"],
            "scripts": [r"ghost\.io"],
            "links": [r"ghost"],
            "generator": r"Ghost"
        },
        "magento": {
            "meta": [r"Magento"],
            "scripts": [r"/static/frontend/", r"mage/"],
            "links": [r"magento"],
            "generator": r"Magento"
        },
        "prestashop": {
            "meta": [r"PrestaShop"],
            "scripts": [r"prestashop", r"/modules/"],
            "links": [r"prestashop"],
            "generator": r"PrestaShop"
        }
    }

    # Page builder patterns (for WordPress)
    PAGE_BUILDERS = {
        "elementor": [r"elementor", r"elementor-kit"],
        "divi": [r"et-builder", r"divi", r"et_pb_"],
        "wpbakery": [r"js_composer", r"vc_row", r"wpbakery"],
        "beaver_builder": [r"fl-builder", r"beaver-builder"],
        "oxygen": [r"oxygen", r"ct-section"],
        "avada": [r"avada", r"fusion-builder"],
        "thrive": [r"thrive", r"tve-"],
        "gutenberg": [r"wp-block-", r"has-blocks"]
    }

    # JavaScript framework patterns
    JS_FRAMEWORKS = {
        "react": [r"react", r"_reactRootContainer", r"__NEXT_DATA__"],
        "vue": [r"vue\.js", r"vue\.min\.js", r"__vue__", r"v-cloak"],
        "angular": [r"angular", r"ng-version", r"ng-app"],
        "jquery": [r"jquery", r"jQuery"],
        "bootstrap": [r"bootstrap", r"\.navbar", r"\.container-fluid"],
        "tailwind": [r"tailwindcss", r"tailwind"],
        "next.js": [r"__NEXT_DATA__", r"_next/static"],
        "nuxt": [r"__NUXT__", r"_nuxt"],
        "gatsby": [r"gatsby", r"___gatsby"],
        "svelte": [r"svelte", r"__svelte"]
    }

    def __init__(self):
        self.results = {}

    def analyze(self, soup: BeautifulSoup, html: str, resources: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Analyze page for technology detection.

        Args:
            soup: BeautifulSoup object of the page
            html: Raw HTML string
            resources: Dict with css, js, images lists

        Returns:
            Dict with detected technologies
        """
        self.results = {
            "cms": None,
            "cms_version": None,
            "page_builder": None,
            "frameworks": [],
            "libraries": [],
            "server": None,
            "is_static": False,
            "ecommerce": None,
            "analytics": [],
            "confidence": {}
        }

        if not soup or not html:
            return self.results

        # Detect CMS
        self._detect_cms(soup, html, resources)

        # Detect page builder (if WordPress)
        if self.results["cms"] == "wordpress":
            self._detect_page_builder(soup, html, resources)

        # Detect JS frameworks
        self._detect_frameworks(soup, html, resources)

        # Detect analytics
        self._detect_analytics(soup, html)

        # Detect ecommerce
        self._detect_ecommerce(soup, html, resources)

        # Check if static site
        self._check_static_site(soup, html)

        return self.results

    def _detect_cms(self, soup: BeautifulSoup, html: str, resources: Dict[str, List[str]]):
        """Detect which CMS the site uses."""
        html_lower = html.lower()

        # Check generator meta tag first
        generator = soup.find("meta", {"name": "generator"})
        if generator:
            gen_content = generator.get("content", "")
            for cms, patterns in self.CMS_PATTERNS.items():
                if re.search(patterns["generator"], gen_content, re.I):
                    self.results["cms"] = cms
                    self.results["confidence"][cms] = "high"
                    # Try to extract version
                    version_match = re.search(r'[\d.]+', gen_content)
                    if version_match:
                        self.results["cms_version"] = version_match.group()
                    return

        # Check HTML content and resources
        for cms, patterns in self.CMS_PATTERNS.items():
            score = 0

            # Check meta patterns
            for pattern in patterns["meta"]:
                if re.search(pattern, html, re.I):
                    score += 1

            # Check script sources
            all_scripts = " ".join(resources.get("js", []))
            for pattern in patterns["scripts"]:
                if re.search(pattern, all_scripts, re.I):
                    score += 2

            # Check link sources
            all_links = " ".join(resources.get("css", []))
            for pattern in patterns["links"]:
                if re.search(pattern, all_links, re.I):
                    score += 1

            if score >= 2:
                self.results["cms"] = cms
                self.results["confidence"][cms] = "medium" if score < 4 else "high"
                break

    def _detect_page_builder(self, soup: BeautifulSoup, html: str, resources: Dict[str, List[str]]):
        """Detect page builder for WordPress sites."""
        html_lower = html.lower()
        all_resources = " ".join(resources.get("js", []) + resources.get("css", []))

        for builder, patterns in self.PAGE_BUILDERS.items():
            for pattern in patterns:
                if re.search(pattern, html_lower) or re.search(pattern, all_resources.lower()):
                    self.results["page_builder"] = builder
                    return

    def _detect_frameworks(self, soup: BeautifulSoup, html: str, resources: Dict[str, List[str]]):
        """Detect JavaScript frameworks and libraries."""
        html_lower = html.lower()
        all_scripts = " ".join(resources.get("js", []))

        for framework, patterns in self.JS_FRAMEWORKS.items():
            for pattern in patterns:
                if re.search(pattern, html_lower, re.I) or re.search(pattern, all_scripts, re.I):
                    if framework in ["jquery", "bootstrap"]:
                        self.results["libraries"].append(framework)
                    else:
                        self.results["frameworks"].append(framework)
                    break

        # Deduplicate
        self.results["frameworks"] = list(set(self.results["frameworks"]))
        self.results["libraries"] = list(set(self.results["libraries"]))

    def _detect_analytics(self, soup: BeautifulSoup, html: str):
        """Detect analytics tools."""
        analytics_patterns = {
            "google_analytics": [r"google-analytics\.com", r"gtag", r"ga\(", r"UA-\d+"],
            "google_tag_manager": [r"googletagmanager\.com", r"GTM-"],
            "facebook_pixel": [r"facebook\.net.*fbevents", r"fbq\("],
            "hotjar": [r"hotjar\.com", r"hj\("],
            "mixpanel": [r"mixpanel\.com"],
            "segment": [r"segment\.com", r"analytics\.js"],
            "plausible": [r"plausible\.io"],
            "matomo": [r"matomo", r"piwik"]
        }

        for tool, patterns in analytics_patterns.items():
            for pattern in patterns:
                if re.search(pattern, html, re.I):
                    self.results["analytics"].append(tool)
                    break

        self.results["analytics"] = list(set(self.results["analytics"]))

    def _detect_ecommerce(self, soup: BeautifulSoup, html: str, resources: Dict[str, List[str]]):
        """Detect ecommerce platforms."""
        ecommerce_patterns = {
            "woocommerce": [r"woocommerce", r"wc-cart"],
            "shopify": [r"shopify", r"Shopify\.theme"],
            "magento": [r"magento", r"mage/"],
            "bigcommerce": [r"bigcommerce"],
            "prestashop": [r"prestashop"],
            "opencart": [r"opencart"]
        }

        html_lower = html.lower()
        all_resources = " ".join(resources.get("js", []) + resources.get("css", []))

        for platform, patterns in ecommerce_patterns.items():
            for pattern in patterns:
                if re.search(pattern, html_lower) or re.search(pattern, all_resources.lower()):
                    self.results["ecommerce"] = platform
                    return

    def _check_static_site(self, soup: BeautifulSoup, html: str):
        """Check if site appears to be static."""
        static_indicators = [
            r"gatsby",
            r"hugo",
            r"jekyll",
            r"netlify",
            r"vercel",
            r"__NEXT_DATA__",
            r"eleventy"
        ]

        # If no CMS and has static site indicators
        if not self.results["cms"]:
            for pattern in static_indicators:
                if re.search(pattern, html, re.I):
                    self.results["is_static"] = True
                    return


def analyze_technology(soup: BeautifulSoup, html: str, resources: Dict[str, List[str]]) -> Dict[str, Any]:
    """
    Convenience function for technology analysis.

    Args:
        soup: BeautifulSoup object
        html: Raw HTML string
        resources: Dict with css, js, images lists

    Returns:
        Technology analysis results
    """
    analyzer = TechnologyAnalyzer()
    return analyzer.analyze(soup, html, resources)
