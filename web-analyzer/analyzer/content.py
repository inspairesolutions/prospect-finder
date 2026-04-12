"""
Content extraction module - extracts contact information and page metrics.
"""

import re
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup


class ContentAnalyzer:
    """Extract content and contact information from websites."""

    # Email patterns
    EMAIL_PATTERN = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'

    # Phone patterns (various formats)
    PHONE_PATTERNS = [
        r'\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',  # US format
        r'\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}',  # International
        r'\(\d{2,4}\)\s*\d{3,4}[-.\s]?\d{3,4}',  # With area code
    ]

    # Social media patterns
    SOCIAL_PLATFORMS = {
        "facebook": [r"facebook\.com/[\w.-]+", r"fb\.com/[\w.-]+"],
        "twitter": [r"twitter\.com/[\w.-]+", r"x\.com/[\w.-]+"],
        "instagram": [r"instagram\.com/[\w.-]+"],
        "linkedin": [r"linkedin\.com/(?:company|in)/[\w.-]+"],
        "youtube": [r"youtube\.com/(?:channel|c|user)/[\w.-]+"],
        "tiktok": [r"tiktok\.com/@[\w.-]+"],
        "pinterest": [r"pinterest\.com/[\w.-]+"]
    }

    def __init__(self):
        self.results = {}

    def analyze(
        self,
        url: str,
        soup: BeautifulSoup,
        html: str
    ) -> Dict[str, Any]:
        """
        Analyze page content and extract information.

        Args:
            url: Page URL
            soup: BeautifulSoup object
            html: Raw HTML content

        Returns:
            Content analysis results
        """
        self.results = {
            "emails": [],
            "phones": [],
            "address": None,
            "social_media": {},
            "contact_page": None,
            "has_contact_form": False,
            "estimated_pages": 0,
            "navigation_links": [],
            "word_count": 0,
            "has_blog": False,
            "has_shop": False,
            "languages": [],
            "company_name": None,
            "industry_hints": [],
            "content_quality": "unknown"
        }

        if not soup:
            return self.results

        # Extract contact information
        self._extract_emails(soup, html)
        self._extract_phones(html)
        self._extract_address(soup, html)
        self._extract_social_media(soup, html)

        # Find contact page
        self._find_contact_page(soup, url)

        # Check for contact form
        self._check_contact_form(soup)

        # Analyze navigation and estimate pages
        self._analyze_navigation(soup, url)

        # Analyze content
        self._analyze_content(soup, html)

        # Extract company name
        self._extract_company_name(soup)

        # Detect content types
        self._detect_content_types(soup, html)

        return self.results

    def _extract_emails(self, soup: BeautifulSoup, html: str):
        """Extract email addresses from page."""
        emails = set()

        # Find emails in text content
        text_emails = re.findall(self.EMAIL_PATTERN, html)
        emails.update(text_emails)

        # Find emails in mailto links
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if href.startswith("mailto:"):
                email = href.replace("mailto:", "").split("?")[0]
                if re.match(self.EMAIL_PATTERN, email):
                    emails.add(email)

        # Filter out common false positives
        filtered = [
            e for e in emails
            if not any(x in e.lower() for x in [
                "example.com", "email.com", "domain.com",
                "yoursite.com", "yourdomain.com", "sentry.io",
                ".png", ".jpg", ".gif", "wixpress.com"
            ])
        ]

        self.results["emails"] = list(filtered)[:10]  # Limit to 10

    def _extract_phones(self, html: str):
        """Extract phone numbers from page."""
        phones = set()

        for pattern in self.PHONE_PATTERNS:
            matches = re.findall(pattern, html)
            for match in matches:
                # Clean up the phone number
                cleaned = re.sub(r'[^\d+()-.\s]', '', match)
                if len(re.sub(r'[^\d]', '', cleaned)) >= 7:  # At least 7 digits
                    phones.add(cleaned.strip())

        self.results["phones"] = list(phones)[:5]  # Limit to 5

    def _extract_address(self, soup: BeautifulSoup, html: str):
        """Extract physical address from page."""
        # Look for schema.org address
        address_elem = soup.find(itemtype=re.compile(r"schema\.org/PostalAddress"))
        if address_elem:
            self.results["address"] = address_elem.get_text(strip=True)[:200]
            return

        # Look for address in structured elements
        address_patterns = [
            (r'class', re.compile(r'address|location', re.I)),
            (r'id', re.compile(r'address|location', re.I)),
            (r'itemprop', 'address'),
        ]

        for attr, value in address_patterns:
            elem = soup.find(attrs={attr: value})
            if elem:
                text = elem.get_text(strip=True)
                if len(text) > 10 and len(text) < 300:
                    self.results["address"] = text
                    return

        # Look for common address patterns in footer
        footer = soup.find("footer") or soup.find(class_=re.compile(r'footer', re.I))
        if footer:
            # Look for ZIP code pattern
            zip_pattern = r'\b\d{5}(?:-\d{4})?\b'
            footer_text = footer.get_text()
            if re.search(zip_pattern, footer_text):
                # Try to extract the address context
                lines = footer_text.split('\n')
                for i, line in enumerate(lines):
                    if re.search(zip_pattern, line):
                        # Get surrounding context
                        start = max(0, i - 2)
                        end = min(len(lines), i + 2)
                        address = ' '.join(lines[start:end]).strip()
                        if 20 < len(address) < 200:
                            self.results["address"] = address
                            return

    def _extract_social_media(self, soup: BeautifulSoup, html: str):
        """Extract social media links."""
        social = {}

        for platform, patterns in self.SOCIAL_PLATFORMS.items():
            for pattern in patterns:
                match = re.search(pattern, html, re.I)
                if match:
                    social[platform] = match.group()
                    break

        # Also check actual links
        for link in soup.find_all("a", href=True):
            href = link.get("href", "").lower()
            for platform, patterns in self.SOCIAL_PLATFORMS.items():
                if platform not in social:
                    for pattern in patterns:
                        if re.search(pattern, href, re.I):
                            social[platform] = href
                            break

        self.results["social_media"] = social

    def _find_contact_page(self, soup: BeautifulSoup, base_url: str):
        """Find link to contact page."""
        contact_keywords = ["contact", "contacto", "kontakt", "get in touch", "reach us"]

        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True).lower()
            href = link.get("href", "").lower()

            for keyword in contact_keywords:
                if keyword in text or keyword in href:
                    full_url = urljoin(base_url, link.get("href"))
                    self.results["contact_page"] = full_url
                    return

    def _check_contact_form(self, soup: BeautifulSoup):
        """Check if page has a contact form."""
        forms = soup.find_all("form")

        for form in forms:
            form_html = str(form).lower()

            # Check for contact form indicators
            if any(indicator in form_html for indicator in [
                "contact", "message", "inquiry", "email",
                "name", "phone", "submit", "send"
            ]):
                # Count form inputs
                inputs = form.find_all(["input", "textarea"])
                if len(inputs) >= 2:  # At least name/email and message
                    self.results["has_contact_form"] = True
                    return

    def _analyze_navigation(self, soup: BeautifulSoup, base_url: str):
        """Analyze navigation structure."""
        nav_links = []
        parsed_base = urlparse(base_url)

        # Find navigation elements
        navs = soup.find_all(["nav", "header"])
        if not navs:
            navs = [soup]

        for nav in navs:
            for link in nav.find_all("a", href=True):
                href = link.get("href", "")
                text = link.get_text(strip=True)

                if not text or not href:
                    continue

                # Skip external links, anchors, and special links
                if href.startswith(("#", "javascript:", "mailto:", "tel:")):
                    continue

                # Parse and check if internal
                parsed_href = urlparse(urljoin(base_url, href))
                if parsed_href.netloc == parsed_base.netloc or not parsed_href.netloc:
                    nav_links.append({
                        "text": text[:50],
                        "url": urljoin(base_url, href)
                    })

        # Deduplicate by URL
        seen = set()
        unique_links = []
        for link in nav_links:
            if link["url"] not in seen:
                seen.add(link["url"])
                unique_links.append(link)

        self.results["navigation_links"] = unique_links[:20]
        self.results["estimated_pages"] = len(unique_links) + 1  # +1 for homepage

    def _analyze_content(self, soup: BeautifulSoup, html: str):
        """Analyze page content quality."""
        # Get text content
        text = soup.get_text(separator=' ', strip=True)
        words = text.split()
        self.results["word_count"] = len(words)

        # Assess content quality
        if len(words) > 1000:
            self.results["content_quality"] = "comprehensive"
        elif len(words) > 300:
            self.results["content_quality"] = "adequate"
        elif len(words) > 100:
            self.results["content_quality"] = "thin"
        else:
            self.results["content_quality"] = "minimal"

        # Detect language
        html_lang = soup.find("html")
        if html_lang:
            lang = html_lang.get("lang")
            if lang:
                self.results["languages"].append(lang)

        # Check for language switcher
        lang_patterns = [
            r'lang[uage]?[-_]switch',
            r'wpml-ls',
            r'polylang',
            r'translatepress'
        ]
        for pattern in lang_patterns:
            if re.search(pattern, html, re.I):
                self.results["languages"].append("multilingual")
                break

    def _extract_company_name(self, soup: BeautifulSoup):
        """Try to extract company name."""
        # Check title
        title = soup.find("title")
        if title:
            title_text = title.get_text(strip=True)
            # Often company name is before " - " or " | "
            parts = re.split(r'\s*[-|]\s*', title_text)
            if parts:
                self.results["company_name"] = parts[0].strip()[:100]
                return

        # Check for logo alt text
        logo = soup.find("img", class_=re.compile(r'logo', re.I))
        if logo:
            alt = logo.get("alt", "")
            if alt and len(alt) < 50:
                self.results["company_name"] = alt

    def _detect_content_types(self, soup: BeautifulSoup, html: str):
        """Detect blog, shop, and other content types."""
        html_lower = html.lower()

        # Check for blog
        blog_indicators = [
            r'/blog/', r'/news/', r'/articles/',
            r'class=["\'][^"\']*blog', r'category', r'wp-post'
        ]
        for indicator in blog_indicators:
            if re.search(indicator, html_lower):
                self.results["has_blog"] = True
                break

        # Check for shop/ecommerce
        shop_indicators = [
            r'/shop/', r'/store/', r'/products/', r'/cart/',
            r'add.to.cart', r'woocommerce', r'shopify',
            r'class=["\'][^"\']*product', r'price'
        ]
        for indicator in shop_indicators:
            if re.search(indicator, html_lower):
                self.results["has_shop"] = True
                break

        # Detect industry hints
        industry_keywords = {
            "restaurant": ["menu", "reservations", "cuisine", "dining"],
            "real_estate": ["listings", "properties", "realtor", "mls"],
            "healthcare": ["patients", "appointments", "medical", "health"],
            "legal": ["attorney", "lawyer", "legal", "law firm"],
            "automotive": ["vehicles", "dealership", "cars", "automotive"],
            "construction": ["contractor", "construction", "building", "remodeling"],
            "fitness": ["gym", "fitness", "workout", "training"],
            "beauty": ["salon", "spa", "beauty", "hair"],
            "education": ["courses", "learning", "students", "education"],
            "hospitality": ["hotel", "rooms", "booking", "accommodation"]
        }

        for industry, keywords in industry_keywords.items():
            matches = sum(1 for kw in keywords if kw in html_lower)
            if matches >= 2:
                self.results["industry_hints"].append(industry)


def analyze_content(
    url: str,
    soup: BeautifulSoup,
    html: str
) -> Dict[str, Any]:
    """
    Convenience function for content analysis.

    Args:
        url: Page URL
        soup: BeautifulSoup object
        html: Raw HTML content

    Returns:
        Content analysis results
    """
    analyzer = ContentAnalyzer()
    return analyzer.analyze(url, soup, html)
