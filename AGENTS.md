# Project guidance

- Source lives in frontend/ and splunk-app/. Do not edit generated output/, dist/, archives or fingerprinted bundles.
- Use enums or dedicated types for machine-readable status/error/mode values.
- Run npm ci from the lockfile. Run npm run check before committing app or packaging changes.
- package.json identity/version, package-lock.json and both app.conf versions must agree. See docs/packaging.md.
- Keep all credentials, local instance state, generated fixtures, screenshots, caches and build artifacts ignored. CI packages only the production app; fixture apps are local-only.
- Splunk governs search permissions, time ranges, concurrency and runtime. Do not add app execution limits.
- Local live validation uses only authorized synthetic searches on the existing Clinic container. Preserve data and user drafts; do not change other Splunk apps.
- Publishing, pushing, repository creation or CI write permissions require explicit authorization. The prepared workflow only builds and uploads artifacts with read-only contents permission.
