"""
Responsive design analysis module - checks mobile-friendliness and viewport handling.
"""

import re
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup


class ResponsiveAnalyzer:
    """Analyze website responsive design capabilities."""

    # Common breakpoints
    BREAKPOINTS = {
        "mobile": 480,
        "tablet": 768,
        "desktop": 1024,
        "wide": 1200
    }

    def __init__(self):
        self.results = {}

    def analyze(
        self,
        soup: BeautifulSoup,
        html: str,
        css_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze page responsive design.

        Args:
            soup: BeautifulSoup object
            html: Raw HTML content
            css_content: Combined CSS content (optional)

        Returns:
            Responsive analysis results
        """
        self.results = {
            "is_mobile_friendly": False,
            "has_viewport_meta": False,
            "viewport_content": None,
            "viewport_issues": [],
            "has_media_queries": False,
            "media_query_count": 0,
            "detected_breakpoints": [],
            "uses_responsive_images": False,
            "responsive_image_techniques": [],
            "uses_flexbox": False,
            "uses_grid": False,
            "has_mobile_menu": False,
            "fixed_width_elements": [],
            "horizontal_scroll_risk": False,
            "touch_friendly": False,
            "font_sizing": "unknown",
            "issues": [],
            "recommendations": [],
            "score": 0
        }

        if not soup:
            return self.results

        # Analyze viewport meta tag
        self._analyze_viewport(soup)

        # Analyze CSS for media queries
        self._analyze_media_queries(soup, html, css_content)

        # Analyze responsive images
        self._analyze_responsive_images(soup)

        # Check for modern CSS layout
        self._analyze_css_layout(soup, html, css_content)

        # Check for mobile navigation patterns
        self._analyze_mobile_navigation(soup, html)

        # Check for fixed width elements
        self._analyze_fixed_widths(soup, html)

        # Check touch-friendliness
        self._analyze_touch_friendliness(soup)

        # Analyze font sizing
        self._analyze_font_sizing(soup, html, css_content)

        # Calculate overall mobile-friendliness
        self._calculate_mobile_friendly()

        # Generate recommendations
        self._generate_recommendations()

        return self.results

    def _analyze_viewport(self, soup: BeautifulSoup):
        """Analyze viewport meta tag."""
        viewport = soup.find("meta", {"name": "viewport"})

        if viewport:
            self.results["has_viewport_meta"] = True
            content = viewport.get("content", "")
            self.results["viewport_content"] = content

            # Check for proper viewport configuration
            content_lower = content.lower()

            if "width=device-width" not in content_lower:
                self.results["viewport_issues"].append("Missing width=device-width")

            if "initial-scale=1" not in content_lower and "initial-scale=1.0" not in content_lower:
                self.results["viewport_issues"].append("Missing initial-scale=1")

            if "maximum-scale=1" in content_lower or "user-scalable=no" in content_lower:
                self.results["viewport_issues"].append("Zoom disabled - accessibility issue")

    def _analyze_media_queries(
        self,
        soup: BeautifulSoup,
        html: str,
        css_content: Optional[str]
    ):
        """Analyze CSS media queries."""
        # Look for media queries in inline styles
        media_patterns = [
            r'@media[^{]+\{',
            r'@media\s+screen',
            r'@media\s+\(max-width',
            r'@media\s+\(min-width'
        ]

        all_css = ""

        # Collect inline CSS
        for style in soup.find_all("style"):
            if style.string:
                all_css += style.string

        # Add external CSS content if provided
        if css_content:
            all_css += css_content

        # Check HTML for media query indicators
        if any(re.search(p, all_css, re.I) for p in media_patterns):
            self.results["has_media_queries"] = True

        # Count media queries
        media_matches = re.findall(r'@media[^{]+\{', all_css, re.I)
        self.results["media_query_count"] = len(media_matches)

        # Extract breakpoints
        breakpoint_pattern = r'@media[^{]*(?:max|min)-width\s*:\s*(\d+)'
        breakpoints = re.findall(breakpoint_pattern, all_css, re.I)
        self.results["detected_breakpoints"] = sorted(list(set(int(bp) for bp in breakpoints)))

    def _analyze_responsive_images(self, soup: BeautifulSoup):
        """Analyze responsive image techniques."""
        techniques = []

        # Check for srcset
        srcset_images = soup.find_all("img", srcset=True)
        if srcset_images:
            techniques.append("srcset")
            self.results["uses_responsive_images"] = True

        # Check for picture element
        picture_elements = soup.find_all("picture")
        if picture_elements:
            techniques.append("picture element")
            self.results["uses_responsive_images"] = True

        # Check for sizes attribute
        sizes_images = soup.find_all("img", sizes=True)
        if sizes_images:
            techniques.append("sizes attribute")

        # Check for lazy loading
        lazy_images = soup.find_all("img", loading="lazy")
        if lazy_images:
            techniques.append("lazy loading")

        # Check for max-width: 100% pattern
        for img in soup.find_all("img", style=True):
            style = img.get("style", "")
            if "max-width" in style and "100%" in style:
                techniques.append("max-width:100%")
                self.results["uses_responsive_images"] = True
                break

        self.results["responsive_image_techniques"] = list(set(techniques))

    def _analyze_css_layout(
        self,
        soup: BeautifulSoup,
        html: str,
        css_content: Optional[str]
    ):
        """Check for modern CSS layout techniques."""
        all_content = html
        if css_content:
            all_content += css_content

        # Check for flexbox
        flexbox_patterns = [
            r'display\s*:\s*flex',
            r'display\s*:\s*inline-flex',
            r'flex-direction',
            r'flex-wrap',
            r'justify-content',
            r'align-items'
        ]

        for pattern in flexbox_patterns:
            if re.search(pattern, all_content, re.I):
                self.results["uses_flexbox"] = True
                break

        # Check for CSS Grid
        grid_patterns = [
            r'display\s*:\s*grid',
            r'display\s*:\s*inline-grid',
            r'grid-template',
            r'grid-column',
            r'grid-row'
        ]

        for pattern in grid_patterns:
            if re.search(pattern, all_content, re.I):
                self.results["uses_grid"] = True
                break

    def _analyze_mobile_navigation(self, soup: BeautifulSoup, html: str):
        """Check for mobile navigation patterns."""
        mobile_menu_indicators = [
            r'hamburger',
            r'mobile-menu',
            r'mobile-nav',
            r'nav-toggle',
            r'menu-toggle',
            r'burger-menu',
            r'navbar-toggler',
            r'menu-icon',
            r'navicon'
        ]

        html_lower = html.lower()

        for indicator in mobile_menu_indicators:
            if re.search(indicator, html_lower):
                self.results["has_mobile_menu"] = True
                break

        # Also check for common mobile menu button patterns
        menu_buttons = soup.find_all(
            ["button", "div", "a"],
            class_=re.compile(r'menu|nav|toggle|hamburger', re.I)
        )
        if menu_buttons:
            self.results["has_mobile_menu"] = True

    def _analyze_fixed_widths(self, soup: BeautifulSoup, html: str):
        """Check for potentially problematic fixed width elements."""
        # Look for fixed pixel widths in inline styles
        fixed_width_pattern = r'width\s*:\s*(\d{4,})px'

        for elem in soup.find_all(style=True):
            style = elem.get("style", "")
            matches = re.findall(fixed_width_pattern, style)
            if matches:
                for width in matches:
                    if int(width) > 500:
                        tag_name = elem.name
                        self.results["fixed_width_elements"].append(
                            f"{tag_name} with width: {width}px"
                        )

        # Check for tables without responsive handling
        tables = soup.find_all("table")
        for table in tables:
            style = table.get("style", "")
            class_attr = table.get("class", [])

            has_responsive = any(
                "responsive" in str(c).lower() or
                "mobile" in str(c).lower()
                for c in class_attr
            )

            if not has_responsive and "width" in style and "px" in style:
                self.results["fixed_width_elements"].append("table with fixed width")

        if self.results["fixed_width_elements"]:
            self.results["horizontal_scroll_risk"] = True

    def _analyze_touch_friendliness(self, soup: BeautifulSoup):
        """Analyze touch-friendliness of interactive elements."""
        # Check link/button sizing (44x44 minimum recommended)
        touch_indicators = 0
        issues = 0

        # Check for touch-action CSS
        for elem in soup.find_all(style=True):
            if "touch-action" in elem.get("style", ""):
                touch_indicators += 1

        # Check for reasonable button/link sizing hints
        buttons = soup.find_all(["button", "a"])
        for btn in buttons[:10]:  # Sample first 10
            style = btn.get("style", "")
            classes = " ".join(btn.get("class", []))

            # Look for indicators of proper sizing
            if any(s in style.lower() + classes.lower() for s in ["btn", "button", "nav"]):
                touch_indicators += 1

        self.results["touch_friendly"] = touch_indicators > 3

    def _analyze_font_sizing(
        self,
        soup: BeautifulSoup,
        html: str,
        css_content: Optional[str]
    ):
        """Analyze font sizing approach."""
        all_content = html
        if css_content:
            all_content += css_content

        # Check for relative units
        uses_rem = "rem" in all_content
        uses_em = re.search(r'\dem\b', all_content) is not None
        uses_vw = "vw" in all_content

        # Check for px-only fonts
        font_px_only = re.findall(r'font-size\s*:\s*\d+px', all_content, re.I)

        if uses_rem or uses_em:
            self.results["font_sizing"] = "relative"
        elif uses_vw:
            self.results["font_sizing"] = "viewport"
        elif font_px_only:
            self.results["font_sizing"] = "fixed"
        else:
            self.results["font_sizing"] = "default"

    def _calculate_mobile_friendly(self):
        """Calculate overall mobile-friendliness."""
        score = 0

        # Viewport meta (25 points)
        if self.results["has_viewport_meta"]:
            score += 20
            if not self.results["viewport_issues"]:
                score += 5

        # Media queries (20 points)
        if self.results["has_media_queries"]:
            score += 15
            if self.results["media_query_count"] >= 3:
                score += 5

        # Responsive images (15 points)
        if self.results["uses_responsive_images"]:
            score += 15

        # Modern CSS layout (15 points)
        if self.results["uses_flexbox"] or self.results["uses_grid"]:
            score += 15

        # Mobile navigation (10 points)
        if self.results["has_mobile_menu"]:
            score += 10

        # No fixed width issues (10 points)
        if not self.results["horizontal_scroll_risk"]:
            score += 10

        # Touch friendly (5 points)
        if self.results["touch_friendly"]:
            score += 5

        self.results["score"] = min(score, 100)
        self.results["is_mobile_friendly"] = score >= 60

    def _generate_recommendations(self):
        """Generate responsive design recommendations."""
        if not self.results["has_viewport_meta"]:
            self.results["issues"].append("Missing viewport meta tag")
            self.results["recommendations"].append(
                'Add <meta name="viewport" content="width=device-width, initial-scale=1">'
            )

        if self.results["viewport_issues"]:
            self.results["issues"].extend(self.results["viewport_issues"])

        if not self.results["has_media_queries"]:
            self.results["issues"].append("No CSS media queries detected")
            self.results["recommendations"].append(
                "Implement responsive breakpoints using CSS media queries"
            )

        if not self.results["uses_responsive_images"]:
            self.results["issues"].append("No responsive image techniques detected")
            self.results["recommendations"].append(
                "Use srcset, picture elements, or max-width:100% for images"
            )

        if not self.results["uses_flexbox"] and not self.results["uses_grid"]:
            self.results["recommendations"].append(
                "Consider using Flexbox or CSS Grid for responsive layouts"
            )

        if not self.results["has_mobile_menu"] and self.results["has_viewport_meta"]:
            self.results["recommendations"].append(
                "Consider adding a mobile-friendly navigation menu"
            )

        if self.results["horizontal_scroll_risk"]:
            self.results["issues"].append("Fixed width elements may cause horizontal scrolling")
            for elem in self.results["fixed_width_elements"][:3]:
                self.results["issues"].append(f"  - {elem}")
            self.results["recommendations"].append(
                "Use relative widths (%, vw) instead of fixed pixel widths"
            )


def analyze_responsive(
    soup: BeautifulSoup,
    html: str,
    css_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function for responsive analysis.

    Args:
        soup: BeautifulSoup object
        html: Raw HTML content
        css_content: Combined CSS content (optional)

    Returns:
        Responsive analysis results
    """
    analyzer = ResponsiveAnalyzer()
    return analyzer.analyze(soup, html, css_content)
