# Gobi CLI Cheatsheet

A 1-page (US Letter, 8.5×11 portrait) printable PDF reference of the gobi-cli command surface.

## Files

| File | Description |
|------|-------------|
| `gobi-cli-cheatsheet.pdf` | The printable PDF — built from `gobi-cli-cheatsheet.html` |
| `gobi-cli-cheatsheet.html` | Self-contained HTML source (Inter + JetBrains Mono via CDN) |
| `build.py` | Headless-Chromium build script (writes both files) |

## Re-rendering

When the CLI surface changes, edit `build.py` (which contains the HTML inline) and re-run:

```sh
pip install playwright
python3 -m playwright install chromium
python3 build.py
```

Output: `gobi-cli-cheatsheet.html` and `gobi-cli-cheatsheet.pdf` (~125 KB, 1 page).

The script includes a child-clipping diagnostic that reports any element overflowing its parent — re-render after edits and confirm `✓ No child-clipping detected` before committing.
