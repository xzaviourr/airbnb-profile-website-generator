from __future__ import annotations

import os
import re
from pathlib import Path

from flask import Flask, abort, jsonify, make_response, request, send_from_directory, url_for
from markupsafe import escape

SITE_ROOT = Path(os.environ.get("AIRBNB_SITES_ROOT", "/srv/airbnb-sites/sites")).resolve()
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$")

app = Flask(__name__)


def available_sites() -> list[str]:
    if not SITE_ROOT.is_dir():
        return []
    return sorted(
        path.name
        for path in SITE_ROOT.iterdir()
        if path.is_dir()
        and SLUG_PATTERN.fullmatch(path.name)
        and (path / "site-config.json").is_file()
        and (path / "website" / "index.html").is_file()
    )


def published_sites() -> list[str]:
    return [
        slug for slug in available_sites()
        if (SITE_ROOT / slug / ".production").is_file()
    ]


def site_directory(slug: str, *, production: bool = False) -> Path:
    if not SLUG_PATTERN.fullmatch(slug) or slug not in available_sites():
        abort(404)
    directory = SITE_ROOT / slug
    if production and not (directory / ".production").is_file():
        abort(404)
    return directory


def preview_directory(slug: str) -> Path:
    directory = site_directory(slug)
    if not (directory / ".preview").is_file():
        abort(404)
    return directory


def website_text(directory: Path, filename: str) -> str:
    return (directory / "website" / filename).read_text(encoding="utf-8").replace(
        "../images", "./images",
    )


def website_index(directory: Path, *, watermarked: bool):
    index = website_text(directory, "index.html")
    if not watermarked:
        return make_response(index)
    watermark = """
<style id="sales-preview-watermark">
  body::before {
    content: "UNLICENSED SALES PREVIEW";
    position: fixed;
    z-index: 2147483647;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%) rotate(-18deg);
    padding: .8rem 1.4rem;
    border: 2px solid rgba(255,255,255,.78);
    border-radius: .4rem;
    color: rgba(255,255,255,.9);
    background: rgba(15,35,31,.58);
    box-shadow: 0 0 0 999vmax rgba(15,35,31,.025);
    font: 700 clamp(.8rem, 2vw, 1.4rem)/1 system-ui, sans-serif;
    letter-spacing: .2em;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
"""
    index = index.replace("</head>", '<meta name="robots" content="noindex,nofollow,noarchive">\n'
                          + watermark + "</head>")
    return make_response(index)


def website_asset(directory: Path, filename: str):
    if filename.startswith("images/"):
        return send_from_directory(directory / "images", filename.removeprefix("images/"))
    if filename == "app.js":
        return website_text(directory, filename), 200, {"Content-Type": "text/javascript; charset=utf-8"}
    return send_from_directory(directory / "website", filename)


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    if request.path.startswith("/preview/"):
        response.headers["Cache-Control"] = "private, no-store, max-age=0"
        response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/healthz")
def health():
    sites = published_sites()
    return jsonify(
        status="ok",
        publishedSiteCount=len(sites),
        previewSiteCount=len(available_sites()) - len(sites),
        sites=sites,
    )


@app.get("/")
def index():
    links = "".join(
        f'<li><a href="{escape(url_for("site_home", slug=slug))}">{escape(slug)}</a></li>'
        for slug in published_sites()
    )
    empty = "<p>No websites have been approved and published yet.</p>" if not links else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hosted stays</title>
  <style>
    body {{ max-width: 52rem; margin: 4rem auto; padding: 0 1.25rem; font: 16px/1.6 system-ui, sans-serif; color: #18201d; }}
    h1 {{ font: 2.5rem/1.1 Georgia, serif; }}
    a {{ color: #143f38; }}
  </style>
</head>
<body><h1>Hosted stays</h1>{empty}<ul>{links}</ul></body>
</html>"""


@app.get("/sites/<slug>/")
def site_home(slug: str):
    return website_index(site_directory(slug, production=True), watermarked=False)


@app.get("/sites/<slug>/<path:filename>")
def site_asset(slug: str, filename: str):
    return website_asset(site_directory(slug, production=True), filename)


@app.get("/preview/<slug>/")
def preview_home(slug: str):
    return website_index(preview_directory(slug), watermarked=True)


@app.get("/preview/<slug>/<path:filename>")
def preview_asset(slug: str, filename: str):
    return website_asset(preview_directory(slug), filename)


@app.get("/robots.txt")
def robots():
    return "User-agent: *\nDisallow: /preview/\n", 200, {"Content-Type": "text/plain"}


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000)
