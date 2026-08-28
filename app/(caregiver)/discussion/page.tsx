import { DiscussionBoard } from "@/components/discussion/discussion-board";
import { getPosts, getViewer } from "@/lib/data";

// Discussion | Part 3.4. Server component reads the fixture data once; all
// interactivity — composing, replying, drafts — lives in the client board.
export default function DiscussionPage() {
  const viewer = getViewer();
  const posts = getPosts(viewer.cohortId);

  return <DiscussionBoard cohortId={viewer.cohortId} viewer={viewer} initialPosts={posts} />;
}
