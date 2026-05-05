# Release Process

This checklist defines the manual release flow used for MiCasa `v0.x` releases.

## 1) Prepare release branch state

- Ensure only intended release changes are included.
- Confirm working tree is clean enough to safely tag the intended commit.

## 2) Validate quality gates

- Run:

```bash
npm run ci
```

- Do not release if checks fail.

## 3) Confirm version metadata

- Verify `version` in `package.json`.
- For this milestone, version is `0.1.0`.

## 4) Update changelog

- Update `CHANGELOG.md` with a new release section.
- Use date and grouped entries (`Added`, `Changed`, `Fixed`).

## 5) Create annotated tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

## 6) Publish GitHub release

- Create release title: `MiCasa vX.Y.Z`.
- Paste release notes from `CHANGELOG.md`.
- Link to setup/run guidance in `README.md`.

## 7) Post-release checks

- Confirm tag exists on remote.
- Confirm GitHub release page is public and formatted.
- Confirm README points to changelog and release process docs.
