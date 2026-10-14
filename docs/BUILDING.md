# Building Glyde

Status: the pipeline below has been written but not yet run. Expect the first build to need fixes. Send the failing log of any step and it can be repaired quickly.

## What you need

- 16 GB of memory or more, 40 GB of free disk, several hours
- Linux (or Windows with WSL 2), Python 3.11 or newer, `curl`, `tar`, `git`
- `pip install pillow` for the branding script

## How a build works

```
browser/glyde.json            pinned Firefox version and names
browser/scripts/fetch-source.sh     download the official source, check its checksum
browser/scripts/make-branding.py    create browser/branding/glyde from the logo
browser/scripts/apply-config.sh     add mozconfig and privacy defaults to the source
./mach build, ./mach package        Mozilla's own build commands
browser/scripts/post-package.sh     add the policies file to the finished package
```

## Run it by hand

```
bash browser/scripts/fetch-source.sh        # creates build/firefox-<version>/
python3 browser/scripts/make-branding.py build/firefox-*
bash browser/scripts/apply-config.sh build/firefox-*
cd build/firefox-*
./mach --no-interactive bootstrap --application-choice browser
./mach build
./mach package
cd ../..
bash browser/scripts/post-package.sh build/firefox-*
```

The finished archive is in `build/firefox-<version>/obj-glyde/dist/`, and the post step writes `glyde-linux-x86_64.tar.xz` into `dist/`.

## Run it on GitHub

Open the Actions tab, choose "Build Glyde", then Run workflow. The artifact appears on the run page. Large builds need a public repository or paid larger runners (see ROADMAP.md).

## Updating to a new Firefox version

Change `firefoxVersion` in `browser/glyde.json`, build, fix any patch that no longer applies. Do this at least every four weeks once the browser is public, because each Firefox release contains security fixes.
