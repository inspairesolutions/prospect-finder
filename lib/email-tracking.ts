/**
 * Heuristics to reduce false positives on "human" open/click counts.
 * Gmail images load via googleimageproxy — that counts as a real open.
 */

const OPEN_SCANNER_USER_AGENT_PATTERNS = [
  /google-inspectiontool/i,
  /barracuda/i,
  /proofpoint/i,
  /mimecast/i,
  /symantec/i,
  /virus/i,
  /scanner/i,
]

const CLICK_EXTRA_SCANNER_PATTERNS = [
  /safelinks\.protection\.outlook\.com/i,
  /url\.protection\.outlook\.com/i,
]

export function isLikelyScannerEmailOpen(userAgent: string): boolean {
  return OPEN_SCANNER_USER_AGENT_PATTERNS.some((p) => p.test(userAgent))
}

/** Same as open scanners plus Outlook Safe Links prefetchers */
export function isLikelyScannerEmailClick(userAgent: string): boolean {
  if (isLikelyScannerEmailOpen(userAgent)) return true
  return CLICK_EXTRA_SCANNER_PATTERNS.some((p) => p.test(userAgent))
}
