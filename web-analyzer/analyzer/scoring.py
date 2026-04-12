"""
Scoring module - calculates prospect score with detailed breakdown.
"""

from typing import Dict, Any, List, Optional


class ProspectScorer:
    """Calculate prospect score for web renovation services."""

    # Score categories
    CATEGORIES = {
        "PRIORIDAD_MAXIMA": {"min": 70, "max": 100},
        "CONTACTAR": {"min": 50, "max": 69},
        "EVALUAR": {"min": 30, "max": 49},
        "RECHAZAR": {"min": 0, "max": 29}
    }

    # Scoring rules
    # Page builders that enable client DIY (negative for us)
    DIY_PAGE_BUILDERS = [
        "elementor", "divi", "wpbakery", "beaver_builder",
        "oxygen", "avada", "thrive"
    ]

    # Gutenberg is WordPress native editor, not a DIY builder
    NATIVE_EDITORS = ["gutenberg"]

    POSITIVE_FACTORS = {
        "wordpress_no_builder": {
            "points": 15,
            "description": "WordPress sin page builder - facil de renovar"
        },
        "wordpress_gutenberg": {
            "points": 12,
            "description": "WordPress con Gutenberg - facil de modernizar"
        },
        "outdated_design": {
            "points": 12,
            "description": "Diseno visualmente anticuado"
        },
        "old_copyright": {
            "points": 8,
            "description": "Copyright desactualizado (2+ anos)"
        },
        "slow_load_time": {
            "points": 10,
            "description": "Tiempo de carga lento (>3s)"
        },
        "not_mobile_friendly": {
            "points": 12,
            "description": "No es mobile-friendly"
        },
        "poor_seo": {
            "points": 8,
            "description": "SEO deficiente"
        },
        "no_https": {
            "points": 6,
            "description": "Sin HTTPS"
        },
        "broken_links": {
            "points": 5,
            "description": "Enlaces rotos detectados"
        },
        "deprecated_tech": {
            "points": 10,
            "description": "Tecnologia obsoleta (Flash, tablas, etc.)"
        },
        "local_business": {
            "points": 8,
            "description": "Negocio local - buen prospecto"
        },
        "contact_available": {
            "points": 5,
            "description": "Informacion de contacto disponible"
        },
        "small_site": {
            "points": 5,
            "description": "Sitio pequeno - renovacion manejable"
        },
        "high_opportunity_industry": {
            "points": 6,
            "description": "Industria con alta necesidad de web"
        },
        "old_jquery": {
            "points": 4,
            "description": "jQuery/librerias desactualizadas"
        },
        "performance_issues": {
            "points": 6,
            "description": "Problemas de rendimiento"
        }
    }

    NEGATIVE_FACTORS = {
        "page_builder": {
            "points": -15,
            "description": "Usa page builder - cliente puede DIY"
        },
        "modern_design": {
            "points": -15,
            "description": "Diseno moderno - no necesita renovacion"
        },
        "wix_squarespace": {
            "points": -20,
            "description": "Wix/Squarespace - dificil migrar"
        },
        "large_site": {
            "points": -12,
            "description": "Sitio grande - proyecto complejo"
        },
        "enterprise_company": {
            "points": -15,
            "description": "Empresa grande - proceso largo"
        },
        "recent_update": {
            "points": -10,
            "description": "Sitio actualizado recientemente"
        },
        "no_contact_info": {
            "points": -8,
            "description": "Sin informacion de contacto"
        },
        "franchise": {
            "points": -10,
            "description": "Franquicia - decisiones corporativas"
        },
        "tech_company": {
            "points": -8,
            "description": "Empresa tech - probablemente DIY"
        },
        "good_performance": {
            "points": -5,
            "description": "Buen rendimiento - menos urgencia"
        },
        "modern_tech_stack": {
            "points": -8,
            "description": "Stack tecnologico moderno"
        }
    }

    def __init__(self):
        self.results = {}

    def calculate_score(
        self,
        technology: Dict[str, Any],
        design: Dict[str, Any],
        performance: Dict[str, Any],
        responsive: Dict[str, Any],
        seo: Dict[str, Any],
        content: Dict[str, Any],
        technical: Dict[str, Any],
        business: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate prospect score based on all analysis results.

        Args:
            technology: Technology analysis results
            design: Design analysis results
            performance: Performance analysis results
            responsive: Responsive analysis results
            seo: SEO analysis results
            content: Content analysis results
            technical: Technical analysis results
            business: Business analysis results

        Returns:
            Scoring results with breakdown
        """
        self.results = {
            "total_score": 50,  # Start at neutral
            "category": "EVALUAR",
            "recommendation": "",
            "breakdown": {
                "technology": {"points": 0, "reasons": []},
                "design": {"points": 0, "reasons": []},
                "performance": {"points": 0, "reasons": []},
                "mobile": {"points": 0, "reasons": []},
                "seo": {"points": 0, "reasons": []},
                "business": {"points": 0, "reasons": []},
                "contact": {"points": 0, "reasons": []}
            },
            "positive_factors": [],
            "negative_factors": [],
            "priority_reasons": []
        }

        # Analyze each category
        self._score_technology(technology)
        self._score_design(design)
        self._score_performance(performance)
        self._score_mobile(responsive)
        self._score_seo(seo)
        self._score_business(business, content)
        self._score_contact(content)

        # Calculate total score
        total = 50  # Base score
        for category, data in self.results["breakdown"].items():
            total += data["points"]

        # Clamp score to 0-100
        self.results["total_score"] = max(0, min(100, total))

        # Determine category
        self._determine_category()

        # Generate recommendation
        self._generate_recommendation()

        return self.results

    def _add_factor(
        self,
        category: str,
        factor_key: str,
        is_positive: bool
    ):
        """Add a scoring factor."""
        factors = self.POSITIVE_FACTORS if is_positive else self.NEGATIVE_FACTORS
        factor = factors.get(factor_key)

        if factor:
            self.results["breakdown"][category]["points"] += factor["points"]
            self.results["breakdown"][category]["reasons"].append(factor["description"])

            if is_positive:
                self.results["positive_factors"].append(factor["description"])
                if factor["points"] >= 10:
                    self.results["priority_reasons"].append(factor["description"])
            else:
                self.results["negative_factors"].append(factor["description"])

    def _score_technology(self, tech: Dict[str, Any]):
        """Score technology factors."""
        cms = tech.get("cms")
        page_builder = tech.get("page_builder")
        frameworks = tech.get("frameworks", [])
        libraries = tech.get("libraries", [])

        # WordPress scoring
        if cms == "wordpress":
            if not page_builder:
                # WordPress without any builder - ideal
                self._add_factor("technology", "wordpress_no_builder", True)
            elif page_builder in self.NATIVE_EDITORS:
                # WordPress with Gutenberg - still easy to modernize
                self._add_factor("technology", "wordpress_gutenberg", True)
            elif page_builder in self.DIY_PAGE_BUILDERS:
                # WordPress with DIY page builder - client can do it themselves
                self._add_factor("technology", "page_builder", False)

        # Wix/Squarespace - harder to migrate
        if cms in ["wix", "squarespace", "weebly"]:
            self._add_factor("technology", "wix_squarespace", False)

        # Modern frameworks suggest tech-savvy client
        if any(f in frameworks for f in ["react", "vue", "angular", "next.js"]):
            self._add_factor("technology", "modern_tech_stack", False)

        # Old jQuery indicates older site
        if "jquery" in libraries and not any(f in frameworks for f in ["react", "vue", "angular"]):
            self._add_factor("technology", "old_jquery", True)

    def _score_design(self, design: Dict[str, Any]):
        """Score design factors."""
        age_score = design.get("age_score", 50)
        is_outdated = design.get("is_outdated", False)
        copyright_year = design.get("copyright_year")
        estimated_year = design.get("estimated_year")

        # Outdated design is opportunity
        if is_outdated or age_score >= 60:
            self._add_factor("design", "outdated_design", True)

        # Old copyright year
        from datetime import datetime
        current_year = datetime.now().year
        if copyright_year and current_year - copyright_year >= 2:
            self._add_factor("design", "old_copyright", True)
        elif copyright_year and current_year - copyright_year <= 1:
            self._add_factor("design", "recent_update", False)

        # Modern design reduces opportunity
        if age_score <= 20:
            self._add_factor("design", "modern_design", False)

        # Deprecated technology
        if design.get("outdated_patterns"):
            deprecated_types = [p["type"] for p in design["outdated_patterns"]]
            if any(t in deprecated_types for t in ["flash", "tables_layout", "font_tags", "marquee"]):
                self._add_factor("design", "deprecated_tech", True)

    def _score_performance(self, performance: Dict[str, Any]):
        """Score performance factors."""
        load_time = performance.get("load_time", 0)
        load_rating = performance.get("load_time_rating", "unknown")
        page_size_rating = performance.get("page_size_rating", "unknown")
        issues = performance.get("issues", [])

        # Slow load time is opportunity
        if load_time > 3 or load_rating in ["poor", "critical"]:
            self._add_factor("performance", "slow_load_time", True)

        # Performance issues
        if len(issues) >= 3:
            self._add_factor("performance", "performance_issues", True)

        # Good performance reduces urgency
        if load_time < 2 and load_rating == "good" and page_size_rating == "good":
            self._add_factor("performance", "good_performance", False)

    def _score_mobile(self, responsive: Dict[str, Any]):
        """Score mobile/responsive factors."""
        is_mobile_friendly = responsive.get("is_mobile_friendly", False)
        has_viewport = responsive.get("has_viewport_meta", False)
        score = responsive.get("score", 0)

        # Not mobile-friendly is opportunity
        if not is_mobile_friendly or score < 50:
            self._add_factor("mobile", "not_mobile_friendly", True)
        elif not has_viewport:
            self._add_factor("mobile", "not_mobile_friendly", True)

    def _score_seo(self, seo: Dict[str, Any]):
        """Score SEO factors."""
        seo_score = seo.get("score", 0)
        uses_https = seo.get("uses_https", False)
        issues = seo.get("issues", [])

        # Poor SEO is opportunity
        if seo_score < 50 or len(issues) >= 4:
            self._add_factor("seo", "poor_seo", True)

        # No HTTPS
        if not uses_https:
            self._add_factor("seo", "no_https", True)

    def _score_business(self, business: Dict[str, Any], content: Dict[str, Any]):
        """Score business factors."""
        is_local = business.get("is_local_business", False)
        is_franchise = business.get("is_franchise", False)
        estimated_size = business.get("estimated_size", "unknown")
        industry = business.get("industry")
        estimated_pages = content.get("estimated_pages", 0)

        # Local business is good prospect
        if is_local:
            self._add_factor("business", "local_business", True)

        # Franchise - harder to work with
        if is_franchise:
            self._add_factor("business", "franchise", False)

        # Small site is manageable
        if estimated_pages > 0 and estimated_pages <= 15:
            self._add_factor("business", "small_site", True)
        elif estimated_pages > 50:
            self._add_factor("business", "large_site", False)

        # Enterprise company
        if estimated_size == "enterprise":
            self._add_factor("business", "enterprise_company", False)

        # High opportunity industries
        high_opp_industries = [
            "restaurant", "construction", "automotive", "beauty",
            "healthcare", "legal", "real_estate", "fitness"
        ]
        if industry in high_opp_industries:
            self._add_factor("business", "high_opportunity_industry", True)

        # Tech company
        if industry == "technology":
            self._add_factor("business", "tech_company", False)

    def _score_contact(self, content: Dict[str, Any]):
        """Score contact availability."""
        emails = content.get("emails", [])
        phones = content.get("phones", [])
        has_form = content.get("has_contact_form", False)

        # Contact info available
        if emails or phones or has_form:
            self._add_factor("contact", "contact_available", True)
        else:
            self._add_factor("contact", "no_contact_info", False)

    def _determine_category(self):
        """Determine prospect category based on score."""
        score = self.results["total_score"]

        for category, bounds in self.CATEGORIES.items():
            if bounds["min"] <= score <= bounds["max"]:
                self.results["category"] = category
                break

    def _generate_recommendation(self):
        """Generate recommendation based on score and factors."""
        category = self.results["category"]
        positive = self.results["positive_factors"]
        negative = self.results["negative_factors"]

        if category == "PRIORIDAD_MAXIMA":
            self.results["recommendation"] = (
                "Excelente prospecto para servicios de renovacion web. "
                f"Factores clave: {', '.join(positive[:3])}. "
                "Contactar inmediatamente."
            )
        elif category == "CONTACTAR":
            self.results["recommendation"] = (
                "Buen prospecto con oportunidades claras de mejora. "
                f"Puntos a destacar: {', '.join(positive[:2])}. "
                "Programar contacto."
            )
        elif category == "EVALUAR":
            self.results["recommendation"] = (
                "Prospecto con potencial mixto. "
                f"Positivo: {', '.join(positive[:1]) if positive else 'Ninguno'}. "
                f"Considerar: {', '.join(negative[:1]) if negative else 'Ninguno'}. "
                "Evaluar caso por caso."
            )
        else:
            self.results["recommendation"] = (
                "Baja prioridad para servicios de renovacion. "
                f"Limitaciones: {', '.join(negative[:2]) if negative else 'Varios factores'}. "
                "Enfocar esfuerzos en otros prospectos."
            )


def calculate_prospect_score(
    technology: Dict[str, Any],
    design: Dict[str, Any],
    performance: Dict[str, Any],
    responsive: Dict[str, Any],
    seo: Dict[str, Any],
    content: Dict[str, Any],
    technical: Dict[str, Any],
    business: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Convenience function for prospect scoring.

    Args:
        technology: Technology analysis results
        design: Design analysis results
        performance: Performance analysis results
        responsive: Responsive analysis results
        seo: SEO analysis results
        content: Content analysis results
        technical: Technical analysis results
        business: Business analysis results

    Returns:
        Scoring results with breakdown
    """
    scorer = ProspectScorer()
    return scorer.calculate_score(
        technology, design, performance, responsive,
        seo, content, technical, business
    )
