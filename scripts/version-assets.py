"""Stamps every local CSS/JS reference of the site's pages with ?v=<content hash>.

GitHub Pages lets browsers cache these files for 10 minutes: without a new URL, an updated page
can run against an outdated stylesheet or script. Run after changing any of them:
    python scripts/version-assets.py
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REFERENCE = re.compile(r'(?P<attr>href|src)="(?P<path>[^"?#:]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"')


def content_hash(path: pathlib.Path) -> str:
    return hashlib.sha1(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:8]


def main() -> int:
    missing = []
    for page in sorted(ROOT.glob("*.html")):
        html = page.read_text(encoding="utf-8")

        def stamp(match: re.Match) -> str:
            asset = ROOT / match["path"]
            if not asset.is_file():
                missing.append(f"{page.name}: {match['path']}")
                return match[0]
            return f'{match["attr"]}="{match["path"]}?v={content_hash(asset)}"'

        updated = REFERENCE.sub(stamp, html)
        if updated != html:
            page.write_text(updated, encoding="utf-8", newline="")
            print(f"updated {page.name}")
    if missing:
        print("missing files:\n  " + "\n  ".join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
