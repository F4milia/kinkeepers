"use client";

import { useRef, useState } from "react";
import { Composer } from "@/components/discussion/composer";
import { PostItem } from "@/components/discussion/post-item";
import { EmptyState } from "@/components/ui/empty-state";
import { COPY } from "@/lib/copy";
import type { CohortMember, Post, PostReply } from "@/lib/fixtures";

export interface DiscussionBoardProps {
  cohortId: string;
  viewer: CohortMember;
  initialPosts: Post[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Discussion | Part 3.4: composer, posts newest first, one level of reply
// indentation. This build has no backend yet — a posted note or reply is
// added to local state and its draft cleared, the same way it will once
// lib/data.ts talks to a real API.
export function DiscussionBoard({ cohortId, viewer, initialPosts }: DiscussionBoardProps) {
  const [posts, setPosts] = useState(initialPosts);
  const nextId = useRef(0);

  function handlePost(body: string) {
    nextId.current += 1;
    const post: Post = {
      id: `local-post-${nextId.current}`,
      cohortId,
      authorFirstName: viewer.firstName,
      authorRole: viewer.role,
      body,
      createdAt: todayISO(),
      replies: [],
    };
    setPosts((current) => [post, ...current]);
  }

  function handleReply(postId: string, body: string) {
    nextId.current += 1;
    const reply: PostReply = {
      id: `local-reply-${nextId.current}`,
      postId,
      authorFirstName: viewer.firstName,
      authorRole: viewer.role,
      body,
      createdAt: todayISO(),
    };
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, replies: [...post.replies, reply] } : post)),
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.discussion.title}</h1>

      <Composer
        draftKey={`kk-draft-post-${cohortId}`}
        label={COPY.discussion.compose_placeholder}
        submitLabel={COPY.discussion.post}
        onSubmit={handlePost}
      />

      {posts.length > 0 ? (
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <PostItem key={post.id} post={post} onReply={handleReply} />
          ))}
        </div>
      ) : (
        <EmptyState headline={COPY.discussion.title} body={COPY.discussion.empty} />
      )}
    </div>
  );
}
