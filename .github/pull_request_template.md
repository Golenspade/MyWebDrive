## Summary

- What changed:
- Why:

## Target branch

- [ ] Ordinary work targets `develop`.
- [ ] A PR targeting `main` is either a `develop -> main` release or a `hotfix/*`.

## Verification

- [ ] I ran the applicable narrow tests.
- [ ] I ran `./manage-services.sh quality`.
- [ ] I ran `./manage-services.sh smoke` when container runtime or end-to-end behavior changed.
- [ ] I described remaining risk below.

Remaining risk:

## Release boundary

- [ ] Production deployment remains manual; merging this PR does not authorize or execute deployment.
