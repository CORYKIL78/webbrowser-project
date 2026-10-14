# Patches

Put unified diff files named like `0001-short-description.patch` here. `apply-config.sh` applies them in name order to the Firefox source before building. There are none yet: Phase 1 only needs branding, preferences and policies.

Make a patch by editing a clean copy of the source, then run `diff -ruN original modified > browser/patches/0001-name.patch` (paths must start with `a/` and `b/` style prefixes, or use `git diff`).
