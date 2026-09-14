#!/bin/sh
# Refuses an in-progress merge that would bring the holding-page branch into the app.
#
# Not a hook itself — the shared body of pre-merge-commit and pre-commit. Both are
# needed for one merge: git runs pre-merge-commit when a merge completes cleanly, but
# when it conflicts that hook is skipped and pre-commit runs on the separate commit
# instead. A merge of `landingpage` always conflicts, so pre-commit is in practice the
# one that fires and pre-merge-commit is the belt to its braces.
#
# `landingpage` serves the apex domain with the PLACER holding page while `main` serves
# the beta app. The divergence is the point: the branch is retired by deletion, never
# merged back. See the "Branches" section of README.md.

# Nothing to guard outside a merge, which is every ordinary commit — so leave first and
# cost them nothing.
merge_head="$(git rev-parse --verify --quiet MERGE_HEAD)" || exit 0

landingpage="$(git rev-parse --verify --quiet refs/heads/landingpage \
  || git rev-parse --verify --quiet refs/remotes/origin/landingpage)" || exit 0

# The holding page being reachable from what is being merged means the merge carries it,
# whether it was named on the command line or reached through a branch cut off it.
git merge-base --is-ancestor "$landingpage" "$merge_head" || exit 0

echo "refusing to merge the landingpage holding page." >&2
echo >&2
echo "  What you are merging contains every commit on landingpage. That branch serves" >&2
echo "  the apex domain and is retired by deletion, not by merging." >&2
echo >&2
echo "  Abandon this merge with:    git merge --abort" >&2
echo "  Move one change off it by:  git cherry-pick <sha>" >&2
exit 1
