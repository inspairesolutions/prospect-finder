#!/usr/bin/env python3
"""
Web Analyzer CLI - Analyze websites to identify prospects for web renovation services.

Usage:
    python web_analyzer.py <url>                    # Basic analysis
    python web_analyzer.py <url> --json             # JSON output
    python web_analyzer.py <url> --output file.json # Save to file
    python web_analyzer.py --batch urls.txt         # Batch mode
    python web_analyzer.py <url> --score-only       # Only show score
    python web_analyzer.py <url> --deep             # Deep analysis with Playwright
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

from utils.scraper import WebScraper
from utils.output import (
    format_json, save_json, print_analysis,
    format_terminal_report, format_batch_summary
)

from analyzer.technology import analyze_technology
from analyzer.design import analyze_design
from analyzer.performance import analyze_performance
from analyzer.responsive import analyze_responsive
from analyzer.seo import analyze_seo
from analyzer.content import analyze_content
from analyzer.technical import analyze_technical
from analyzer.business import analyze_business
from analyzer.scoring import calculate_prospect_score


class WebAnalyzer:
    """Main web analyzer orchestrator."""

    def __init__(
        self,
        timeout: int = 30,
        deep_mode: bool = False,
        check_links: bool = True,
        respect_robots: bool = True,
        verbose: bool = True
    ):
        self.timeout = timeout
        self.deep_mode = deep_mode
        self.check_links = check_links
        self.verbose = verbose
        self.scraper = WebScraper(
            timeout=timeout,
            respect_robots=respect_robots
        )

    def _log(self, message: str):
        """Write progress logs to stderr when verbose mode is enabled."""
        if self.verbose:
            print(message, file=sys.stderr)

    def analyze(self, url: str) -> Dict[str, Any]:
        """
        Perform complete analysis of a URL.

        Args:
            url: URL to analyze

        Returns:
            Complete analysis results
        """
        # Normalize URL
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"

        results = {
            "url": url,
            "timestamp": datetime.now().isoformat(),
            "status": "success",
            "error": None,
            "technology": {},
            "design": {},
            "performance": {},
            "responsive": {},
            "seo": {},
            "content": {},
            "technical": {},
            "business": {},
            "scoring": {}
        }

        # Fetch page content
        self._log(f"Fetching {url}...")

        if self.deep_mode:
            fetch_result = self.scraper.fetch_dynamic(url)
        else:
            fetch_result = self.scraper.fetch_html(url)

        if fetch_result.get("error"):
            results["status"] = "error"
            results["error"] = fetch_result["error"]
            return results

        soup = fetch_result.get("soup")
        html = fetch_result.get("html", "")
        load_time = fetch_result.get("load_time", 0)
        headers = fetch_result.get("headers", {})
        final_url = fetch_result.get("final_url", url)
        js_errors = fetch_result.get("js_errors", [])

        if not soup or not html:
            results["status"] = "error"
            results["error"] = "Failed to parse page content"
            return results

        # Get resources
        resources = self.scraper.get_resources(soup, final_url)

        # Run all analyzers
        self._log("Analyzing technology...")
        results["technology"] = self._safe_analyze(
            analyze_technology, soup, html, resources
        )

        self._log("Analyzing design...")
        results["design"] = self._safe_analyze(
            analyze_design, soup, html
        )

        self._log("Analyzing performance...")
        results["performance"] = self._safe_analyze(
            analyze_performance, final_url, soup, html, resources, load_time
        )

        self._log("Analyzing responsive design...")
        results["responsive"] = self._safe_analyze(
            analyze_responsive, soup, html
        )

        self._log("Analyzing SEO...")
        results["seo"] = self._safe_analyze(
            analyze_seo, final_url, soup, html, headers
        )

        self._log("Analyzing content...")
        results["content"] = self._safe_analyze(
            analyze_content, final_url, soup, html
        )

        self._log("Analyzing technical aspects...")
        results["technical"] = self._safe_analyze(
            analyze_technical, final_url, soup, html, js_errors, self.check_links
        )

        self._log("Analyzing business characteristics...")
        results["business"] = self._safe_analyze(
            analyze_business, final_url, soup, html, results["content"]
        )

        # Calculate prospect score
        self._log("Calculating prospect score...")
        results["scoring"] = self._safe_analyze(
            calculate_prospect_score,
            results["technology"],
            results["design"],
            results["performance"],
            results["responsive"],
            results["seo"],
            results["content"],
            results["technical"],
            results["business"]
        )

        return results

    def _safe_analyze(self, analyzer_func, *args, **kwargs) -> Dict[str, Any]:
        """Run an analyzer function with error handling."""
        try:
            return analyzer_func(*args, **kwargs)
        except Exception as e:
            return {"error": str(e)}

    def analyze_batch(self, urls: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze multiple URLs.

        Args:
            urls: List of URLs to analyze

        Returns:
            List of analysis results
        """
        results = []
        total = len(urls)

        for i, url in enumerate(urls, 1):
            self._log(f"\n[{i}/{total}] Analyzing: {url}")
            try:
                result = self.analyze(url)
                results.append(result)
            except Exception as e:
                results.append({
                    "url": url,
                    "status": "error",
                    "error": str(e)
                })

        return results

    def close(self):
        """Clean up resources."""
        self.scraper.close()


def format_score_only(results: Dict[str, Any]) -> str:
    """Format just the score summary."""
    scoring = results.get("scoring", {})
    url = results.get("url", "Unknown")
    score = scoring.get("total_score", 0)
    category = scoring.get("category", "UNKNOWN")
    recommendation = scoring.get("recommendation", "")

    lines = [
        f"\nURL: {url}",
        f"Score: {score}/100",
        f"Category: {category}",
        f"\nRecommendation: {recommendation}"
    ]

    if scoring.get("priority_reasons"):
        lines.append("\nPriority Factors:")
        for reason in scoring["priority_reasons"]:
            lines.append(f"  + {reason}")

    return "\n".join(lines)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Web Analyzer - Identify prospects for web renovation services",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s https://example.com              Basic analysis
  %(prog)s example.com --json               JSON output
  %(prog)s example.com -o report.json       Save to file
  %(prog)s --batch urls.txt                 Analyze multiple URLs
  %(prog)s example.com --score-only         Show only the score
  %(prog)s example.com --deep               Deep analysis with JavaScript rendering
        """
    )

    parser.add_argument(
        "url",
        nargs="?",
        help="URL to analyze"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )

    parser.add_argument(
        "-o", "--output",
        help="Save results to file (JSON format)"
    )

    parser.add_argument(
        "--batch",
        metavar="FILE",
        help="Analyze multiple URLs from a file (one URL per line)"
    )

    parser.add_argument(
        "--score-only",
        action="store_true",
        help="Only show the prospect score"
    )

    parser.add_argument(
        "--deep",
        action="store_true",
        help="Use Playwright for JavaScript-rendered content"
    )

    parser.add_argument(
        "--no-link-check",
        action="store_true",
        help="Skip broken link checking"
    )

    parser.add_argument(
        "--ignore-robots",
        action="store_true",
        help="Ignore robots.txt restrictions"
    )

    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Request timeout in seconds (default: 30)"
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.url and not args.batch:
        parser.error("Either a URL or --batch file is required")

    # Initialize analyzer
    analyzer = WebAnalyzer(
        timeout=args.timeout,
        deep_mode=args.deep,
        check_links=not args.no_link_check,
        respect_robots=not args.ignore_robots,
        verbose=not args.json
    )

    try:
        if args.batch:
            # Batch mode
            try:
                with open(args.batch, 'r') as f:
                    urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]
            except FileNotFoundError:
                print(f"Error: File not found: {args.batch}", file=sys.stderr)
                sys.exit(1)

            if not urls:
                print("Error: No URLs found in batch file", file=sys.stderr)
                sys.exit(1)

            results = analyzer.analyze_batch(urls)

            if args.output:
                save_json({"results": results}, args.output)
                print(f"\nResults saved to: {args.output}")

            if args.json:
                print(format_json({"results": results}))
            else:
                print(format_batch_summary(results))

        else:
            # Single URL mode
            results = analyzer.analyze(args.url)

            if results.get("status") == "error":
                print(
                    f"\nError analyzing {args.url}: {results.get('error')}",
                    file=sys.stderr
                )
                sys.exit(1)

            if args.output:
                save_json(results, args.output)
                print(f"\nResults saved to: {args.output}")

            if args.json:
                print(format_json(results))
            elif args.score_only:
                print(format_score_only(results))
            else:
                print_analysis(results)

    except KeyboardInterrupt:
        print("\n\nAnalysis interrupted by user", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\nError: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        analyzer.close()


if __name__ == "__main__":
    main()
