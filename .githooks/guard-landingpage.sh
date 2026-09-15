#!/bin/sh
# Refuses an in-progress merge that would bring the holding-page branch into the app.
#
# Not a hook itself — the shared body of pre-merge-commit and pre-commit. Both are needed
# for one merge, because git splits the two cases:
#
#   clean merge     -> pre-merge-commit runs. There is no MERGE_HEAD yet; git names what
#                      is being merged in GITHEAD_<sha> environment variables instead.
#   conflicted merge -> pre-merge-commit is skipped entirely. The conflicts are resolved
#                      and committed separately, and pre-commit runs on that commit, by
#                      which point MERGE_HEAD does exist.
#
# A merge of `landingpage` always conflicts, so the second case is the one that fires in
# practice — but reading only one of the two sources would leave a silent hole, which is
# exactly the bug this script was first written with.
#
# `landingpage` serves the apex domain with the PLACER holding page while `main` serves
# the beta app. The divergence is the point: the branch is retired by deletion, never
# merged back. See the "Branches" section of README.md.

# Whatever is being merged, in either of the two forms git offers. Reading the file rather
# than rev-parsing it keeps octopus merges working, where it holds one sha per line.
merge_head_file="$(git rev-parse --git-dir)/MERGE_HEAD"
if [ -f "$merge_head_file" ]; then
  heads="$(cat "$merge_head_file")"
else
  heads="$(env | sed -n 's/^GITHEAD_\([0-9a-fA-F]\{40,64\}\)=.*/\1/p')"
fi

# No merge in progress, which is every ordinary commit — so leave, and cost it nothing.
[ -n "$heads" ] || exit 0

landingpage="$(git rev-parse --verify --quiet refs/heads/landingpage \
  || git rev-parse --verify --quiet refs/remotes/origin/landingpage)" || exit 0

for head in $heads; do
  # The holding page being reachable from what is being merged means the merge carries
  # it, whether it was named on the command line or reached through a branch cut off it.
  git merge-base --is-ancestor "$landingpage" "$head" 2>/dev/null || continue

  echo "refusing to merge the landingpage holding page." >&2
  echo >&2
  echo "  What you are merging contains every commit on landingpage. That branch serves" >&2
  echo "  the apex domain and is retired by deletion, not by merging." >&2
  echo >&2
  echo "  Abandon this merge with:    git merge --abort" >&2
  echo "  Move one change off it by:  git cherry-pick <sha>" >&2
  exit 1
done

exit 0
