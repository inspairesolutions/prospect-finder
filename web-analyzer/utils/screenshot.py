"""
Screenshot capture utilities for desktop and mobile views.
"""

import os
from typing import Optional, Dict, Any


def capture_screenshots(
    url: str,
    output_dir: str,
    filename_prefix: str = "screenshot"
) -> Dict[str, Any]:
    """
    Capture desktop and mobile screenshots of a URL.

    Args:
        url: URL to capture
        output_dir: Directory to save screenshots
        filename_prefix: Prefix for screenshot filenames

    Returns dict with:
        - desktop: path to desktop screenshot or None
        - mobile: path to mobile screenshot or None
        - error: error message if any
    """
    result = {
        "desktop": None,
        "mobile": None,
        "error": None
    }

    try:
        from playwright.sync_api import sync_playwright

        os.makedirs(output_dir, exist_ok=True)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # Desktop screenshot
            desktop_context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
            )
            desktop_page = desktop_context.new_page()

            try:
                desktop_page.goto(url, wait_until="networkidle", timeout=30000)
                desktop_path = os.path.join(output_dir, f"{filename_prefix}_desktop.png")
                desktop_page.screenshot(path=desktop_path, full_page=True)
                result["desktop"] = desktop_path
            except Exception as e:
                result["error"] = f"Desktop capture failed: {str(e)}"

            desktop_context.close()

            # Mobile screenshot
            mobile_context = browser.new_context(
                viewport={"width": 375, "height": 812},
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
                    "Mobile/15E148 Safari/604.1"
                ),
                is_mobile=True,
                has_touch=True
            )
            mobile_page = mobile_context.new_page()

            try:
                mobile_page.goto(url, wait_until="networkidle", timeout=30000)
                mobile_path = os.path.join(output_dir, f"{filename_prefix}_mobile.png")
                mobile_page.screenshot(path=mobile_path, full_page=True)
                result["mobile"] = mobile_path
            except Exception as e:
                if not result["error"]:
                    result["error"] = f"Mobile capture failed: {str(e)}"

            mobile_context.close()
            browser.close()

    except ImportError:
        result["error"] = "Playwright not installed. Run: playwright install chromium"
    except Exception as e:
        result["error"] = f"Screenshot error: {str(e)}"

    return result


def get_viewport_comparison(url: str) -> Dict[str, Any]:
    """
    Compare page appearance at different viewport sizes.

    Returns dict with:
        - viewports: list of viewport tests with results
        - is_responsive: boolean indicating if site adapts to viewports
        - error: error message if any
    """
    viewports = [
        {"name": "mobile", "width": 375, "height": 667},
        {"name": "tablet", "width": 768, "height": 1024},
        {"name": "desktop", "width": 1920, "height": 1080},
    ]

    result = {
        "viewports": [],
        "is_responsive": False,
        "error": None
    }

    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            layout_widths = []

            for vp in viewports:
                context = browser.new_context(
                    viewport={"width": vp["width"], "height": vp["height"]}
                )
                page = context.new_page()

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)

                    # Check content width
                    content_width = page.evaluate("""
                        () => {
                            const body = document.body;
                            const html = document.documentElement;
                            return Math.max(
                                body.scrollWidth,
                                body.offsetWidth,
                                html.clientWidth,
                                html.scrollWidth,
                                html.offsetWidth
                            );
                        }
                    """)

                    # Check for horizontal scroll
                    has_horizontal_scroll = content_width > vp["width"]

                    result["viewports"].append({
                        "name": vp["name"],
                        "viewport_width": vp["width"],
                        "content_width": content_width,
                        "has_horizontal_scroll": has_horizontal_scroll
                    })

                    layout_widths.append(content_width)

                except Exception as e:
                    result["viewports"].append({
                        "name": vp["name"],
                        "error": str(e)
                    })

                context.close()

            browser.close()

            # Determine if responsive - content should adapt to viewport
            if len(layout_widths) >= 2:
                # If mobile content width is significantly less than desktop,
                # it's likely responsive
                mobile_width = layout_widths[0] if layout_widths else 0
                desktop_width = layout_widths[-1] if layout_widths else 0
                result["is_responsive"] = mobile_width < desktop_width * 0.8

    except ImportError:
        result["error"] = "Playwright not installed"
    except Exception as e:
        result["error"] = str(e)

    return result
