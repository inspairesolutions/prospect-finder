"""
Tests for the Web Analyzer modules.
"""

import pytest
from bs4 import BeautifulSoup

from analyzer.technology import analyze_technology, TechnologyAnalyzer
from analyzer.design import analyze_design, DesignAnalyzer
from analyzer.performance import PerformanceAnalyzer
from analyzer.responsive import analyze_responsive
from analyzer.seo import analyze_seo
from analyzer.content import analyze_content
from analyzer.business import analyze_business
from analyzer.scoring import calculate_prospect_score


# Sample HTML fixtures
WORDPRESS_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="generator" content="WordPress 6.4">
    <title>Test WordPress Site</title>
    <meta name="description" content="A test WordPress website for analysis.">
    <link rel="stylesheet" href="/wp-content/themes/theme/style.css">
    <script src="/wp-includes/js/jquery.min.js"></script>
</head>
<body>
    <header>
        <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
        </nav>
    </header>
    <main>
        <h1>Welcome to Our Site</h1>
        <p>This is a test WordPress site.</p>
        <img src="/image.jpg" alt="Test image">
    </main>
    <footer>
        <p>Copyright 2022 Test Company</p>
        <p>Contact: info@testcompany.com | Phone: 555-123-4567</p>
        <p>123 Main St, City, State 12345</p>
    </footer>
</body>
</html>
"""

OUTDATED_HTML = """
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
    <title>Old Website</title>
</head>
<body bgcolor="#ffffff">
    <center>
        <font size="5" color="blue">Welcome!</font>
    </center>
    <table width="800" cellpadding="5" cellspacing="0" border="1">
        <tr>
            <td valign="top">
                <marquee>Breaking News!</marquee>
            </td>
        </tr>
    </table>
    <p>Copyright 2015</p>
</body>
</html>
"""

MODERN_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modern Site | Company Name</title>
    <meta name="description" content="A modern, responsive website with great design.">
    <meta property="og:title" content="Modern Site">
    <meta property="og:description" content="A modern website">
    <link rel="canonical" href="https://example.com">
    <style>
        :root {
            --primary-color: #333;
        }
        .container {
            display: grid;
            grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 768px) {
            .container { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <header>
        <nav class="navbar">
            <a href="/" class="logo">Logo</a>
            <button class="mobile-menu-toggle">Menu</button>
        </nav>
    </header>
    <main>
        <h1>Welcome</h1>
        <picture>
            <source srcset="/image.webp" type="image/webp">
            <img src="/image.jpg" alt="Hero image" loading="lazy">
        </picture>
    </main>
    <footer>
        <p>&copy; 2024 Company Name</p>
    </footer>
</body>
</html>
"""


class TestTechnologyAnalyzer:
    """Tests for technology detection."""

    def test_detect_wordpress(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")
        resources = {
            "css": ["/wp-content/themes/theme/style.css"],
            "js": ["/wp-includes/js/jquery.min.js"],
            "images": []
        }

        result = analyze_technology(soup, WORDPRESS_HTML, resources)

        assert result["cms"] == "wordpress"
        assert "jquery" in result["libraries"]

    def test_detect_no_cms(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")
        resources = {"css": [], "js": [], "images": []}

        result = analyze_technology(soup, MODERN_HTML, resources)

        assert result["cms"] is None

    def test_page_builder_patterns(self):
        analyzer = TechnologyAnalyzer()
        assert "elementor" in analyzer.PAGE_BUILDERS
        assert "divi" in analyzer.PAGE_BUILDERS


class TestDesignAnalyzer:
    """Tests for design age detection."""

    def test_detect_outdated_design(self):
        soup = BeautifulSoup(OUTDATED_HTML, "lxml")

        result = analyze_design(soup, OUTDATED_HTML)

        assert result["is_outdated"] is True
        assert result["age_score"] >= 60
        assert len(result["outdated_patterns"]) > 0

    def test_detect_modern_design(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")

        result = analyze_design(soup, MODERN_HTML)

        assert result["is_outdated"] is False
        assert result["age_score"] < 40
        assert len(result["modern_patterns"]) > 0

    def test_copyright_year_extraction(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")

        result = analyze_design(soup, WORDPRESS_HTML)

        assert result["copyright_year"] == 2022


class TestResponsiveAnalyzer:
    """Tests for responsive design analysis."""

    def test_has_viewport_meta(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")

        result = analyze_responsive(soup, MODERN_HTML)

        assert result["has_viewport_meta"] is True

    def test_no_viewport_meta(self):
        soup = BeautifulSoup(OUTDATED_HTML, "lxml")

        result = analyze_responsive(soup, OUTDATED_HTML)

        assert result["has_viewport_meta"] is False
        assert result["is_mobile_friendly"] is False

    def test_detect_media_queries(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")

        result = analyze_responsive(soup, MODERN_HTML)

        assert result["has_media_queries"] is True

    def test_detect_mobile_menu(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")

        result = analyze_responsive(soup, MODERN_HTML)

        assert result["has_mobile_menu"] is True


class TestSEOAnalyzer:
    """Tests for SEO analysis."""

    def test_has_title(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")

        result = analyze_seo("https://example.com", soup, WORDPRESS_HTML)

        assert result["has_title"] is True
        assert "Test WordPress Site" in result["title"]

    def test_has_meta_description(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")

        result = analyze_seo("https://example.com", soup, WORDPRESS_HTML)

        assert result["has_meta_description"] is True

    def test_has_h1(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")

        result = analyze_seo("https://example.com", soup, WORDPRESS_HTML)

        assert result["has_h1"] is True
        assert result["h1_count"] == 1

    def test_detects_https(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")

        result = analyze_seo("https://example.com", soup, MODERN_HTML)

        assert result["uses_https"] is True

    def test_open_graph_detection(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")

        result = analyze_seo("https://example.com", soup, MODERN_HTML)

        assert result["has_open_graph"] is True


class TestContentAnalyzer:
    """Tests for content extraction."""

    def test_extract_email(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")

        result = analyze_content("https://example.com", soup, WORDPRESS_HTML)

        assert "info@testcompany.com" in result["emails"]

    def test_extract_phone(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")

        result = analyze_content("https://example.com", soup, WORDPRESS_HTML)

        assert len(result["phones"]) > 0

    def test_navigation_links(self):
        soup = BeautifulSoup(WORDPRESS_HTML, "lxml")

        result = analyze_content("https://example.com", soup, WORDPRESS_HTML)

        assert result["estimated_pages"] >= 3


class TestBusinessAnalyzer:
    """Tests for business analysis."""

    def test_detect_local_business(self):
        html_with_local = WORDPRESS_HTML.replace(
            "Test Company",
            "Family Owned Local Business serving our community"
        )
        soup = BeautifulSoup(html_with_local, "lxml")
        content = {"address": "123 Main St"}

        result = analyze_business("https://example.com", soup, html_with_local, content)

        assert result["is_local_business"] is True

    def test_professionalism_score(self):
        soup = BeautifulSoup(MODERN_HTML, "lxml")

        result = analyze_business("https://example.com", soup, MODERN_HTML)

        assert result["professionalism_score"] > 50


class TestProspectScoring:
    """Tests for prospect scoring."""

    def test_high_score_for_outdated_site(self):
        technology = {"cms": "wordpress", "page_builder": None, "frameworks": [], "libraries": ["jquery"]}
        design = {"is_outdated": True, "age_score": 70, "copyright_year": 2018, "outdated_patterns": []}
        performance = {"load_time": 5, "load_time_rating": "poor", "issues": ["slow"]}
        responsive = {"is_mobile_friendly": False, "has_viewport_meta": False, "score": 30}
        seo = {"score": 40, "uses_https": False, "issues": ["missing title"]}
        content = {"emails": ["test@example.com"], "phones": ["555-1234"], "estimated_pages": 5, "has_contact_form": True}
        technical = {"broken_links_count": 3, "js_errors": [], "issues": []}
        business = {"is_local_business": True, "is_franchise": False, "estimated_size": "small", "industry": "restaurant"}

        result = calculate_prospect_score(
            technology, design, performance, responsive,
            seo, content, technical, business
        )

        assert result["total_score"] >= 70
        assert result["category"] == "PRIORIDAD_MAXIMA"

    def test_low_score_for_modern_site(self):
        technology = {"cms": "wix", "page_builder": "wix", "frameworks": ["react"], "libraries": []}
        design = {"is_outdated": False, "age_score": 15, "copyright_year": 2024, "outdated_patterns": []}
        performance = {"load_time": 1.5, "load_time_rating": "good", "issues": []}
        responsive = {"is_mobile_friendly": True, "has_viewport_meta": True, "score": 90}
        seo = {"score": 85, "uses_https": True, "issues": []}
        content = {"emails": [], "phones": [], "estimated_pages": 100, "has_contact_form": False}
        technical = {"broken_links_count": 0, "js_errors": [], "issues": []}
        business = {"is_local_business": False, "is_franchise": True, "estimated_size": "enterprise", "industry": "technology"}

        result = calculate_prospect_score(
            technology, design, performance, responsive,
            seo, content, technical, business
        )

        assert result["total_score"] < 30
        assert result["category"] == "RECHAZAR"

    def test_score_breakdown_present(self):
        technology = {"cms": None, "page_builder": None, "frameworks": [], "libraries": []}
        design = {"is_outdated": False, "age_score": 50, "copyright_year": None, "outdated_patterns": []}
        performance = {"load_time": 2, "load_time_rating": "moderate", "issues": []}
        responsive = {"is_mobile_friendly": True, "has_viewport_meta": True, "score": 60}
        seo = {"score": 60, "uses_https": True, "issues": []}
        content = {"emails": [], "phones": [], "estimated_pages": 10, "has_contact_form": False}
        technical = {"broken_links_count": 0, "js_errors": [], "issues": []}
        business = {"is_local_business": False, "is_franchise": False, "estimated_size": "unknown", "industry": None}

        result = calculate_prospect_score(
            technology, design, performance, responsive,
            seo, content, technical, business
        )

        assert "breakdown" in result
        assert "technology" in result["breakdown"]
        assert "design" in result["breakdown"]
        assert "performance" in result["breakdown"]


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_empty_html(self):
        soup = BeautifulSoup("", "lxml")

        tech_result = analyze_technology(soup, "", {})
        design_result = analyze_design(soup, "")

        assert tech_result["cms"] is None
        assert design_result["estimated_age"] == "unknown"

    def test_malformed_html(self):
        malformed = "<html><head><title>Test</title><body><p>Unclosed"
        soup = BeautifulSoup(malformed, "lxml")

        result = analyze_seo("https://example.com", soup, malformed)

        assert result["has_title"] is True

    def test_none_soup(self):
        result = analyze_responsive(None, "")

        assert result["is_mobile_friendly"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
