"""
CardioVision AI - Cleveland Dataset Downloader & Initializer
Safely downloads and validates the UCI Heart Disease (Cleveland) dataset.
"""

import os
import urllib.request
import urllib.error
from typing import Optional

UCI_CLEVELAND_URL = (
    "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
)
UCI_ZIP_URL = (
    "https://archive.ics.uci.edu/static/public/45/heart+disease.zip"
)
BACKUP_UCI_URL = (
    "http://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
)

DEFAULT_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DEFAULT_DATA_PATH = os.path.join(DEFAULT_DATA_DIR, "processed.cleveland.data")


def validate_cleveland_content(content: bytes) -> bool:
    """Validate that the downloaded content conforms to UCI Cleveland 303 rows x 14 cols."""
    try:
        text = content.decode("utf-8-sig")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if len(lines) != 303:
            return False
        # Verify every row contains exactly 14 comma-separated fields
        for line in lines:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) != 14:
                return False
        return True
    except Exception:
        return False


def download_cleveland_dataset(target_path: Optional[str] = None) -> str:
    """
    Downloads and validates the Cleveland dataset to target_path (or default data dir).
    Returns the resolved absolute path to the valid dataset.
    Raises RuntimeError if download or validation fails.
    """
    if target_path is None:
        target_path = DEFAULT_DATA_PATH

    target_path = os.path.abspath(target_path)
    target_dir = os.path.dirname(target_path)
    os.makedirs(target_dir, exist_ok=True)

    # Check if already present and valid
    if os.path.exists(target_path):
        try:
            with open(target_path, "rb") as f:
                existing_bytes = f.read()
            if validate_cleveland_content(existing_bytes):
                return target_path
        except Exception:
            pass

    # Attempt download from primary and backup URLs
    urls = [UCI_CLEVELAND_URL, UCI_ZIP_URL, BACKUP_UCI_URL]
    errors = []

    for url in urls:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CardioVision-Dataset-Init/1.0 (Mozilla/5.0)"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    errors.append(f"{url} returned HTTP {resp.status}")
                    continue
                content = resp.read()

            # Handle zip archive if downloaded from modern UCI distribution
            if url.endswith(".zip") or content.startswith(b"PK\x03\x04"):
                import zipfile
                import io
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    if "processed.cleveland.data" in zf.namelist():
                        content = zf.read("processed.cleveland.data")
                    else:
                        errors.append(f"{url} archive did not contain 'processed.cleveland.data'")
                        continue

            if not validate_cleveland_content(content):
                errors.append(f"{url} did not return a valid 303-row Cleveland dataset format")
                continue

            # Atomic write safe on Windows
            tmp_path = f"{target_path}.tmp"
            with open(tmp_path, "wb") as f:
                f.write(content)
            os.replace(tmp_path, target_path)

            print(f"[Dataset] Successfully downloaded and validated Cleveland cohort at: {target_path}")
            return target_path

        except Exception as e:
            errors.append(f"{url}: {str(e)}")

    error_msg = (
        f"Failed to initialize UCI Cleveland dataset at '{target_path}'.\n"
        f"Attempts encountered the following errors:\n  " + "\n  ".join(errors) + "\n"
        "Please ensure internet connectivity or place 'processed.cleveland.data' into backend/data/ manually."
    )
    raise RuntimeError(error_msg)


if __name__ == "__main__":
    try:
        path = download_cleveland_dataset()
        print(f"Dataset verified at: {path}")
    except Exception as exc:
        print(f"Error: {exc}")
        exit(1)
