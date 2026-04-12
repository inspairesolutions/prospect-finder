"""
Business analysis module - identifies business type, size, and characteristics.
"""

import re
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
from bs4 import BeautifulSoup


class BusinessAnalyzer:
    """Analyze business characteristics from website."""

    # Industry classification keywords
    INDUSTRIES = {
        "restaurant": {
            "keywords": ["menu", "reservations", "cuisine", "dining", "restaurant", "food", "chef", "dishes"],
            "strong_indicators": ["reservations", "menu", "order online", "delivery"]
        },
        "real_estate": {
            "keywords": ["properties", "listings", "realtor", "homes", "real estate", "mls", "for sale", "rent"],
            "strong_indicators": ["mls", "listings", "properties for sale"]
        },
        "healthcare": {
            "keywords": ["patients", "appointments", "medical", "health", "doctor", "clinic", "hospital", "care"],
            "strong_indicators": ["book appointment", "patient portal", "medical"]
        },
        "legal": {
            "keywords": ["attorney", "lawyer", "legal", "law firm", "litigation", "practice areas", "case"],
            "strong_indicators": ["attorney", "law firm", "practice areas"]
        },
        "automotive": {
            "keywords": ["vehicles", "dealership", "cars", "automotive", "inventory", "auto", "truck"],
            "strong_indicators": ["inventory", "dealership", "test drive"]
        },
        "construction": {
            "keywords": ["contractor", "construction", "building", "remodeling", "renovation", "roofing"],
            "strong_indicators": ["free estimate", "contractor", "licensed"]
        },
        "fitness": {
            "keywords": ["gym", "fitness", "workout", "training", "classes", "membership", "personal training"],
            "strong_indicators": ["membership", "classes", "personal training"]
        },
        "beauty": {
            "keywords": ["salon", "spa", "beauty", "hair", "nails", "massage", "skincare", "stylist"],
            "strong_indicators": ["book appointment", "salon", "spa"]
        },
        "education": {
            "keywords": ["courses", "learning", "students", "education", "training", "certification", "classes"],
            "strong_indicators": ["enroll", "courses", "certification"]
        },
        "hospitality": {
            "keywords": ["hotel", "rooms", "booking", "accommodation", "resort", "stay", "guests"],
            "strong_indicators": ["book now", "rooms", "accommodation"]
        },
        "ecommerce": {
            "keywords": ["shop", "cart", "products", "buy", "checkout", "shipping", "orders"],
            "strong_indicators": ["add to cart", "checkout", "shop now"]
        },
        "professional_services": {
            "keywords": ["consulting", "services", "solutions", "expertise", "clients", "projects"],
            "strong_indicators": ["consulting", "our services", "solutions"]
        },
        "manufacturing": {
            "keywords": ["manufacturing", "products", "factory", "production", "industrial", "wholesale"],
            "strong_indicators": ["manufacturing", "custom orders", "wholesale"]
        },
        "technology": {
            "keywords": ["software", "technology", "platform", "saas", "app", "digital", "innovation"],
            "strong_indicators": ["platform", "software", "api"]
        },
        "nonprofit": {
            "keywords": ["donate", "nonprofit", "charity", "mission", "volunteer", "cause", "foundation"],
            "strong_indicators": ["donate", "volunteer", "our mission"]
        }
    }

    # Business size indicators - patterns must be specific phrases, not single words
    # to avoid false positives from platform code or product descriptions
    SIZE_INDICATORS = {
        "small": {
            "patterns": [
                r"small business", r"family[\s-]owned", r"locally owned",
                r"since \d{4}", r"serving.*community", r"mom.and.pop",
                r"one.man", r"solo.founder", r"bootstrapped"
            ],
            "negative_indicators": ["offices worldwide", "enterprise solution"]
        },
        "medium": {
            "patterns": [
                r"\d{2,}\s+(?:employees|team members|staff)",
                r"multiple locations", r"regional offices",
                r"growing team", r"mid.size"
            ],
            "negative_indicators": ["fortune 500", "fortune 100"]
        },
        "enterprise": {
            "patterns": [
                r"enterprise solution", r"enterprise software", r"enterprise client",
                r"global (?:team|offices|presence|operations)",
                r"worldwide (?:offices|locations|operations)",
                r"international (?:offices|team|operations)",
                r"fortune \d{3}", r"nasdaq", r"nyse", r"publicly traded",
                r"(?:thousands|hundreds) of employees"
            ],
            "negative_indicators": ["small business", "startup", "family owned"]
        }
    }

    def __init__(self):
        self.results = {}

    def analyze(
        self,
        url: str,
        soup: BeautifulSoup,
        html: str,
        content_analysis: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Analyze business characteristics.

        Args:
            url: Website URL
            soup: BeautifulSoup object
            html: Raw HTML content
            content_analysis: Results from content analyzer (optional)

        Returns:
            Business analysis results
        """
        self.results = {
            "industry": None,
            "industry_confidence": "low",
            "secondary_industries": [],
            "business_type": "unknown",  # local, franchise, enterprise, startup, etc.
            "estimated_size": "unknown",
            "is_local_business": False,
            "is_franchise": False,
            "has_multiple_locations": False,
            "target_market": "unknown",  # b2b, b2c, both
            "website_purpose": "unknown",  # brochure, ecommerce, lead_gen, informational
            "professionalism_score": 0,  # 0-100
            "business_indicators": [],
            "issues": [],
            "opportunity_factors": []
        }

        if not soup:
            return self.results

        html_lower = html.lower()

        # Determine business size (use a fresh soup to avoid modifying original)
        from bs4 import BeautifulSoup as BS
        soup_for_size = BS(html, "lxml")
        self._detect_business_size(soup_for_size)

        # Check if local business
        self._check_local_business(soup, html_lower, content_analysis)

        # Check for franchise indicators
        self._check_franchise(html_lower)

        # Determine target market
        self._detect_target_market(html_lower)

        # Determine website purpose
        self._detect_website_purpose(soup, html_lower)

        # Calculate professionalism score
        self._calculate_professionalism(soup, html)

        # Identify opportunity factors
        self._identify_opportunities()

        return self.results

    def _detect_industry(self, html_lower: str):
        """Detect the business industry."""
        industry_scores = {}

        for industry, config in self.INDUSTRIES.items():
            score = 0

            # Check regular keywords
            for keyword in config["keywords"]:
                if keyword in html_lower:
                    score += 1

            # Check strong indicators (worth more)
            for indicator in config["strong_indicators"]:
                if indicator in html_lower:
                    score += 3

            if score > 0:
                industry_scores[industry] = score

        if industry_scores:
            # Sort by score
            sorted_industries = sorted(
                industry_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )

            # Set primary industry
            self.results["industry"] = sorted_industries[0][0]
            top_score = sorted_industries[0][1]

            # Set confidence
            if top_score >= 10:
                self.results["industry_confidence"] = "high"
            elif top_score >= 5:
                self.results["industry_confidence"] = "medium"
            else:
                self.results["industry_confidence"] = "low"

            # Set secondary industries
            self.results["secondary_industries"] = [
                ind for ind, score in sorted_industries[1:4]
                if score >= 3
            ]

    def _detect_business_size(self, soup: BeautifulSoup):
        """Estimate business size based on visible text only."""
        # Extract only visible text (exclude scripts, styles, etc.)
        # This prevents false positives from platform code (Shopify, etc.)
        for script in soup(["script", "style", "noscript", "meta", "link"]):
            script.decompose()

        visible_text = soup.get_text(separator=' ', strip=True).lower()

        for size, config in self.SIZE_INDICATORS.items():
            # Check positive patterns
            matches = sum(
                1 for p in config["patterns"]
                if re.search(p, visible_text)
            )

            # Check negative indicators
            negatives = sum(
                1 for p in config["negative_indicators"]
                if p in visible_text
            )

            if matches > 0 and negatives == 0:
                self.results["estimated_size"] = size
                self.results["business_indicators"].append(f"Size indicator: {size}")
                return

        self.results["estimated_size"] = "unknown"

    def _check_local_business(
        self,
        soup: BeautifulSoup,
        html_lower: str,
        content_analysis: Optional[Dict]
    ):
        """Check if this is a local business."""
        local_indicators = 0

        # Check for local business schema
        if "localbusiness" in html_lower:
            local_indicators += 2

        # Check for address
        if content_analysis and content_analysis.get("address"):
            local_indicators += 2

        # Check for local keywords
        local_keywords = [
            "serving", "local", "community", "neighborhood",
            "family owned", "since", "established"
        ]
        for keyword in local_keywords:
            if keyword in html_lower:
                local_indicators += 1

        # Check for single location indicators
        if "our location" in html_lower or "visit us" in html_lower:
            local_indicators += 1

        # Check for Google Maps embed
        if "maps.google" in html_lower or "google.com/maps" in html_lower:
            local_indicators += 1

        self.results["is_local_business"] = local_indicators >= 3

        if self.results["is_local_business"]:
            self.results["business_type"] = "local"
            self.results["business_indicators"].append("Local business indicators found")

    def _check_franchise(self, html_lower: str):
        """Check for franchise indicators."""
        franchise_indicators = [
            "franchise", "locations", "find a location",
            "store locator", "find us near", "branches"
        ]

        matches = sum(1 for ind in franchise_indicators if ind in html_lower)

        if matches >= 2:
            self.results["is_franchise"] = True
            self.results["has_multiple_locations"] = True
            self.results["business_type"] = "franchise"
            self.results["business_indicators"].append("Franchise/multi-location indicators")

    def _detect_target_market(self, html_lower: str):
        """Detect target market (B2B, B2C, or both)."""
        b2b_indicators = [
            "enterprise", "business", "companies", "organizations",
            "roi", "solutions", "integration", "api", "saas",
            "demo", "pricing plans", "schedule a call"
        ]

        b2c_indicators = [
            "shop", "buy now", "add to cart", "customers",
            "individuals", "personal", "family", "home"
        ]

        b2b_score = sum(1 for ind in b2b_indicators if ind in html_lower)
        b2c_score = sum(1 for ind in b2c_indicators if ind in html_lower)

        if b2b_score > b2c_score + 2:
            self.results["target_market"] = "b2b"
        elif b2c_score > b2b_score + 2:
            self.results["target_market"] = "b2c"
        elif b2b_score > 0 and b2c_score > 0:
            self.results["target_market"] = "both"
        else:
            self.results["target_market"] = "b2c"  # Default assumption

    def _detect_website_purpose(self, soup: BeautifulSoup, html_lower: str):
        """Determine the primary purpose of the website."""
        purposes = {
            "ecommerce": 0,
            "lead_generation": 0,
            "brochure": 0,
            "informational": 0,
            "portfolio": 0
        }

        # E-commerce indicators
        ecommerce_indicators = ["cart", "checkout", "add to cart", "shop", "buy now", "price"]
        purposes["ecommerce"] = sum(1 for ind in ecommerce_indicators if ind in html_lower)

        # Lead generation indicators
        lead_indicators = ["contact us", "get a quote", "free consultation", "request demo", "schedule"]
        purposes["lead_generation"] = sum(1 for ind in lead_indicators if ind in html_lower)

        # Portfolio indicators
        portfolio_indicators = ["portfolio", "our work", "projects", "case studies", "gallery"]
        purposes["portfolio"] = sum(1 for ind in portfolio_indicators if ind in html_lower)

        # Check for forms
        forms = soup.find_all("form")
        if forms:
            purposes["lead_generation"] += len(forms)

        # Determine primary purpose
        max_purpose = max(purposes.items(), key=lambda x: x[1])
        if max_purpose[1] >= 2:
            self.results["website_purpose"] = max_purpose[0]
        else:
            self.results["website_purpose"] = "brochure"

    def _calculate_professionalism(self, soup: BeautifulSoup, html: str):
        """Calculate a professionalism score based on website quality indicators."""
        score = 50  # Start neutral

        # Positive factors
        positive_factors = [
            (soup.find("meta", {"name": "description"}), 5, "Has meta description"),
            (soup.find("link", rel="icon"), 3, "Has favicon"),
            (soup.find("footer"), 5, "Has footer"),
            (soup.find("nav"), 5, "Has navigation"),
            (re.search(r"privacy|terms|policy", html.lower()), 5, "Has legal pages"),
            (soup.find("img", alt=True), 3, "Images have alt text"),
            (re.search(r"ssl|https", html.lower()), 3, "HTTPS indicators"),
            (soup.find(class_=re.compile(r"logo", re.I)), 3, "Has logo"),
            (re.search(r"@\w+\.\w+", html), 3, "Has email contact"),
            (re.search(r"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}", html), 3, "Has phone number"),
        ]

        for condition, points, reason in positive_factors:
            if condition:
                score += points
                self.results["business_indicators"].append(f"Professional: {reason}")

        # Negative factors
        negative_factors = [
            (soup.find("marquee"), -10, "Uses marquee"),
            (soup.find("blink"), -10, "Uses blink"),
            (soup.find("font"), -5, "Uses font tags"),
            (re.search(r"under construction", html.lower()), -15, "Under construction"),
            (re.search(r"lorem ipsum", html.lower()), -20, "Has placeholder text"),
            (not soup.find("title"), -10, "Missing title"),
        ]

        for condition, points, reason in negative_factors:
            if condition:
                score += points
                self.results["issues"].append(reason)

        self.results["professionalism_score"] = max(0, min(100, score))

    def _identify_opportunities(self):
        """Identify opportunity factors for web renovation services."""
        opportunities = []

        # Low professionalism score
        if self.results["professionalism_score"] < 60:
            opportunities.append("Low professionalism score - needs improvement")

        # Local business without modern features
        if self.results["is_local_business"]:
            opportunities.append("Local business - often needs web presence improvement")

        # Lead generation site with issues
        if self.results["website_purpose"] == "lead_generation":
            opportunities.append("Lead generation focus - conversion optimization potential")

        # Small business
        if self.results["estimated_size"] == "small":
            opportunities.append("Small business - likely budget-conscious but needs help")

        self.results["opportunity_factors"] = opportunities


def analyze_business(
    url: str,
    soup: BeautifulSoup,
    html: str,
    content_analysis: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Convenience function for business analysis.

    Args:
        url: Website URL
        soup: BeautifulSoup object
        html: Raw HTML content
        content_analysis: Results from content analyzer (optional)

    Returns:
        Business analysis results
    """
    analyzer = BusinessAnalyzer()
    return analyzer.analyze(url, soup, html, content_analysis)
