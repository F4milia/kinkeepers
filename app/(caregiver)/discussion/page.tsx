import Link from "next/link";
import { DiscussionBoard } from "@/components/discussion/discussion-board";
import { getPosts, getViewer } from "@/lib/data";
import { COPY } from "@/lib/copy";

// Discussion | Part 3.4. Server component reads the fixture data once; all
// interactivity — composing, replying, drafts — lives in the client board.
//
// L3: the group confidentiality commitment, resurfaced - "a quiet line...
// that links to the full agreement," per the prompt, so people remember
// making it. Below the board, not above - it's a reminder, not a gate.
export default function DiscussionPage() {
  const viewer = getViewer();
  const posts = getPosts(viewer.cohortId);

  return (
    <div className="flex flex-col gap-4">
      <DiscussionBoard cohortId={viewer.cohortId} viewer={viewer} initialPosts={posts} />
      <Link
        href="/consent#group_confidentiality"
        className="min-h-12 text-meta font-ui text-ink-soft underline underline-offset-2"
      >
        {COPY.consent.discussion_line}
      </Link>
    </div>
  );
}
