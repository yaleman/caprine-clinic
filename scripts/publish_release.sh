#!/usr/bin/env bash
set -euo pipefail
: "${GH_REPO:?}" "${GITHUB_SHA:?}" "${RELEASE_TAG:?}" "${RELEASE_ARCHIVE:?}"
[[ "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
[[ -f "$RELEASE_ARCHIVE" && -f "$RELEASE_ARCHIVE.sha256" ]]
# Skip superseded queued main builds before changing tags or assets.
main_sha=$(gh api "repos/$GH_REPO/commits/main" --jq '.sha')
if [[ "$main_sha" != "$GITHUB_SHA" ]]; then
  echo "Skipping release because main has a newer commit."
  exit 0
fi
if gh api "repos/$GH_REPO/git/ref/tags/$RELEASE_TAG" >/dev/null 2>&1; then
  gh api --method PATCH "repos/$GH_REPO/git/refs/tags/$RELEASE_TAG" \
    -f sha="$GITHUB_SHA" -F force=true >/dev/null
else
  gh api --method POST "repos/$GH_REPO/git/refs" \
    -f ref="refs/tags/$RELEASE_TAG" -f sha="$GITHUB_SHA" >/dev/null
fi
notes_file=$(mktemp)
trap 'rm -f "$notes_file"' EXIT
printf 'Splunk app package built from main at commit %s. Builds with the same package.json version replace these assets and move this version tag.\n' "$GITHUB_SHA" > "$notes_file"
if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  gh release edit "$RELEASE_TAG" --title "$RELEASE_TAG" --notes-file "$notes_file"
else
  gh release create "$RELEASE_TAG" --verify-tag --title "$RELEASE_TAG" --notes-file "$notes_file"
fi
gh release upload "$RELEASE_TAG" "$RELEASE_ARCHIVE" "$RELEASE_ARCHIVE.sha256" --clobber
