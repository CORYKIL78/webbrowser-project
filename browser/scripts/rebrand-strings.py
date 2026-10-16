#!/usr/bin/env python3
"""Replace the visible word "Firefox" with the Glyde name in the English text files of the browser.

Rules, kept simple on purpose so the result is predictable:
  * only the English locale folders are touched, and only text file types
  * only the capitalised word "Firefox" changes. Lower case names (file names, ids, keys) do not.
  * in .ftl files only the text after the "=" changes, never the message key
  * lines that mention Mozilla, or contain a web address, are left alone. That keeps the
    required "built on Mozilla technology" notices and every link intact.
  * comment lines are left alone

Every file that changes is printed, so a failed build can be traced back.

Usage: rebrand-strings.py <firefox source dir>
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAME = json.loads((ROOT / "browser" / "glyde.json").read_text())["name"]

FOLDERS = ["browser/locales/en-US", "toolkit/locales/en-US", "browser/components/newtab/locales/en-US"]
SUFFIXES = {".ftl", ".properties", ".dtd", ".inc"}
WORD = re.compile(r"\bFirefox\b")
FTL_KEY = re.compile(r"^(\s*[-\w.]+\s*=)(.*)$")


def convert_line(line, is_ftl):
    body = line.rstrip("\r\n")
    ending = line[len(body):]
    return convert_body(body, is_ftl) + ending


def convert_body(line, is_ftl):
    stripped = line.lstrip()
    if stripped.startswith(("#", "//", "<!--", "*")):
        return line
    if "Mozilla" in line or "http" in line:
        return line
    if is_ftl:
        m = FTL_KEY.match(line)
        if m:
            return m.group(1) + WORD.sub(NAME, m.group(2))
    return WORD.sub(NAME, line)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    if not (src / "browser").is_dir():
        print(f"{src} does not look like a Firefox source tree", file=sys.stderr)
        sys.exit(1)
    files = lines = 0
    for folder in FOLDERS:
        base = src / folder
        if not base.is_dir():
            print(f"skipped {folder} (not present)")
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix not in SUFFIXES:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            out = []
            changed = 0
            for line in text.splitlines(keepends=True):
                new = convert_line(line, path.suffix == ".ftl")
                changed += new != line
                out.append(new)
            if changed:
                path.write_text("".join(out), encoding="utf-8")
                files += 1
                lines += changed
                print(f"rebranded {changed:3d} lines in {path.relative_to(src)}")
    print(f"Done: {lines} lines in {files} files")


if __name__ == "__main__":
    main()
