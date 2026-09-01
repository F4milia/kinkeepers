import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/data";
import { COPY } from "@/lib/copy";

// Discussion | Part 3.4.
//
// L5: no posts table exists anywhere in the real schema yet (confirmed
// with Ferenz before this session touched this screen - see this PR's
// description). The interactive board (DiscussionBoard) was fixture/
// local-state only from the start, by its own comment ("This build has
// no backend yet... added to local state"), so it never actually
// persisted anything - swapping it for an honest not-yet-available
// notice is more truthful than keeping a compose box that silently
// discards what someone types into it.
//
// L3: the group confidentiality commitment stays below, unchanged - "a
// quiet line... that links to the full agreement," so people remember
// making it, regardless of whether the board itself is live yet.
export default async function DiscussionPage() {
  await getViewer();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2">{COPY.discussion.title}</h1>
      <Card>
        <EmptyState headline={COPY.discussion.title} body={COPY.errors.discussion_not_yet_available} />
      </Card>
      <Link
        href="/consent#group_confidentiality"
        className="min-h-12 text-meta font-ui text-ink-soft underline underline-offset-2"
      >
        {COPY.consent.discussion_line}
      </Link>
    </div>
  );
}
