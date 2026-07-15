# Git workflow

MyWebDrive uses a lightweight dual-branch workflow. `main` is the production authority and GitHub default branch. `develop` is the integration branch for the next release.

## Ordinary development

1. Update local `develop` from `origin/develop`.
2. Create `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, or `codex/<slug>` from `develop`.
3. Open a Pull Request targeting `develop`.
4. Wait for the required `core-release` check and resolve all conversations.
5. Squash merge with a scoped Conventional Commit and delete the short-lived branch.

Direct pushes, force pushes, and deletion are forbidden on `main` and `develop`. This personal repository requires zero approving reviews, so the owner may merge their own Pull Request after all automated requirements pass.

## Release

1. Confirm the current `develop` push run is green.
2. Before opening `develop -> main`, run the protected history sync if `main` is not already an ancestor of `develop`.
3. Open the release Pull Request `develop -> main` and record the change summary, verification, and remaining risk.
4. Wait for the required `core-release` check and resolve all conversations.
5. Use Merge commit, not Squash merge, so `develop` remains an ancestor of `main`.
6. Wait for the merged `main` push run to publish all immutable images.
7. Run the protected history sync again with the newly published `main` before ordinary integration resumes.
8. The release is closed only when `main` is an ancestor of `develop`.
9. Production deployment remains manual. On the production host run `bash infrastructure/alicloud/deploy.sh "sha-<40-lowercase-hex>"` only after selecting the exact successful `main` SHA.

Merging to `main` publishes images but does not deploy production automatically.

## Protected history sync

Strict status checks require the release head to contain the current base history. Use this protected path when the branches have already diverged and after every release Merge commit.

1. Create a short-lived sync branch from the latest `develop`.
2. Merge the current `main` into the sync branch with a normal merge commit. Do not rebase or squash the histories.
3. Push the sync branch. Open a Pull Request from the sync branch to `develop`.
4. Wait for the required `core-release` check and resolve all conversations. This personal repository requires zero approving reviews.
5. Use Merge commit, not Squash merge, so the `main` history remains reachable from `develop`.
6. Wait for the exact resulting `develop` push to succeed and verify `Publish immutable images` is `skipped`.
7. Verify that `main` is an ancestor of `develop`. Do not use the update-branch API or push directly to `develop`.

If GitHub rejects any protected step, stop and inspect the failure instead of bypassing or weakening branch protection.

## Hotfix

1. Create `hotfix/<slug>` from the current `main`.
2. Open a Pull Request targeting `main`, wait for CI, and Squash merge the minimal fix.
3. Wait for the `main` image publication and deploy the selected immutable SHA manually.
4. Immediately open `main -> develop` and use Merge commit to return the hotfix to development.

If deployment fails, use `infrastructure/alicloud/rollback.sh` with an existing immutable manifest. Never rewrite Git history to represent a production rollback.

## CI and dependency updates

- Pull Requests to `main` and `develop` run the full Core release CI.
- Pushes to both long-lived branches run CI.
- Only a successful push to `main` may publish production-candidate images.
- Dependabot targets `develop` and follows the ordinary development flow.

## Merge summary

| Change | Source | Target | Merge method |
| --- | --- | --- | --- |
| Ordinary work | short-lived branch | `develop` | Squash merge |
| Release | `develop` | `main` | Merge commit |
| Protected history sync | short-lived sync branch | `develop` | Merge commit |
| Emergency fix | `hotfix/*` | `main` | Squash merge |
| Hotfix return | `main` | `develop` | Merge commit |
