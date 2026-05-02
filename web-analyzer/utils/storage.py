"""
DigitalOcean Spaces upload utilities for analysis screenshots.

Uses the same env vars as the Next.js app (lib/storage.ts):
    DO_ENDPOINT   — e.g. https://inspaire-solutions.lon1.digitaloceanspaces.com
    DO_ACCESS_KEY — Spaces access key
    DO_SECRET_KEY — Spaces secret key

DO_ENDPOINT contains the bucket name as a subdomain. We parse it the
same way the TypeScript client does:
    https://{bucket}.{region}.digitaloceanspaces.com
"""

import os
import re
import time
from typing import Dict, Optional


class SpacesUploader:
    """Uploads files to DigitalOcean Spaces (S3-compatible)."""

    def __init__(self):
        self._client = None
        self._bucket_name: Optional[str] = None
        self._region_endpoint: Optional[str] = None
        self._public_base: Optional[str] = None

    def _parse_endpoint(self):
        """Parse DO_ENDPOINT into bucket, region endpoint, and public base URL."""
        do_endpoint = os.environ['DO_ENDPOINT']
        m = re.match(r'^(https?)://(.+?)\.(.+\.digitaloceanspaces\.com)$', do_endpoint)
        if m:
            scheme, bucket, region_host = m.group(1), m.group(2), m.group(3)
            self._bucket_name = bucket
            self._region_endpoint = f"{scheme}://{region_host}"
            self._public_base = do_endpoint  # full URL is the public base
        else:
            # Fallback: treat the whole thing as endpoint, bucket from env or default
            self._bucket_name = os.environ.get('DO_SPACES_BUCKET', 'inspaire-solutions')
            self._region_endpoint = do_endpoint
            self._public_base = do_endpoint

    def _get_client(self):
        """Lazy-initialize boto3 S3 client from environment variables."""
        if self._client is not None:
            return self._client

        import boto3

        self._parse_endpoint()

        self._client = boto3.client(
            's3',
            endpoint_url=self._region_endpoint,
            aws_access_key_id=os.environ['DO_ACCESS_KEY'],
            aws_secret_access_key=os.environ['DO_SECRET_KEY'],
            region_name='lon1',
        )
        return self._client

    @property
    def _bucket(self) -> str:
        if self._bucket_name is None:
            self._parse_endpoint()
        return self._bucket_name  # type: ignore

    @property
    def _cdn_url(self) -> str:
        if self._public_base is None:
            self._parse_endpoint()
        return self._public_base  # type: ignore

    def upload_screenshots(self, job_id: str, local_paths: Dict[str, str]) -> Dict[str, str]:
        """
        Upload screenshot files to DO Spaces.

        Args:
            job_id: Analysis job ID (used in remote path)
            local_paths: dict mapping kind -> local file path
                e.g. {"desktop_full": "/tmp/analysis_xxx/desktop_full.png"}

        Returns:
            dict mapping kind -> public URL
                e.g. {"desktop_full": "https://inspaire-solutions.lon1.../analyses/job123/desktop_full.png"}
        """
        urls: Dict[str, str] = {}

        for kind, local_path in local_paths.items():
            if not local_path or not os.path.exists(local_path):
                continue

            remote_key = f"analyses/{job_id}/{kind}.png"
            url = self._upload_with_retry(local_path, remote_key)
            urls[kind] = url

            # Delete local file after successful upload
            try:
                os.remove(local_path)
            except OSError:
                pass

        return urls

    def _upload_with_retry(self, local_path: str, remote_key: str, max_attempts: int = 3) -> str:
        """Upload a single file with exponential backoff retry."""
        client = self._get_client()
        last_error = None

        for attempt in range(max_attempts):
            try:
                client.upload_file(
                    local_path,
                    self._bucket,
                    remote_key,
                    ExtraArgs={
                        'ACL': 'public-read',
                        'ContentType': 'image/png',
                        'CacheControl': 'public, max-age=31536000',
                    },
                )
                # Build public URL (same pattern as lib/storage.ts)
                base = self._cdn_url.rstrip('/')
                return f"{base}/{remote_key}"

            except Exception as e:
                last_error = e
                if attempt < max_attempts - 1:
                    backoff = 2 ** attempt  # 1s, 2s, 4s
                    time.sleep(backoff)

        raise RuntimeError(f"Upload failed after {max_attempts} attempts: {last_error}")
