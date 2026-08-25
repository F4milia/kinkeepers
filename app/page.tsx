import Link from "next/link";
import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { COPY, format } from "@/lib/copy";
import { getPosts, getUpcomingSession, getViewer } from "@/lib/data";
import { formatRelativeDays, formatSessionDay } from "@/lib/format-date";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

// Home | Part 3.4: greeting + theme toggle, next-meeting card with one
// primary action, program position, up to two recent posts, quiet link to
// discussion. One primary action on this screen: the meeting action.
export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const initialTheme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  const viewer = getViewer();
  const upcomingSession = getUpcomingSession(viewer.cohortId);
  const recentPosts = getPosts(viewer.cohortId).slice(0, 2);

  return (
    <div className="flex flex-col gap-section">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h2">{format(COPY.home.greeting, { firstName: viewer.firstName })}</h1>
        <ThemeToggle initialTheme={initialTheme} />
      </div>

      {upcomingSession ? (
        <Card className="flex flex-col items-start gap-4">
          <Link href={`/session/${upcomingSession.id}`} className="-m-1 block rounded-control p-1 transition-colors hover:text-action">
            <p className="text-h2 font-heading">{formatSessionDay(upcomingSession.date)}</p>
            <p className="mt-1 text-body-lg font-ui text-ink-soft">
              {upcomingSession.time} {upcomingSession.timeZoneLabel}
            </p>
          </Link>

          <Badge variant="neutral">
            {upcomingSession.deliveryFormat === "video" ? COPY.session.location_video : COPY.session.location_person}
          </Badge>

          <Button variant="primary" className="w-full">
            {upcomingSession.deliveryFormat === "video" ? COPY.home.join_video : COPY.home.get_directions}
          </Button>

          <Button variant="quiet">{COPY.home.cant_attend}</Button>

          <p className="text-meta font-ui text-ink-soft">
            {format(COPY.home.progress, {
              n: upcomingSession.sessionNumber,
              total: upcomingSession.sessionTotal,
            })}
          </p>
        </Card>
      ) : (
        <Card>
          <EmptyState headline={COPY.home.next_meetup} body={COPY.home.empty_meetup} />
        </Card>
      )}

      <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
        <h2 id="recent-heading" className="text-h3">
          {COPY.home.recent}
        </h2>

        {recentPosts.length > 0 ? (
          <>
            <div className="flex flex-col gap-3">
              {recentPosts.map((post) => (
                <Card key={post.id} interactive href="/discussion">
                  <div className="flex items-center gap-3">
                    <Avatar name={post.authorFirstName} />
                    <div>
                      <p className="text-label font-ui text-ink">{post.authorFirstName}</p>
                      <p className="text-meta font-ui text-ink-soft">{formatRelativeDays(post.createdAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-body font-ui text-ink">{post.body}</p>
                  {post.replies.length > 0 && (
                    <p className="mt-2 text-meta font-ui text-ink-soft">
                      {post.replies.length === 1
                        ? COPY.discussion.replies_one
                        : format(COPY.discussion.replies_many, { n: post.replies.length })}
                    </p>
                  )}
                </Card>
              ))}
            </div>

            <Link
              href="/discussion"
              className="inline-flex min-h-12 w-fit items-center rounded-control px-4 text-label font-ui text-action hover:bg-action-dim active:bg-action-dim"
            >
              {COPY.home.view_all}
            </Link>
          </>
        ) : (
          <p className="text-body font-ui text-ink-soft">{COPY.home.empty_posts}</p>
        )}
      </section>
    </div>
  );
}
