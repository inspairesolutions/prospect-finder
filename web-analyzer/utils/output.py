"""
Output formatting utilities for JSON and terminal display.
"""

import json
from typing import Dict, Any, Optional
from datetime import datetime


class Colors:
    """ANSI color codes for terminal output."""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'


def format_json(data: Dict[str, Any], indent: int = 2) -> str:
    """Format data as JSON string."""
    return json.dumps(data, indent=indent, ensure_ascii=False, default=str)


def save_json(data: Dict[str, Any], filepath: str) -> bool:
    """Save data to JSON file."""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, indent=2, ensure_ascii=False, default=str, fp=f)
        return True
    except Exception:
        return False


def format_size(bytes_size: int) -> str:
    """Format bytes as human-readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.1f} TB"


def format_time(seconds: float) -> str:
    """Format seconds as human-readable time."""
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    return f"{seconds:.2f}s"


def print_header(title: str, width: int = 60):
    """Print a formatted header."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'=' * width}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title.center(width)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'=' * width}{Colors.END}\n")


def print_section(title: str):
    """Print a section header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}--- {title} ---{Colors.END}")


def print_item(label: str, value: Any, indent: int = 0):
    """Print a labeled item."""
    spaces = "  " * indent
    print(f"{spaces}{Colors.BOLD}{label}:{Colors.END} {value}")


def print_score(score: int, category: str):
    """Print the prospect score with color coding."""
    if score >= 70:
        color = Colors.GREEN
    elif score >= 40:
        color = Colors.YELLOW
    else:
        color = Colors.RED

    print(f"\n{Colors.BOLD}Prospect Score: {color}{score}/100{Colors.END}")
    print(f"{Colors.BOLD}Category: {color}{category}{Colors.END}")


def print_issues(issues: list, issue_type: str = "warning"):
    """Print a list of issues with appropriate coloring."""
    if not issues:
        return

    color = Colors.RED if issue_type == "error" else Colors.YELLOW
    icon = "X" if issue_type == "error" else "!"

    for issue in issues:
        print(f"  {color}[{icon}]{Colors.END} {issue}")


def print_positive(items: list):
    """Print positive findings."""
    for item in items:
        print(f"  {Colors.GREEN}[+]{Colors.END} {item}")


def format_terminal_report(analysis: Dict[str, Any]) -> str:
    """
    Format complete analysis as terminal output.

    Args:
        analysis: Complete analysis dictionary

    Returns:
        Formatted string for terminal display
    """
    lines = []
    url = analysis.get("url", "Unknown")
    timestamp = analysis.get("timestamp", datetime.now().isoformat())

    # Header
    lines.append(f"\n{'=' * 60}")
    lines.append(f"{'WEB ANALYZER REPORT'.center(60)}")
    lines.append(f"{'=' * 60}")
    lines.append(f"\nURL: {url}")
    lines.append(f"Analyzed: {timestamp}")

    # Score Summary
    scoring = analysis.get("scoring", {})
    score = scoring.get("total_score", 0)
    category = scoring.get("category", "UNKNOWN")
    lines.append(f"\n{'PROSPECT SCORE'.center(60, '-')}")
    lines.append(f"Score: {score}/100")
    lines.append(f"Category: {category}")

    if scoring.get("recommendation"):
        lines.append(f"Recommendation: {scoring['recommendation']}")

    # Technology
    tech = analysis.get("technology", {})
    if tech:
        lines.append(f"\n{'TECHNOLOGY'.center(60, '-')}")
        if tech.get("cms"):
            lines.append(f"CMS: {tech['cms']}")
        if tech.get("frameworks"):
            lines.append(f"Frameworks: {', '.join(tech['frameworks'])}")
        if tech.get("page_builder"):
            lines.append(f"Page Builder: {tech['page_builder']}")

    # Performance
    perf = analysis.get("performance", {})
    if perf:
        lines.append(f"\n{'PERFORMANCE'.center(60, '-')}")
        if perf.get("load_time"):
            lines.append(f"Load Time: {format_time(perf['load_time'])}")
        if perf.get("page_size"):
            lines.append(f"Page Size: {format_size(perf['page_size'])}")
        if perf.get("total_requests"):
            lines.append(f"HTTP Requests: {perf['total_requests']}")

    # SEO
    seo = analysis.get("seo", {})
    if seo:
        lines.append(f"\n{'SEO'.center(60, '-')}")
        lines.append(f"Has Title: {'Yes' if seo.get('has_title') else 'No'}")
        lines.append(f"Has Meta Description: {'Yes' if seo.get('has_meta_description') else 'No'}")
        lines.append(f"HTTPS: {'Yes' if seo.get('uses_https') else 'No'}")
        if seo.get("issues"):
            lines.append("Issues:")
            for issue in seo["issues"]:
                lines.append(f"  - {issue}")

    # Responsive
    responsive = analysis.get("responsive", {})
    if responsive:
        lines.append(f"\n{'RESPONSIVE DESIGN'.center(60, '-')}")
        lines.append(f"Mobile Friendly: {'Yes' if responsive.get('is_mobile_friendly') else 'No'}")
        lines.append(f"Has Viewport Meta: {'Yes' if responsive.get('has_viewport_meta') else 'No'}")

    # Design Age
    design = analysis.get("design", {})
    if design:
        lines.append(f"\n{'DESIGN ANALYSIS'.center(60, '-')}")
        if design.get("estimated_age"):
            lines.append(f"Estimated Age: {design['estimated_age']}")
        if design.get("copyright_year"):
            lines.append(f"Copyright Year: {design['copyright_year']}")
        if design.get("design_indicators"):
            lines.append("Design Indicators:")
            for indicator in design["design_indicators"]:
                lines.append(f"  - {indicator}")

    # Contact Info
    content = analysis.get("content", {})
    if content:
        lines.append(f"\n{'CONTACT INFO'.center(60, '-')}")
        if content.get("emails"):
            lines.append(f"Emails: {', '.join(content['emails'])}")
        if content.get("phones"):
            lines.append(f"Phones: {', '.join(content['phones'])}")
        if content.get("address"):
            lines.append(f"Address: {content['address']}")

    # Technical Issues
    technical = analysis.get("technical", {})
    if technical and technical.get("issues"):
        lines.append(f"\n{'TECHNICAL ISSUES'.center(60, '-')}")
        for issue in technical["issues"]:
            lines.append(f"  - {issue}")

    # Score Breakdown
    if scoring.get("breakdown"):
        lines.append(f"\n{'SCORE BREAKDOWN'.center(60, '-')}")
        breakdown = scoring["breakdown"]
        for category_name, details in breakdown.items():
            if isinstance(details, dict):
                points = details.get("points", 0)
                sign = "+" if points > 0 else ""
                lines.append(f"  {category_name}: {sign}{points}")
                for reason in details.get("reasons", []):
                    lines.append(f"    - {reason}")

    lines.append(f"\n{'=' * 60}\n")

    return "\n".join(lines)


def print_analysis(analysis: Dict[str, Any]):
    """Print formatted analysis to terminal."""
    print(format_terminal_report(analysis))


def format_batch_summary(results: list) -> str:
    """
    Format summary of batch analysis results.

    Args:
        results: List of analysis dictionaries

    Returns:
        Formatted summary string
    """
    lines = []
    lines.append(f"\n{'=' * 70}")
    lines.append(f"{'BATCH ANALYSIS SUMMARY'.center(70)}")
    lines.append(f"{'=' * 70}")
    lines.append(f"\nTotal URLs analyzed: {len(results)}")

    # Categorize results
    categories = {
        "PRIORIDAD_MAXIMA": [],
        "CONTACTAR": [],
        "EVALUAR": [],
        "RECHAZAR": [],
        "ERROR": []
    }

    for result in results:
        url = result.get("url", "Unknown")
        if result.get("error"):
            categories["ERROR"].append((url, result.get("error")))
        else:
            scoring = result.get("scoring", {})
            category = scoring.get("category", "EVALUAR")
            score = scoring.get("total_score", 0)
            categories.get(category, categories["EVALUAR"]).append((url, score))

    # Print by category
    for cat_name, items in categories.items():
        if items:
            lines.append(f"\n{cat_name} ({len(items)}):")
            for url, info in sorted(items, key=lambda x: x[1] if isinstance(x[1], int) else 0, reverse=True):
                if cat_name == "ERROR":
                    lines.append(f"  - {url}: {info}")
                else:
                    lines.append(f"  - {url}: {info}/100")

    lines.append(f"\n{'=' * 70}\n")

    return "\n".join(lines)
