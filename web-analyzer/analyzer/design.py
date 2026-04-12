"""
Design analysis module - estimates website age and detects outdated design patterns.
"""

import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup


class DesignAnalyzer:
    """Analyze website design age and modernity."""

    # Outdated technology patterns
    OUTDATED_PATTERNS = {
        "flash": {
            "patterns": [r"\.swf", r"flash", r"shockwave"],
            "age_indicator": "very_old",
            "description": "Flash content detected"
        },
        "old_jquery_ui": {
            "patterns": [r"jquery-ui.*1\.[0-8]", r"jquery\.ui.*1\.[0-8]"],
            "age_indicator": "old",
            "description": "Old jQuery UI version"
        },
        "old_bootstrap": {
            "patterns": [r"bootstrap.*[23]\.\d", r"bootstrap/[23]\."],
            "age_indicator": "moderate",
            "description": "Old Bootstrap version (2.x or 3.x)"
        },
        "tables_layout": {
            "patterns": [r'<table[^>]*(?:cellpadding|cellspacing|bgcolor|align)[^>]*>'],
            "age_indicator": "old",
            "description": "Table-based layout detected"
        },
        "inline_styles_heavy": {
            "patterns": [],  # Checked separately
            "age_indicator": "moderate",
            "description": "Heavy use of inline styles"
        },
        "font_tags": {
            "patterns": [r"<font\b"],
            "age_indicator": "very_old",
            "description": "Deprecated <font> tags"
        },
        "marquee": {
            "patterns": [r"<marquee\b"],
            "age_indicator": "very_old",
            "description": "Deprecated <marquee> tags"
        },
        "blink": {
            "patterns": [r"<blink\b"],
            "age_indicator": "very_old",
            "description": "Deprecated <blink> tags"
        },
        "frames": {
            "patterns": [r"<frameset\b", r"<frame\b", r"<iframe[^>]*frameborder"],
            "age_indicator": "old",
            "description": "Old frame-based layout"
        },
        "old_doctype": {
            "patterns": [r"<!DOCTYPE\s+HTML\s+PUBLIC", r"XHTML\s+1\.0\s+Transitional"],
            "age_indicator": "moderate",
            "description": "Old DOCTYPE declaration"
        }
    }

    # Modern design indicators
    MODERN_PATTERNS = {
        "css_variables": {
            "patterns": [r"--[\w-]+\s*:", r"var\(--"],
            "description": "CSS custom properties"
        },
        "modern_fonts": {
            "patterns": [r"font-display", r"woff2", r"variable\s*font"],
            "description": "Modern font loading"
        },
        "modern_images": {
            "patterns": [r"\.webp", r"\.avif", r"srcset", r"loading=['\"]lazy['\"]"],
            "description": "Modern image formats/techniques"
        },
        "modern_css": {
            "patterns": [r"display\s*:\s*grid", r"display\s*:\s*flex", r"clamp\("],
            "description": "Modern CSS layout"
        },
        "dark_mode": {
            "patterns": [r"prefers-color-scheme", r"dark-mode", r"theme-dark"],
            "description": "Dark mode support"
        },
        "animations": {
            "patterns": [r"@keyframes", r"transition\s*:", r"transform\s*:"],
            "description": "CSS animations/transitions"
        },
        "scroll_behavior": {
            "patterns": [r"scroll-behavior\s*:\s*smooth", r"scroll-snap"],
            "description": "Modern scroll features"
        }
    }

    def __init__(self):
        self.results = {}
        self.current_year = datetime.now().year

    def analyze(
        self,
        soup: BeautifulSoup,
        html: str,
        css_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze page design age and patterns.

        Args:
            soup: BeautifulSoup object
            html: Raw HTML content
            css_content: Combined CSS content (optional)

        Returns:
            Design analysis results
        """
        self.results = {
            "estimated_age": "unknown",
            "estimated_year": None,
            "copyright_year": None,
            "last_modified_hints": [],
            "design_indicators": [],
            "outdated_patterns": [],
            "modern_patterns": [],
            "design_quality": "unknown",
            "is_outdated": False,
            "age_score": 0,  # 0-100, higher = older
            "issues": [],
            "recommendations": []
        }

        if not soup or not html:
            return self.results

        all_content = html
        if css_content:
            all_content += css_content

        # Find copyright year
        self._find_copyright_year(soup, html)

        # Find last modified hints
        self._find_modification_hints(soup, html)

        # Detect outdated patterns
        self._detect_outdated_patterns(html, all_content)

        # Detect modern patterns
        self._detect_modern_patterns(all_content)

        # Check inline styles usage
        self._analyze_inline_styles(soup)

        # Estimate design age
        self._estimate_age()

        # Generate recommendations
        self._generate_recommendations()

        return self.results

    def _find_copyright_year(self, soup: BeautifulSoup, html: str):
        """Find copyright year in footer or page content."""
        # Common copyright patterns
        patterns = [
            r'(?:copyright|©|\(c\))\s*(?:19|20)(\d{2})',
            r'(?:19|20)(\d{2})\s*(?:copyright|©|\(c\))',
            r'©\s*(?:19|20)(\d{2})',
            r'(?:19|20)(\d{2})\s*-\s*(?:19|20)(\d{2})',  # Range like 2010-2024
        ]

        html_lower = html.lower()
        years_found = []

        for pattern in patterns:
            matches = re.findall(pattern, html_lower, re.I)
            for match in matches:
                if isinstance(match, tuple):
                    # For range patterns, take the most recent year
                    for y in match:
                        if y:
                            year = int(f"20{y}" if len(y) == 2 and int(y) < 50 else f"19{y}" if len(y) == 2 else y)
                            years_found.append(year)
                else:
                    year = int(f"20{match}" if int(match) < 50 else f"19{match}")
                    years_found.append(year)

        if years_found:
            # Filter reasonable years
            valid_years = [y for y in years_found if 1995 <= y <= self.current_year]
            if valid_years:
                self.results["copyright_year"] = max(valid_years)

    def _find_modification_hints(self, soup: BeautifulSoup, html: str):
        """Find hints about when the site was last modified."""
        hints = []

        # Check meta tags
        for meta in soup.find_all("meta"):
            name = meta.get("name", "").lower()
            content = meta.get("content", "")

            if name in ["date", "last-modified", "dcterms.modified"]:
                hints.append(f"Meta tag '{name}': {content}")

        # Check for date patterns in blog/news posts
        date_patterns = [
            r'(?:posted|published|updated|modified)\s*(?:on)?\s*:?\s*([\w\s,]+\d{4})',
            r'\d{1,2}[/-]\d{1,2}[/-](20\d{2})',
        ]

        for pattern in date_patterns:
            matches = re.findall(pattern, html, re.I)[:3]
            for match in matches:
                hints.append(f"Content date: {match}")

        self.results["last_modified_hints"] = hints[:5]

    def _detect_outdated_patterns(self, html: str, all_content: str):
        """Detect outdated design and technology patterns."""
        html_lower = html.lower()
        all_lower = all_content.lower()

        for pattern_name, pattern_info in self.OUTDATED_PATTERNS.items():
            for pattern in pattern_info["patterns"]:
                if re.search(pattern, all_lower, re.I):
                    self.results["outdated_patterns"].append({
                        "type": pattern_name,
                        "description": pattern_info["description"],
                        "age_indicator": pattern_info["age_indicator"]
                    })
                    self.results["design_indicators"].append(
                        f"Outdated: {pattern_info['description']}"
                    )
                    break

    def _detect_modern_patterns(self, all_content: str):
        """Detect modern design patterns."""
        all_lower = all_content.lower()

        for pattern_name, pattern_info in self.MODERN_PATTERNS.items():
            for pattern in pattern_info["patterns"]:
                if re.search(pattern, all_lower, re.I):
                    self.results["modern_patterns"].append({
                        "type": pattern_name,
                        "description": pattern_info["description"]
                    })
                    self.results["design_indicators"].append(
                        f"Modern: {pattern_info['description']}"
                    )
                    break

    def _analyze_inline_styles(self, soup: BeautifulSoup):
        """Analyze inline style usage."""
        elements_with_style = soup.find_all(style=True)
        total_elements = len(soup.find_all())

        if total_elements > 0:
            inline_ratio = len(elements_with_style) / total_elements

            if inline_ratio > 0.3:  # More than 30% have inline styles
                self.results["outdated_patterns"].append({
                    "type": "inline_styles_heavy",
                    "description": f"Heavy inline styles ({len(elements_with_style)} elements)",
                    "age_indicator": "moderate"
                })
                self.results["design_indicators"].append(
                    f"Heavy inline styles: {len(elements_with_style)} elements"
                )

    def _estimate_age(self):
        """Estimate the design age based on all indicators."""
        age_score = 50  # Start neutral

        # Outdated patterns increase age score
        for pattern in self.results["outdated_patterns"]:
            indicator = pattern["age_indicator"]
            if indicator == "very_old":
                age_score += 20
            elif indicator == "old":
                age_score += 15
            elif indicator == "moderate":
                age_score += 8

        # Modern patterns decrease age score
        for _ in self.results["modern_patterns"]:
            age_score -= 10

        # Copyright year influence
        if self.results["copyright_year"]:
            years_old = self.current_year - self.results["copyright_year"]
            if years_old >= 5:
                age_score += years_old * 3
            elif years_old <= 1:
                age_score -= 15

        # Clamp score
        age_score = max(0, min(100, age_score))
        self.results["age_score"] = age_score

        # Determine estimated age category
        if age_score >= 80:
            self.results["estimated_age"] = "very_old"
            self.results["design_quality"] = "severely_outdated"
            self.results["is_outdated"] = True
        elif age_score >= 60:
            self.results["estimated_age"] = "old"
            self.results["design_quality"] = "outdated"
            self.results["is_outdated"] = True
        elif age_score >= 40:
            self.results["estimated_age"] = "moderate"
            self.results["design_quality"] = "dated"
            self.results["is_outdated"] = True
        elif age_score >= 20:
            self.results["estimated_age"] = "recent"
            self.results["design_quality"] = "acceptable"
            self.results["is_outdated"] = False
        else:
            self.results["estimated_age"] = "modern"
            self.results["design_quality"] = "modern"
            self.results["is_outdated"] = False

        # Estimate year
        if age_score >= 80:
            self.results["estimated_year"] = self.current_year - 10
        elif age_score >= 60:
            self.results["estimated_year"] = self.current_year - 7
        elif age_score >= 40:
            self.results["estimated_year"] = self.current_year - 4
        elif age_score >= 20:
            self.results["estimated_year"] = self.current_year - 2
        else:
            self.results["estimated_year"] = self.current_year

    def _generate_recommendations(self):
        """Generate design update recommendations."""
        for pattern in self.results["outdated_patterns"]:
            ptype = pattern["type"]

            if ptype == "flash":
                self.results["issues"].append("Flash content is obsolete and unsupported")
                self.results["recommendations"].append(
                    "Replace Flash content with HTML5/CSS3/JavaScript alternatives"
                )
            elif ptype in ["old_jquery_ui", "old_bootstrap"]:
                self.results["issues"].append(pattern["description"])
                self.results["recommendations"].append(
                    f"Update to latest version or consider modern alternatives"
                )
            elif ptype == "tables_layout":
                self.results["issues"].append("Table-based layout is outdated")
                self.results["recommendations"].append(
                    "Refactor to CSS Grid or Flexbox layout"
                )
            elif ptype in ["font_tags", "marquee", "blink"]:
                self.results["issues"].append(f"Deprecated HTML: {pattern['description']}")
                self.results["recommendations"].append(
                    "Replace deprecated tags with modern CSS"
                )
            elif ptype == "frames":
                self.results["issues"].append("Frame-based layout detected")
                self.results["recommendations"].append(
                    "Convert to single-page layout with modern navigation"
                )
            elif ptype == "inline_styles_heavy":
                self.results["issues"].append("Heavy reliance on inline styles")
                self.results["recommendations"].append(
                    "Move styles to external CSS files for maintainability"
                )

        if self.results["is_outdated"] and not self.results["modern_patterns"]:
            self.results["recommendations"].append(
                "Consider a complete website redesign with modern standards"
            )


def analyze_design(
    soup: BeautifulSoup,
    html: str,
    css_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function for design analysis.

    Args:
        soup: BeautifulSoup object
        html: Raw HTML content
        css_content: Combined CSS content (optional)

    Returns:
        Design analysis results
    """
    analyzer = DesignAnalyzer()
    return analyzer.analyze(soup, html, css_content)
