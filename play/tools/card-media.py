#!/usr/bin/env python3
"""Lighter media for Play's cards. Run after adding to media.json; safe to re-run.

A card is 220-600 CSS px wide, so for each work it writes, beside the
960px card image (or a video's poster):
  <name>-480.webp, <name>-640.webp   narrower copies, cut from the
                                     2560px full view when there is one
and for each video:
  <name>-card.mp4                    a 720px, ~700 kbps preview loop
then records them in media.json as "srcset" (width descriptors, so the
browser picks by the card's real width) and "preview" (what a card plays;
the opened view still plays "full"). Needs ImageMagick and ffmpeg.
"""
import json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media.json"

def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def width_of(path):
    out = subprocess.run(["magick", "identify", "-format", "%w", str(path)], check=True, capture_output=True, text=True)
    return int(out.stdout.strip())

data = json.loads(MEDIA.read_text())
for project in data["projects"]:
    for m in project["media"]:
        card = m["poster"] if m["type"] == "video" else m["src"]  # media/<name>.webp
        card_path = ROOT / card
        source = ROOT / m["full"] if m["type"] == "image" and m.get("full", "").endswith(".webp") else card_path
        base_w = width_of(card_path)
        entries = []
        for w in (480, 640):
            if w >= base_w:
                continue
            rel = card[:-5] + f"-{w}.webp"
            out = ROOT / rel
            if not out.exists():
                run("magick", str(source), "-resize", f"{w}x", "-quality", "82", "-define", "webp:method=6", str(out))
            entries.append(f"{rel} {w}w")
        entries.append(f"{card} {base_w}w")
        m["srcset"] = ", ".join(entries)
        if m["type"] == "video":
            rel = m["src"][:-4] + "-card.mp4"
            out = ROOT / rel
            if not out.exists():
                run("ffmpeg", "-y", "-i", str(ROOT / m["src"]), "-an",
                    "-vf", "scale='if(gte(iw,ih),min(720,iw),-2)':'if(gte(iw,ih),-2,min(720,ih))':flags=lanczos",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-maxrate", "700k", "-bufsize", "1400k",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out))
            m["preview"] = rel

MEDIA.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
print("ok")
