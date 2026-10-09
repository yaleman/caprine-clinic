# Packaging and automation

## Reference conventions

The local TA-cloudflare-logs reference uses `scripts/build.py`, `scripts/release_metadata.py`, `mise.toml` and `.github/workflows/release.yml`. It checks before building on pushes to main, reads manifest identity/version, names packages `<app-id>-<version>.tar.gz`, uses `v<version>` release metadata, pins actions, queues main builds without cancellation, and excludes generated packages from Git. Its UCC/Python SDK generation is add-on-specific and is not copied into this React app.

Clinic adopts the applicable conventions with npm, esbuild and a standard-library archive writer. `package.json` supplies `splunk.appId` and version; both app.conf version fields and the lockfile must agree. Node is pinned to the actually tested 26.10.0; Python 3.9+ is required. Archives normalize member ordering, timestamps, modes, ownership and gzip metadata. Repeated builds with the same inputs/toolchain must be byte-identical; cross-toolchain compression equivalence is not claimed.

## Local commands

```sh
npm ci --no-audit --no-fund
npm run check
npm run package:metadata
```

`npm run check` runs model and packaging/fixture tests, TypeScript and the production build. The validator rejects path traversal, wrong roots, symlinks, duplicate entries, local configuration/secrets/dependency/cache directories, missing app files, inconsistent identity/version and broken asset fingerprints. The main archive contains only `caprine_clinic/default`, `metadata` and `appserver`. It does not contain test fixture apps, fixture data, credentials or screenshots. This validation is not AppInspect or Cloud certification.

Outputs:

- `dist/caprine_clinic-<version>.tar.gz`: installable production app.
- The adjacent `.sha256` checksum.
- `caprine-clinic.spl`: identical archive alias used by Compose first boot.
- `output/clinic-test-fixtures.spl`: separate local-only test app; never uploaded by CI.

Use Splunk's app installer for the versioned archive. Local `just init` generates ignored credentials and synthetic data; `just build`, `just up`, `just smoke` retain the existing isolated test flow. `just deploy` is the faster asset edit loop. Fixture generators preserve existing data. Original-count smoke tests and layout/pagination fixtures use separate indexes.

## Version bump

Run `npm version <version> --no-git-tag-version`, then update `[launcher]` and `[id]` versions in `splunk-app/default/app.conf`. Review the lockfile change, run checks, and commit the source changes. Builds fail on inconsistent metadata. No version bump, tag or release publication is implicit in a build.

## GitHub automation

The workflow builds on pushes to `main`, pull requests targeting main and manual dispatch. It uses immutable action SHAs, `contents: read`, disabled checkout credential persistence and no registry credentials. It uploads the archive and checksum in a commit-specific `caprine_clinic-v<version>-<sha>` artifact. No live Splunk instance, credentials, Docker or synthetic searches run in hosted CI.

Unlike the reference's release publisher, this workflow does not force-push tags, refresh GitHub Releases or grant contents-write permission. Automatic public release publication needs separately authorized write permissions and repository setup. No GitHub repository or remote has been created and nothing has been pushed; the workflow becomes active only after the source is placed in a GitHub repository with Actions enabled.

Official action references: [setup-node](https://github.com/actions/setup-node), [upload-artifact](https://github.com/actions/upload-artifact).

## Verification performed

Locked clean installation, eight TypeScript model tests, three Python packaging/fixture tests, TypeScript checking, asset fingerprint validation, archive inventory validation and two byte-identical production builds passed locally. The versioned tar.gz installed through the owned Splunk 10.4.4 app installer and reported version 0.1.0. The original synthetic fixture smoke still returned north=7/south=5 and acknowledged cancellation. No hosted Actions run, AppInspect or Cloud acceptance has been performed.
