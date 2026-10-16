/* In-browser updates for Glyde.
 *
 *   check()     asks the GitHub releases list whether a newer version exists
 *   download()  fetches the file for this system into the profile folder and checks its SHA-256
 *               against the SHA256SUMS.txt published with the release
 *   apply()     writes a small helper script, starts it, and quits. The script waits for Glyde to
 *               close, copies the new files over the install folder, and starts Glyde again.
 *
 * Nothing in the install folder is touched until apply(), and apply() only runs after the file has
 * passed the checksum. If anything fails earlier, the running copy is left exactly as it was.
 *
 * This is a "replace the files" updater for the portable download. It does not use Mozilla's
 * signed-patch updater.
 */

const { AppConstants } = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");

const VERSION = "__GLYDE_VERSION__";
const RELEASES = "https://api.github.com/repos/CORYKIL78/webbrowser-project/releases?per_page=10";

export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, "").split("-")[0].split(".").map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, "").split("-")[0].split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) {
      return d > 0 ? 1 : -1;
    }
  }
  return 0;
}

export function platformKey() {
  return AppConstants.platform === "win" ? "windows" : "linux";
}

/** Pure part of check(): pick the newest release newer than `current` that has a file for `platform`. */
export function pickRelease(releases, current, platform) {
  const usable = (Array.isArray(releases) ? releases : [])
    .filter(r => r && !r.draft && typeof r.tag_name === "string")
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  for (const r of usable) {
    if (compareVersions(r.tag_name, current) <= 0) {
      break;
    }
    const asset = (r.assets || []).find(a => a.name.toLowerCase().includes(platform) && /\.(zip|tar\.xz)$/.test(a.name));
    const sums = (r.assets || []).find(a => a.name === "SHA256SUMS.txt");
    if (asset) {
      return {
        version: r.tag_name.replace(/^v/i, ""),
        notes: String(r.body || "").slice(0, 2000),
        page: r.html_url,
        asset: { name: asset.name, url: asset.browser_download_url, size: asset.size },
        sumsUrl: sums ? sums.browser_download_url : null,
      };
    }
  }
  return null;
}

/** Pure part of download(): find the hash for one file in the text of SHA256SUMS.txt. */
export function findHash(sumsText, fileName) {
  for (const line of String(sumsText).split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line.trim());
    if (m && m[2].trim() === fileName) {
      return m[1].toLowerCase();
    }
  }
  return null;
}

export const GlydeUpdate = {
  version: VERSION,
  state: { phase: "idle", progress: 0, error: "", info: null, file: "" },
  _listeners: new Set(),

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },
  _set(patch) {
    this.state = { ...this.state, ...patch };
    for (const fn of this._listeners) {
      try {
        fn(this.state);
      } catch (e) {
        console.error(e);
      }
    }
  },

  async check() {
    this._set({ phase: "checking", error: "", info: null });
    try {
      const res = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) {
        throw new Error("GitHub answered with status " + res.status + ".");
      }
      const info = pickRelease(await res.json(), VERSION, platformKey());
      this._set({ phase: info ? "available" : "current", info });
      Services.prefs.setStringPref("glyde.update.lastChecked", String(Date.now()));
      return info;
    } catch (e) {
      this._set({ phase: "error", error: "Could not check for updates. " + e.message });
      return null;
    }
  },

  _dir() {
    return PathUtils.join(PathUtils.profileDir, "glyde-update");
  },

  async download() {
    const info = this.state.info;
    if (!info) {
      return;
    }
    if (!info.sumsUrl) {
      this._set({ phase: "error", error: "This release has no SHA256SUMS.txt, so the download cannot be checked. Use the release page instead." });
      return;
    }
    try {
      this._set({ phase: "downloading", progress: 0, error: "" });
      await IOUtils.makeDirectory(this._dir(), { ignoreExisting: true });
      const target = PathUtils.join(this._dir(), info.asset.name);
      await IOUtils.remove(target, { ignoreAbsent: true });

      const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
      const dl = await Downloads.createDownload({ source: info.asset.url, target });
      dl.onchange = () => this._set({ progress: Math.max(0, Math.min(100, dl.progress)) });
      await dl.start();

      this._set({ phase: "verifying", progress: 100 });
      const sumsRes = await fetch(info.sumsUrl);
      if (!sumsRes.ok) {
        throw new Error("Could not fetch the checksum list.");
      }
      const expected = findHash(await sumsRes.text(), info.asset.name);
      if (!expected) {
        throw new Error("The checksum list does not include " + info.asset.name + ".");
      }
      const actual = await IOUtils.computeHexDigest(target, "sha256");
      if (actual !== expected) {
        await IOUtils.remove(target, { ignoreAbsent: true });
        throw new Error("The downloaded file did not match its checksum, so it was deleted.");
      }
      this._set({ phase: "ready", file: target });
    } catch (e) {
      this._set({ phase: "error", error: e.message });
    }
  },

  async _canWriteInstall() {
    try {
      const dir = Services.dirsvc.get("GreD", Ci.nsIFile).path;
      const probe = PathUtils.join(dir, ".glyde-write-test");
      await IOUtils.writeUTF8(probe, "x");
      await IOUtils.remove(probe);
      return dir;
    } catch (e) {
      return null;
    }
  },

  /** Writes the helper script, starts it, and quits. Returns an error message, or nothing. */
  async apply() {
    const archive = this.state.file;
    if (this.state.phase !== "ready" || !archive) {
      return "There is no verified update to install.";
    }
    const installDir = await this._canWriteInstall();
    if (!installDir) {
      return "Glyde is installed somewhere it cannot change itself (for example Program Files). Close Glyde, then extract the file in " + this._dir() + " over your Glyde folder by hand.";
    }
    const exe = Services.dirsvc.get("XREExeF", Ci.nsIFile).path;
    const pid = String(Services.appinfo.processID);
    try {
      if (AppConstants.platform === "win") {
        await this._runWindows(archive, installDir, exe, pid);
      } else {
        await this._runLinux(archive, installDir, exe, pid);
      }
    } catch (e) {
      return "Could not start the updater: " + e.message;
    }
    Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
    return "";
  },

  _spawn(program, args) {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(program);
    const proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    proc.init(file);
    if (AppConstants.platform === "win") {
      proc.runw(false, args, args.length);
    } else {
      proc.run(false, args, args.length);
    }
  },

  async _runWindows(archive, dest, exe, pid) {
    const script = PathUtils.join(this._dir(), "apply-update.ps1");
    await IOUtils.writeUTF8(
      script,
      [
        "param([int]$ProcId,[string]$Archive,[string]$Dest,[string]$Exe)",
        "$log = Join-Path (Split-Path $Archive) 'update.log'",
        "try {",
        "  try { Wait-Process -Id $ProcId -Timeout 90 -ErrorAction SilentlyContinue } catch {}",
        "  Start-Sleep -Seconds 2",
        "  $stage = Join-Path (Split-Path $Archive) 'stage'",
        "  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }",
        "  Expand-Archive -LiteralPath $Archive -DestinationPath $stage -Force",
        "  $src = Join-Path $stage 'glyde'",
        "  if (-not (Test-Path $src)) { $src = $stage }",
        "  robocopy $src $Dest /E /R:5 /W:2 /NFL /NDL /NJH /NJS | Out-Null",
        "  if ($LASTEXITCODE -ge 8) { throw \"robocopy failed with code $LASTEXITCODE\" }",
        "  Remove-Item $stage -Recurse -Force",
        "  Remove-Item $Archive -Force",
        "  Add-Content $log \"$(Get-Date -Format s) updated\"",
        "} catch {",
        "  Add-Content $log \"$(Get-Date -Format s) failed: $_\"",
        "}",
        "Start-Process -FilePath $Exe",
        "",
      ].join("\r\n")
    );
    const ps = PathUtils.join(Services.env.get("SystemRoot") || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    this._spawn(ps, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script, "-ProcId", pid, "-Archive", archive, "-Dest", dest, "-Exe", exe]);
  },

  async _runLinux(archive, dest, exe, pid) {
    const script = PathUtils.join(this._dir(), "apply-update.sh");
    await IOUtils.writeUTF8(
      script,
      [
        "#!/bin/bash",
        'PID="$1"; ARCHIVE="$2"; DEST="$3"; EXE="$4"',
        'LOG="$(dirname "$ARCHIVE")/update.log"',
        'for i in $(seq 1 90); do kill -0 "$PID" 2>/dev/null || break; sleep 1; done',
        "sleep 2",
        'STAGE="$(dirname "$ARCHIVE")/stage"',
        'rm -rf "$STAGE"; mkdir -p "$STAGE"',
        'if tar -xJf "$ARCHIVE" -C "$STAGE" && cp -a "$STAGE/glyde/." "$DEST/"; then',
        '  rm -rf "$STAGE" "$ARCHIVE"; echo "$(date -Is) updated" >> "$LOG"',
        "else",
        '  echo "$(date -Is) failed" >> "$LOG"',
        "fi",
        'nohup "$EXE" >/dev/null 2>&1 &',
        "",
      ].join("\n")
    );
    this._spawn("/bin/bash", [script, pid, archive, dest, exe]);
  },
};
