# MyWebDrive Lightweight Dual-Branch Git Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `main` as the protected production authority and `develop` as the protected development-integration branch, with CI on both branches, image publication only from `main`, and manual production deployment.

**Architecture:** Bootstrap `develop` directly from the current remote `main`, then perform all repository changes on a short-lived implementation branch targeting `develop`. Encode the workflow in tracked documentation and contract tests, promote the result through a real `develop -> main` release PR, then enable GitHub branch protection and verify it through both rejected direct pushes and a post-protection PR cycle.

**Tech Stack:** Git, GitHub CLI (`gh`), GitHub REST API, GitHub Actions, Bash, Node.js `node:test`, pnpm 9.7.0, Markdown, YAML

## Global Constraints

- `main` is the GitHub default branch, production authority, and only source of production-candidate images.
- `develop` is the development integration branch; ordinary work targets `develop` through short-lived Pull Requests.
- Ordinary PRs use Squash merge; `develop -> main` releases and `main -> develop` hotfix synchronization use Merge commits.
- `main` and `develop` require Pull Requests, strict `core-release` status checks, resolved conversations, zero approving reviews, and admin enforcement.
- Force pushes and branch deletion are disabled for both long-lived branches.
- Pushes to `develop` run CI but must never publish images; only successful pushes to `main` publish immutable `sha-<40 lowercase hex>` images.
- Production deployment remains manual through `infrastructure/alicloud/deploy.sh`; this plan must not execute a production deployment.
- Dependabot targets `develop` explicitly because the GitHub default branch remains `main`.
- Do not delete or rewrite existing remote history branches as part of this migration.
- Repository changes use Node.js 20+, Corepack, and pnpm 9.7.0, and must pass `./manage-services.sh quality`.
- The current checkout is already a linked worktree. Use `superpowers:using-git-worktrees` to verify that isolation, do not create a nested worktree, and switch this worktree to the implementation branch before editing repository files.
- Do not print credentials or GitHub tokens; use the existing authenticated `gh` session.
- Approved design: `docs/superpowers/specs/2026-07-15-lightweight-dual-branch-git-workflow-design.md`.

---

### Task 1: Bootstrap `develop` and the isolated implementation branch

**Files:**
- Read: `docs/superpowers/specs/2026-07-15-lightweight-dual-branch-git-workflow-design.md`
- Read: `docs/superpowers/plans/2026-07-15-lightweight-dual-branch-git-workflow.md`
- External state: `refs/heads/develop` on `origin`
- External state: current linked worktree switched to branch `codex/implement-lightweight-dual-branch`

**Interfaces:**
- Consumes: clean local branch `codex/lightweight-dual-branch-workflow`, authenticated `gh`, and current `origin/main`
- Produces: remote `origin/develop` pointing exactly at the pre-migration `origin/main`, plus the current isolated worktree switched to an implementation branch containing the approved design and plan commits

- [ ] **Step 1: Verify the live repository and GitHub preconditions**

Run from the current workspace:

```bash
git status --short --branch
git fetch origin --prune
repo=$(git remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
gh api "repos/$repo" --jq '{default_branch,visibility,allow_merge_commit,allow_squash_merge}'
git ls-remote --heads origin main develop
```

Expected:

- The worktree is clean on `codex/lightweight-dual-branch-workflow`.
- `git rev-parse --git-dir` and `git rev-parse --git-common-dir` resolve to different directories, proving this checkout is already a linked worktree.
- `default_branch` is `main`.
- `allow_merge_commit` and `allow_squash_merge` are both `true`.
- `refs/heads/main` exists and `refs/heads/develop` is absent.

If `develop` already exists, stop this task and compare it with `origin/main`; do not overwrite it.

- [ ] **Step 2: Rebase the unpushed planning branch onto the latest `origin/main`**

Run:

```bash
git rebase origin/main
git merge-base --is-ancestor origin/main HEAD
git log --reverse --format='%H %s' origin/main..HEAD
```

Expected: the ancestry check succeeds and the log contains only the approved design commit and this implementation-plan commit. If unrelated commits appear, stop rather than forwarding them into `develop`.

- [ ] **Step 3: Create `develop` from the exact current production branch**

Run:

```bash
git push origin origin/main:refs/heads/develop
git fetch origin develop
test "$(git rev-parse origin/main)" = "$(git rev-parse origin/develop)"
```

Expected: the push creates `develop`, and the equality assertion succeeds.

- [ ] **Step 4: Reuse the current isolated worktree and create the implementation branch**

Invoke `superpowers:using-git-worktrees` to verify the current checkout is already isolated. Do not create a nested worktree. Then run:

```bash
git switch -c codex/implement-lightweight-dual-branch origin/develop
```

Continue all remaining tasks from this worktree.

Expected:

```bash
git status --short --branch
git merge-base --is-ancestor origin/develop HEAD
```

Both commands show a clean implementation branch based on `origin/develop`.

- [ ] **Step 5: Bring the approved design and plan into the implementation branch**

Run inside the implementation worktree:

```bash
planning_branch=codex/lightweight-dual-branch-workflow
git rev-list --reverse origin/main.."$planning_branch" > /tmp/mywebdrive-dual-branch-planning-commits
test "$(wc -l < /tmp/mywebdrive-dual-branch-planning-commits | tr -d ' ')" = 2
while IFS= read -r commit; do git cherry-pick "$commit"; done < /tmp/mywebdrive-dual-branch-planning-commits
rm /tmp/mywebdrive-dual-branch-planning-commits
git log --reverse --format='%s' origin/develop..HEAD
```

Expected commit subjects:

```text
docs(git): define lightweight dual-branch workflow
docs(git): add lightweight dual-branch implementation plan
```

No additional commit is needed in this task because the two reviewed planning commits are preserved by `cherry-pick`.

- [ ] **Step 6: Verify the isolated baseline before implementation**

Run:

```bash
./manage-services.sh quality
git status --short --branch
```

Expected: the complete fail-closed quality gate succeeds and the worktree is clean on `codex/implement-lightweight-dual-branch`.

---

### Task 2: Add the tracked Git workflow authority with a failing contract first

**Files:**
- Modify: `scripts/test-repo-authority-contract.sh:6-14,31-44,124-145`
- Create: `docs/git-workflow.md`
- Create: `.github/pull_request_template.md`
- Modify: `README.md:82-86`
- Modify: `CONTRIBUTING.md:18-40`

**Interfaces:**
- Consumes: repository authority helpers `record_failure`, `require_text`, and `reject_pattern`
- Produces: tracked human workflow authority and a fail-closed contract that requires the `main`/`develop` rules and manual deployment boundary

- [ ] **Step 1: Extend the repository authority test before creating the documents**

Replace `ACTIVE_DOCS` with the complete tracked authority list:

```bash
ACTIVE_DOCS=(
  "$ROOT_DIR/CLAUDE.md"
  "$ROOT_DIR/README.md"
  "$ROOT_DIR/docs/git-workflow.md"
  "$ROOT_DIR/infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md"
)
```

Then add these variables after `WORKFLOW_DOCS`:

```bash
GIT_WORKFLOW_DOC="$ROOT_DIR/docs/git-workflow.md"
PR_TEMPLATE="$ROOT_DIR/.github/pull_request_template.md"
```

After the `reject_pattern` helper, add the exact contract:

```bash
for required_file in "$GIT_WORKFLOW_DOC" "$PR_TEMPLATE"; do
  if [[ ! -f "$required_file" ]]; then
    record_failure "Git workflow authority is missing: ${required_file#"$ROOT_DIR/"}"
  fi
done

require_text "$ROOT_DIR/README.md" 'docs/git-workflow.md' 'README Git workflow entrypoint'
require_text "$ROOT_DIR/CONTRIBUTING.md" 'feature/*' 'CONTRIBUTING short-lived branch rule'
require_text "$ROOT_DIR/CONTRIBUTING.md" '`develop`' 'CONTRIBUTING development branch rule'

if [[ -f "$GIT_WORKFLOW_DOC" ]]; then
  require_text "$GIT_WORKFLOW_DOC" '`main`' 'Git workflow production branch'
  require_text "$GIT_WORKFLOW_DOC" '`develop`' 'Git workflow development branch'
  require_text "$GIT_WORKFLOW_DOC" '`develop -> main`' 'Git workflow release direction'
  require_text "$GIT_WORKFLOW_DOC" '`hotfix/*`' 'Git workflow hotfix path'
  require_text "$GIT_WORKFLOW_DOC" 'deploy.sh "sha-<40-lowercase-hex>"' 'Git workflow manual deployment boundary'
fi

if [[ -f "$PR_TEMPLATE" ]]; then
  require_text "$PR_TEMPLATE" '## Target branch' 'Pull Request target-branch prompt'
  require_text "$PR_TEMPLATE" 'Production deployment remains manual' 'Pull Request deployment boundary'
fi
```

- [ ] **Step 2: Run the contract to verify it fails for the missing authority**

Run:

```bash
bash scripts/test-repo-authority-contract.sh
```

Expected: exit `1` with failures naming `docs/git-workflow.md`, `.github/pull_request_template.md`, the README entrypoint, and the CONTRIBUTING branch rules.

- [ ] **Step 3: Create `docs/git-workflow.md` with the complete operational contract**

Create the file with this content:

```markdown
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
2. Open the release Pull Request `develop -> main` and record the change summary, verification, and remaining risk.
3. Wait for the required check.
4. Use Merge commit, not Squash merge, so `develop` remains an ancestor of `main`.
5. Wait for the merged `main` push run to publish all immutable images.
6. Production deployment remains manual. On the production host run `bash infrastructure/alicloud/deploy.sh "sha-<40-lowercase-hex>"` only after selecting the exact successful `main` SHA.

Merging to `main` publishes images but does not deploy production automatically.

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
| Emergency fix | `hotfix/*` | `main` | Squash merge |
| Hotfix return | `main` | `develop` | Merge commit |
```

- [ ] **Step 4: Add the contribution entrypoints and Pull Request template**

Insert this section before `## Pull requests` in `CONTRIBUTING.md`:

```markdown
## Git workflow

- `main` is the protected production authority and GitHub default branch.
- `develop` is the protected integration branch for the next release.
- Create `feature/*`, `fix/*`, `chore/*`, `docs/*`, or `codex/*` from `develop` and target `develop` with the Pull Request.
- Ordinary work uses Squash merge. A release Pull Request from `develop` to `main` uses Merge commit.
- A `hotfix/*` starts from `main`, returns to `main`, and must then be synchronized through a `main` to `develop` Pull Request.

See [`docs/git-workflow.md`](docs/git-workflow.md) for the exact branch, CI, release, and hotfix contract.
```

Insert this section before `## 安全与贡献` in `README.md`:

```markdown
## Git 工作流

仓库采用轻量双分支：`main` 是生产权威，`develop` 是下一版本的开发集成分支。日常修改从 `develop` 创建短期分支并通过 PR 回到 `develop`；发布通过 `develop -> main` PR 提升。完整规则见 [`docs/git-workflow.md`](docs/git-workflow.md)。
```

Create `.github/pull_request_template.md` with:

```markdown
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
```

- [ ] **Step 5: Run the documentation and repository-authority gates**

Run:

```bash
bash scripts/test-repo-authority-contract.sh
corepack pnpm run verify:docs
git diff --check
```

Expected:

```text
repository authority contract tests: ok
```

`verify:docs` and `git diff --check` exit `0`.

- [ ] **Step 6: Commit the tracked workflow authority**

```bash
git add scripts/test-repo-authority-contract.sh docs/git-workflow.md .github/pull_request_template.md README.md CONTRIBUTING.md
git commit -m "docs(git): document dual-branch contribution flow"
```

---

### Task 3: Route CI and Dependabot through `develop` without widening publication

**Files:**
- Modify: `scripts/verify-release-gate.test.mjs:13-31`
- Modify: `.github/workflows/ci.yml:3-6,155-166`
- Modify: `.github/dependabot.yml:7-58`

**Interfaces:**
- Consumes: existing `core-release` GitHub Actions job and its main-only publish condition
- Produces: CI on pushes and PRs for both long-lived branches, Dependabot PRs targeting `develop`, and a test proving publication remains main-only

- [ ] **Step 1: Write the failing dual-branch release-gate test**

Add this test immediately after the existing `CI orders quality...` test in `scripts/verify-release-gate.test.mjs`:

```javascript
test('dual-branch CI validates develop but publishes only main', async () => {
  const workflow = await read('.github/workflows/ci.yml')
  assert.match(workflow, /push:\s*\n\s*branches: \[main, develop\]/)
  assert.match(workflow, /pull_request:\s*\n\s*branches: \[main, develop\]/)

  const publishStart = workflow.indexOf('name: Publish immutable images')
  assert(publishStart >= 0)
  const publishStep = workflow.slice(publishStart)
  assert.match(publishStep, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/)
  assert.doesNotMatch(publishStep, /refs\/heads\/develop/)

  const dependabot = await read('.github/dependabot.yml')
  const updateEntries = dependabot.match(/package-ecosystem:/g) ?? []
  const developTargets = dependabot.match(/target-branch: "?develop"?/g) ?? []
  assert.equal(developTargets.length, updateEntries.length)
})
```

- [ ] **Step 2: Run only the new test and verify the current configuration fails**

Run:

```bash
node --test --test-name-pattern='dual-branch CI validates develop' scripts/verify-release-gate.test.mjs
```

Expected: FAIL because push only lists `[main]`, `pull_request` has no branch list, and Dependabot has no `target-branch` entries.

- [ ] **Step 3: Apply the minimal CI trigger change**

Change the top of `.github/workflows/ci.yml` to:

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

Do not change the publish condition. It must remain:

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

- [ ] **Step 4: Route every Dependabot update source to `develop`**

Under the `directory` field of each of the three update entries in `.github/dependabot.yml`, add:

```yaml
    target-branch: "develop"
```

The entries are root npm, frontend npm, and GitHub Actions. Do not change schedules, grouping, limits, labels, or commit prefixes.

- [ ] **Step 5: Run the targeted and full release-gate tests**

Run:

```bash
node --test --test-name-pattern='dual-branch CI validates develop' scripts/verify-release-gate.test.mjs
corepack pnpm run test:release-gate
git diff --check
```

Expected: the targeted test passes, the full release-gate suite exits `0`, and `git diff --check` is clean.

- [ ] **Step 6: Run the full fail-closed local quality gate**

Run:

```bash
./manage-services.sh quality
```

Expected: every command in `Makefile`'s `quality-check` target succeeds, ending with:

```text
✅ 质量检查完成
```

- [ ] **Step 7: Commit the automation routing**

```bash
git add scripts/verify-release-gate.test.mjs .github/workflows/ci.yml .github/dependabot.yml
git commit -m "ci(repo): route development through develop"
git status --short --branch
```

Expected: the implementation worktree is clean and ahead of `origin/develop` by the planning, documentation, and automation commits.

---

### Task 4: Exercise the initial `develop` integration and `main` release path

**Files:**
- Read: `.github/workflows/ci.yml`
- Read: `docs/git-workflow.md`
- External state: implementation Pull Request targeting `develop`
- External state: release Pull Request `develop -> main`
- External state: GitHub Actions runs and immutable GHCR images

**Interfaces:**
- Consumes: clean `codex/implement-lightweight-dual-branch` with all local gates green
- Produces: repository changes merged into `develop`, then promoted to `main` with a successful main-only image publication; performs no production deployment

- [ ] **Step 1: Push the implementation branch and create the integration Pull Request**

Run:

```bash
git push -u origin codex/implement-lightweight-dual-branch
integration_pr=$(gh pr create \
  --base develop \
  --head codex/implement-lightweight-dual-branch \
  --title "chore(repo): establish lightweight dual-branch workflow" \
  --body $'## Summary\n\n- document the main/develop workflow\n- validate both long-lived branches in CI\n- keep image publication main-only\n- route Dependabot to develop\n\n## Verification\n\n- ./manage-services.sh quality\n\n## Release boundary\n\nProduction deployment remains manual and is not executed by this PR.')
printf '%s\n' "$integration_pr"
```

Expected: a Pull Request URL whose base is `develop`.

- [ ] **Step 2: Wait for the integration PR checks and Squash merge it**

Run:

```bash
gh pr checks "$integration_pr" --watch --interval 10
gh pr merge "$integration_pr" --squash --delete-branch
git fetch origin develop
```

Expected: checks succeed, the PR is merged, and `origin/develop` advances by one Squash commit.

- [ ] **Step 3: Verify the post-merge `develop` push run and skipped publication**

Run:

```bash
develop_sha=$(git rev-parse origin/develop)
for attempt in {1..24}; do
  develop_run=$(gh run list --workflow ci.yml --branch develop --event push --limit 20 \
    --json databaseId,headSha \
    --jq ".[] | select(.headSha == \"$develop_sha\") | .databaseId" | head -n 1)
  [[ -n ${develop_run:-} ]] && break
  sleep 5
done
test -n "${develop_run:-}"
gh run watch "$develop_run" --exit-status
test "$(gh run view "$develop_run" --json jobs --jq '.jobs[].steps[] | select(.name == "Publish immutable images") | .conclusion')" = skipped
```

Expected: the exact `develop` SHA run succeeds and `Publish immutable images` is `skipped`.

- [ ] **Step 4: Create and merge the first `develop -> main` release PR**

Run:

```bash
release_pr=$(gh pr create \
  --base main \
  --head develop \
  --title "chore(release): promote dual-branch workflow" \
  --body $'## Summary\n\nPromote the approved lightweight dual-branch workflow from develop to main.\n\n## Verification\n\n- develop integration PR passed Core release CI\n- develop push passed Core release CI\n- develop publication step was skipped\n\n## Remaining risk\n\nBranch protection is configured after this bootstrap release and then verified through a protected PR cycle.\n\nProduction deployment remains manual and is not executed by this PR.')
printf '%s\n' "$release_pr"
gh pr checks "$release_pr" --watch --interval 10
gh pr merge "$release_pr" --merge
git fetch origin main develop
git merge-base --is-ancestor origin/develop origin/main
```

Expected: the release PR uses a Merge commit, remains on both long-lived branches, and `origin/develop` is an ancestor of `origin/main`.

- [ ] **Step 5: Verify the exact merged `main` run publishes images**

Run:

```bash
main_sha=$(git rev-parse origin/main)
for attempt in {1..24}; do
  main_run=$(gh run list --workflow ci.yml --branch main --event push --limit 20 \
    --json databaseId,headSha \
    --jq ".[] | select(.headSha == \"$main_sha\") | .databaseId" | head -n 1)
  [[ -n ${main_run:-} ]] && break
  sleep 5
done
test -n "${main_run:-}"
gh run watch "$main_run" --exit-status
test "$(gh run view "$main_run" --json jobs --jq '.jobs[].steps[] | select(.name == "Publish immutable images") | .conclusion')" = success
printf 'published image tag: sha-%s\n' "$main_sha"
```

Expected: the exact `main` run succeeds and the publish step is `success`. Record the SHA, but do **not** run `deploy.sh`.

---

### Task 5: Enable branch protection and verify the protected personal workflow

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-lightweight-dual-branch-git-workflow-design.md:3`
- External state: classic branch protection for `main` and `develop`
- External state: protected acceptance PR targeting `develop`
- External state: protected release PR `develop -> main`

**Interfaces:**
- Consumes: a successful main push run whose job name is `core-release`, both long-lived branches containing the new workflow, and owner-level GitHub administration permission
- Produces: protected `main` and `develop`, verified rejection of direct owner pushes, verified zero-review self-merge through CI, and design status marked implemented

- [ ] **Step 1: Discover and assert the actual required check context**

Run:

```bash
repo=$(git remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
main_sha=$(git rev-parse origin/main)
main_run=$(gh run list --workflow ci.yml --branch main --event push --limit 20 \
  --json databaseId,headSha \
  --jq ".[] | select(.headSha == \"$main_sha\") | .databaseId" | head -n 1)
check_context=$(gh run view "$main_run" --json jobs --jq '[.jobs[].name] | unique | if length == 1 then .[0] else error("expected one CI job") end')
test "$check_context" = core-release
printf 'required check context: %s\n' "$check_context"
```

Expected: `required check context: core-release`.

- [ ] **Step 2: Apply the same fail-closed protection payload to both branches**

Run:

```bash
protection_payload=$(jq -nc --arg check "$check_context" '{
  required_status_checks: {strict: true, contexts: [$check]},
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: false,
    require_code_owner_reviews: false,
    required_approving_review_count: 0,
    require_last_push_approval: false
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  required_conversation_resolution: true
}')

for branch in main develop; do
  printf '%s' "$protection_payload" | gh api \
    --method PUT \
    -H 'Accept: application/vnd.github+json' \
    "repos/$repo/branches/$branch/protection" \
    --input - >/dev/null
done
```

Expected: both API requests return success. If GitHub rejects the payload, stop and inspect the response; do not weaken or partially apply rules silently.

- [ ] **Step 3: Verify every protection field through the API**

Run:

```bash
for branch in main develop; do
  gh api "repos/$repo/branches/$branch/protection" --jq '{
    branch: "'"$branch"'",
    strict: .required_status_checks.strict,
    contexts: .required_status_checks.contexts,
    approvals: .required_pull_request_reviews.required_approving_review_count,
    admins: .enforce_admins.enabled,
    conversations: .required_conversation_resolution.enabled,
    force_pushes: .allow_force_pushes.enabled,
    deletions: .allow_deletions.enabled,
    linear_history: .required_linear_history.enabled
  }'
done
```

Expected for both branches:

```json
{
  "branch": "main or develop",
  "strict": true,
  "contexts": ["core-release"],
  "approvals": 0,
  "admins": true,
  "conversations": true,
  "force_pushes": false,
  "deletions": false,
  "linear_history": false
}
```

- [ ] **Step 4: Prove direct owner pushes are rejected without changing the worktree**

Run:

```bash
git fetch origin main develop
for branch in main develop; do
  base=$(git rev-parse "origin/$branch")
  tree=$(git rev-parse "$base^{tree}")
  probe=$(printf 'branch protection probe for %s\n' "$branch" | git commit-tree "$tree" -p "$base")
  if git push origin "$probe:refs/heads/$branch"; then
    printf 'unexpected direct push success for %s\n' "$branch" >&2
    exit 1
  fi
done
```

Expected: both pushes are rejected by GitHub branch protection. `git status --short` remains empty because `git commit-tree` does not move the checked-out branch.

- [ ] **Step 5: Create a meaningful post-protection acceptance change**

Run in the implementation worktree:

```bash
git fetch origin develop
git switch -c codex/activate-dual-branch-workflow origin/develop
```

Change the design status line exactly from:

```markdown
- 状态：已批准，待实施
```

to:

```markdown
- 状态：已实施
```

Then run and commit:

```bash
corepack pnpm run verify:docs
git diff --check
git add docs/superpowers/specs/2026-07-15-lightweight-dual-branch-git-workflow-design.md
git commit -m "docs(git): mark dual-branch workflow active"
git push -u origin codex/activate-dual-branch-workflow
```

- [ ] **Step 6: Verify a zero-review owner PR can merge into protected `develop`**

Run:

```bash
acceptance_pr=$(gh pr create \
  --base develop \
  --head codex/activate-dual-branch-workflow \
  --title "docs(git): mark dual-branch workflow active" \
  --body $'## Summary\n\nMark the approved workflow active after applying and verifying branch protection.\n\n## Verification\n\n- branch protection API fields verified\n- direct pushes to main and develop rejected\n- pnpm run verify:docs\n\nProduction deployment remains manual and is not executed by this PR.')
gh pr checks "$acceptance_pr" --watch --interval 10
gh pr merge "$acceptance_pr" --squash --delete-branch
git fetch origin develop
```

Expected: the owner merges without an approving review only after `core-release` passes. This is the positive counterpart to the rejected direct-push probes.

- [ ] **Step 7: Verify the protected `develop` push run remains non-publishing**

Run:

```bash
protected_develop_sha=$(git rev-parse origin/develop)
for attempt in {1..24}; do
  protected_develop_run=$(gh run list --workflow ci.yml --branch develop --event push --limit 20 \
    --json databaseId,headSha \
    --jq ".[] | select(.headSha == \"$protected_develop_sha\") | .databaseId" | head -n 1)
  [[ -n ${protected_develop_run:-} ]] && break
  sleep 5
done
test -n "${protected_develop_run:-}"
gh run watch "$protected_develop_run" --exit-status
test "$(gh run view "$protected_develop_run" --json jobs --jq '.jobs[].steps[] | select(.name == "Publish immutable images") | .conclusion')" = skipped
```

Expected: the protected `develop` push succeeds and its publication step is `skipped` before release promotion begins.

- [ ] **Step 8: Promote the protected acceptance change through a protected release PR**

Run:

```bash
protected_release_pr=$(gh pr create \
  --base main \
  --head develop \
  --title "chore(release): record protected dual-branch activation" \
  --body $'## Summary\n\nPromote the post-protection acceptance record from develop to main.\n\n## Verification\n\n- protected owner PR to develop passed and merged\n- direct pushes to both long-lived branches were rejected\n\nProduction deployment remains manual and is not executed by this PR.')
gh pr checks "$protected_release_pr" --watch --interval 10
gh pr merge "$protected_release_pr" --merge
git fetch origin main develop
git merge-base --is-ancestor origin/develop origin/main
```

Expected: the protected release PR merges with zero approvals only after CI, using a Merge commit.

- [ ] **Step 9: Verify final CI publication and final repository state**

Run:

```bash
final_main_sha=$(git rev-parse origin/main)
for attempt in {1..24}; do
  final_main_run=$(gh run list --workflow ci.yml --branch main --event push --limit 20 \
    --json databaseId,headSha \
    --jq ".[] | select(.headSha == \"$final_main_sha\") | .databaseId" | head -n 1)
  [[ -n ${final_main_run:-} ]] && break
  sleep 5
done
test -n "${final_main_run:-}"
gh run watch "$final_main_run" --exit-status
test "$(gh run view "$final_main_run" --json jobs --jq '.jobs[].steps[] | select(.name == "Publish immutable images") | .conclusion')" = success

gh api "repos/$repo" --jq '.default_branch'
git ls-remote --heads origin main develop
git status --short
printf 'final published image tag: sha-%s\n' "$final_main_sha"
```

Expected:

- The final main run and publish step succeed.
- The default branch remains `main`.
- Both long-lived branches exist.
- The worktree is clean.
- No production deployment command has been executed.

Do not create a direct commit after this point. Any follow-up change starts from `develop` on a new short-lived branch.
