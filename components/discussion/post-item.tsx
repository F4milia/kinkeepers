"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Composer } from "@/components/discussion/composer";
import { COPY, format } from "@/lib/copy";
import { formatRelativeDays } from "@/lib/format-date";
import type { MemberRole, Post } from "@/lib/fixtures";

export interface PostItemProps {
  post: Post;
  onReply: (postId: string, body: string) => void;
}

// PostItem | Part 3.4: avatar, first name, relative time, full body, reply
// count. Replies indent one level only — deeper nesting is unreadable at
// 18px on a phone — and the reply composer opens inline, not as a modal. No
// reactions, no likes, no counts beyond the reply count itself.
export function PostItem({ post, onReply }: PostItemProps) {
  const [replying, setReplying] = useState(false);

  return (
    <Card>
      <article className="flex flex-col gap-4">
        <PostHeader firstName={post.authorFirstName} role={post.authorRole} createdAt={post.createdAt} />
        <p className="whitespace-pre-wrap break-words text-body font-ui text-ink">{post.body}</p>

        {post.replies.length > 0 && (
          <ul className="flex flex-col gap-4 border-l border-line pl-4">
            {post.replies.map((reply) => (
              <li key={reply.id} className="flex flex-col gap-2">
                <PostHeader firstName={reply.authorFirstName} role={reply.authorRole} createdAt={reply.createdAt} />
                <p className="whitespace-pre-wrap break-words text-body font-ui text-ink">{reply.body}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {post.replies.length > 0 && (
            <p className="text-meta font-ui text-ink-soft">
              {post.replies.length === 1
                ? COPY.discussion.replies_one
                : format(COPY.discussion.replies_many, { n: post.replies.length })}
            </p>
          )}
          <Button variant="quiet" aria-expanded={replying} onClick={() => setReplying((current) => !current)}>
            {COPY.discussion.reply}
          </Button>
        </div>

        {replying && (
          <div className="border-l border-line pl-4">
            <Composer
              draftKey={`kk-draft-reply-${post.id}`}
              label={COPY.discussion.reply_placeholder}
              submitLabel={COPY.discussion.reply}
              submitVariant="secondary"
              autoFocus
              onSubmit={(body) => {
                onReply(post.id, body);
                setReplying(false);
              }}
            />
          </div>
        )}
      </article>
    </Card>
  );
}

function PostHeader({
  firstName,
  role,
  createdAt,
}: {
  firstName: string;
  role: MemberRole;
  createdAt: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar name={firstName} />
      <div className="flex flex-wrap items-center gap-2">
        <p className="break-words text-label font-ui text-ink">{firstName}</p>
        {role === "facilitator" && <Badge variant="neutral">{COPY.cohort.facilitator_label}</Badge>}
        <p className="text-meta font-ui text-ink-soft">{formatRelativeDays(createdAt)}</p>
      </div>
    </div>
  );
}
