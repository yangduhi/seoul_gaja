from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:
    raise SystemExit("PyYAML is required: python -m pip install -r scripts/requirements.txt") from exc

try:
    from PIL import Image, ImageStat
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install -r scripts/requirements.txt") from exc


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    manifest = root / "MANIFEST.sha256"
    integrity = root / "PACKET-INTEGRITY.json"
    if not manifest.is_file() or not integrity.is_file():
        fail("manifest or integrity file missing")

    expected: dict[str, str] = {}
    for line in manifest.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        digest, rel = line.split("  ", 1)
        expected[rel] = digest

    actual_files = sorted(
        p for p in root.rglob("*")
        if p.is_file() and p.name != "MANIFEST.sha256"
    )
    actual_rel = {p.relative_to(root).as_posix() for p in actual_files}
    if actual_rel != set(expected):
        missing = sorted(set(expected) - actual_rel)
        extra = sorted(actual_rel - set(expected))
        fail(f"manifest membership mismatch missing={missing} extra={extra}")

    for rel, digest in expected.items():
        got = sha256(root / rel)
        if got != digest:
            fail(f"hash mismatch: {rel}")

    meta = json.loads(integrity.read_text(encoding="utf-8"))
    if meta.get("version") != "4.0.0-sites-only":
        fail("unexpected packet version")
    if meta.get("manifest_file_count") != len(expected):
        fail("file count mismatch")
    content_entries = {k: v for k, v in expected.items() if k != "PACKET-INTEGRITY.json"}
    if meta.get("content_file_count") != len(content_entries):
        fail("content file count mismatch")
    root_material = "".join(f"{content_entries[rel]}  {rel}\n" for rel in sorted(content_entries))
    content_root = hashlib.sha256(root_material.encode("utf-8")).hexdigest()
    if meta.get("content_root_sha256") != content_root:
        fail("content root mismatch")


    # Platform-boundary invariants.
    boundary = yaml.safe_load((root / "contracts" / "platform-boundary.yaml").read_text(encoding="utf-8"))
    if boundary["hosting"]["only_allowed_application_host"] != "chatgpt_sites":
        fail("ChatGPT Sites is not the sole application host")
    if boundary["storage"]["structured_data"]["provider"] != "chatgpt_sites_d1":
        fail("ChatGPT Sites D1 is not the structured store")
    if boundary["storage"]["external_database_fallback"] != "forbidden":
        fail("external database fallback must be forbidden")
    env_contract = (root / "contracts" / "environment-contract.env.example").read_text(encoding="utf-8")
    for forbidden_env in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN"):
        if forbidden_env in env_contract:
            fail(f"forbidden environment key found: {forbidden_env}")
    forbidden_files = ("vercel.json", "netlify.toml", "wrangler.toml", "firebase.json")
    for name in forbidden_files:
        if (root / name).exists():
            fail(f"forbidden deployment file found: {name}")
    if "yangduhi/seoul_gaja" not in (root / "README.md").read_text(encoding="utf-8"):
        fail("authoritative GitHub repository missing from README")

    # Parse machine-readable contracts.
    for path in root.rglob("*.json"):
        json.loads(path.read_text(encoding="utf-8"))
    for path in root.rglob("*.yaml"):
        yaml.safe_load(path.read_text(encoding="utf-8"))
    for path in root.rglob("*.yml"):
        yaml.safe_load(path.read_text(encoding="utf-8"))

    # Phase completeness.
    phase_dirs = sorted((root / "phases").glob("phase-*"))
    if len(phase_dirs) != 9:
        fail(f"expected 9 phase directories, got {len(phase_dirs)}")
    required_phase_files = {"implementation-plan.md", "codex-work-order.md", "acceptance-contract.md"}
    for phase in phase_dirs:
        got = {p.name for p in phase.iterdir() if p.is_file()}
        if not required_phase_files.issubset(got):
            fail(f"phase incomplete: {phase.name}")

    # Design assets.
    required_mockups = {
        "01-home-map-light.png": (430, 932),
        "02-place-detail-light.png": (430, 932),
        "03-family-recommendations-light.png": (430, 932),
        "04-history-insights-dark.png": (430, 932),
        "05-desktop-dashboard.png": (1616, 923),
    }
    mockup_dir = root / "design" / "mockups"
    for name, dims in required_mockups.items():
        path = mockup_dir / name
        if not path.is_file():
            fail(f"mockup missing: {name}")
        with Image.open(path) as im:
            if im.size != dims:
                fail(f"mockup size mismatch: {name} {im.size} != {dims}")
            stat = ImageStat.Stat(im.convert("RGB"))
            if max(stat.var) < 10:
                fail(f"mockup appears blank: {name}")

    ai_boards = list((root / "design" / "ai-concept-boards").glob("*.png"))
    if len(ai_boards) < 4:
        fail("expected at least four AI concept boards")

    # Placeholder and accidental key scan.
    text_suffixes = {".md", ".yaml", ".yml", ".json", ".sql", ".txt", ".example"}
    placeholder = re.compile(r"\b(TBD|TODO|FIXME)\b")
    secret_patterns = [
        re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
        re.compile(r"(?i)(SEOUL_OPEN_DATA_KEY|SITE_INGEST_TOKEN|KAKAO_REST_API_KEY)[ \t]*=[ \t]*[^\s#]{8,}"),
    ]
    for path in actual_files:
        if path.name == "environment-contract.env.example":
            continue
        if path.suffix.lower() not in text_suffixes:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if placeholder.search(text):
            fail(f"placeholder found: {path.relative_to(root)}")
        for pattern in secret_patterns:
            if pattern.search(text):
                fail(f"possible secret found: {path.relative_to(root)}")

    print(f"PASS: {len(expected)} files verified")
    print(f"PASS: 9 phases, {len(ai_boards)} AI boards, {len(required_mockups)} deterministic mockups")


if __name__ == "__main__":
    main()
