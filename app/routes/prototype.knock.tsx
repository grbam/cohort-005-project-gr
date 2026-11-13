// PROTOTYPE, throwaway. "Does Knock hold up against Cadence?"
// Checks Knock's fit, not how the Notification Feed should look.
// Open /prototype/knock and switch users in the DevUI panel.
import { useCallback, useEffect, useState } from "react";
import { Form, useNavigation } from "react-router";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock";
import { db } from "~/db";
import { UserRole, comments, courses, lessons, users } from "~/db/schema";
import { requireUserId } from "~/lib/access.server";
import {
  knock,
  knockPublicConfig,
  knockUserId,
  signFeedToken,
} from "~/lib/prototype-knock.server";

const API = "https://api.knock.app/v1";

function getUser(id: number) {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .get();
}

// Minimal data to Knock: id + name only.
const recipient = (u: { id: number; name: string }) => ({
  id: knockUserId(u.id),
  name: u.name,
});

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const me = getUser(userId)!;
  await knock.users.update(knockUserId(me.id), { name: me.name });

  const questions = db
    .select({
      id: comments.id,
      body: comments.body,
      authorId: users.id,
      authorName: users.name,
      lessonTitle: lessons.title,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .innerJoin(lessons, eq(comments.lessonId, lessons.id))
    .where(
      and(
        isNull(comments.parentId),
        isNull(comments.deletedAt),
        ne(comments.userId, userId)
      )
    )
    .limit(5)
    .all();

  const otherUser = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(ne(users.id, userId))
    .get();

  const prefs = await knock.users
    .getPreferences(knockUserId(me.id), "default")
    .catch((e: Error) => ({ error: e.message }));

  return {
    me,
    token: await signFeedToken(me.id),
    knockId: knockUserId(me.id),
    otherKnockId: otherUser ? knockUserId(otherUser.id) : null,
    questions: questions.map((q) => ({ ...q, body: q.body.slice(0, 80) })),
    prefs,
    ...knockPublicConfig(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const me = getUser(userId)!;
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "trigger-reply") {
    // Discussion Reply -> question author. Actor is the DevUI user.
    const q = db
      .select({
        id: comments.id,
        lessonId: comments.lessonId,
        authorId: comments.userId,
      })
      .from(comments)
      .where(eq(comments.id, Number(form.get("questionId"))))
      .get()!;
    const author = getUser(q.authorId)!;
    const res = await knock.workflows.trigger("discussion-reply", {
      recipients: [recipient(author)],
      actor: recipient(me),
      data: {
        question_id: q.id,
        excerpt: "(prototype reply)",
        url: `/lessons/${q.lessonId}#comment-${q.id}`,
      },
    });
    return { intent, recipient: author.name, ...res };
  }

  if (intent === "trigger-enrollment") {
    // New Enrollment -> current user acting as the Instructor.
    const student = db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, UserRole.Student), ne(users.id, userId)))
      .get()!;
    const course = db.select({ title: courses.title }).from(courses).get()!;
    const res = await knock.workflows.trigger("new-enrollment", {
      recipients: [recipient(me)],
      actor: recipient(student),
      data: { course_title: course.title, url: "/instructor" },
    });
    return { intent, recipient: me.name, ...res };
  }

  if (intent === "set-enrollment-pref") {
    const on = form.get("value") === "on";
    const res = await knock.users.setPreferences(knockUserId(me.id), "default", {
      workflows: { "new-enrollment": on },
      __persistence_strategy__: "merge",
    } as any);
    return { intent, set: on, prefs: res };
  }

  return { intent, error: "unknown intent" };
}

type Feed = {
  status: number;
  entries?: any[];
  meta?: Record<string, number>;
  error?: unknown;
};

export default function PrototypeKnock({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { me, token, knockId, otherKnockId, publicKey, feedChannelId } =
    loaderData;
  const nav = useNavigation();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [crossCheck, setCrossCheck] = useState<unknown>(null);
  const [lastCall, setLastCall] = useState<unknown>(null);

  // Everything below runs in the browser with only the public key + user token.
  const headers = {
    Authorization: `Bearer ${publicKey}`,
    "X-Knock-User-Token": token,
    "Content-Type": "application/json",
  };

  const loadFeed = useCallback(async () => {
    const res = await fetch(
      `${API}/users/${knockId}/feeds/${feedChannelId}?page_size=20`,
      { headers }
    );
    const json = await res.json();
    setFeed(
      res.ok
        ? { status: res.status, entries: json.entries, meta: json.meta }
        : { status: res.status, error: json }
    );
  }, [knockId, token]);

  useEffect(() => {
    setFeed(null);
    loadFeed();
    const t = setInterval(loadFeed, 3000);
    return () => clearInterval(t);
  }, [loadFeed]);

  async function mark(status: "seen" | "read", ids: string[]) {
    const res = await fetch(`${API}/messages/batch/${status}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message_ids: ids }),
    });
    setLastCall({ call: `batch/${status}`, ids: ids.length, status: res.status });
    loadFeed();
  }

  async function readOtherUsersFeed() {
    const res = await fetch(
      `${API}/users/${otherKnockId}/feeds/${feedChannelId}`,
      { headers }
    );
    setCrossCheck({
      tried: `feed of Knock user ${otherKnockId} with ${me.name}'s token`,
      status: res.status,
      body: await res.json().catch(() => null),
    });
  }

  const ids = feed?.entries?.map((e) => e.id) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 font-mono text-sm">
      <p className="rounded bg-yellow-100 p-2 text-yellow-900">
        PROTOTYPE: Knock fit check. Switch users in the DevUI panel.
      </p>

      <section>
        <h2 className="font-bold">1. Signed user token</h2>
        <p>
          DevUI user: {me.name} ({me.role}), Knock id {knockId}
        </p>
        <p>token sub: {decodeSub(token)}</p>
        <button className="underline" onClick={readOtherUsersFeed}>
          Try to read another user's feed with this token
        </button>
        {crossCheck ? <pre>{JSON.stringify(crossCheck, null, 2)}</pre> : null}
      </section>

      <section>
        <h2 className="font-bold">2. Trigger Discussion Reply (as {me.name})</h2>
        <p>Goes to the question's author. Switch to them to see it arrive.</p>
        {loaderData.questions.map((q) => (
          <Form method="post" key={q.id} className="flex gap-2">
            <input type="hidden" name="intent" value="trigger-reply" />
            <input type="hidden" name="questionId" value={q.id} />
            <button className="underline" disabled={nav.state !== "idle"}>
              Reply
            </button>
            <span>
              → {q.authorName} (Knock id {q.authorId}): "{q.body}" on{" "}
              {q.lessonTitle}
            </span>
          </Form>
        ))}
      </section>

      <section>
        <h2 className="font-bold">4. New Enrollment, off by default</h2>
        <div className="flex gap-4">
          <Form method="post">
            <input type="hidden" name="intent" value="trigger-enrollment" />
            <button className="underline">Trigger New Enrollment to me</button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="set-enrollment-pref" />
            <input type="hidden" name="value" value="on" />
            <button className="underline">Opt in</button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="set-enrollment-pref" />
            <input type="hidden" name="value" value="off" />
            <button className="underline">Opt out</button>
          </Form>
        </div>
        <p>My preferences (server, secret key):</p>
        <pre>{JSON.stringify(loaderData.prefs, null, 2)}</pre>
      </section>

      {actionData ? (
        <section>
          <h2 className="font-bold">Last server action</h2>
          <pre>{JSON.stringify(actionData, null, 2)}</pre>
        </section>
      ) : null}

      <section>
        <h2 className="font-bold">3. Headless feed (browser, public key + token)</h2>
        <div className="flex gap-4">
          <button className="underline" onClick={loadFeed}>
            Refresh
          </button>
          <button className="underline" onClick={() => mark("seen", ids)}>
            Mark all seen
          </button>
          <button className="underline" onClick={() => mark("read", ids)}>
            Mark all read
          </button>
        </div>
        {lastCall ? <pre>{JSON.stringify(lastCall)}</pre> : null}
        <p>
          HTTP {feed?.status ?? "…"} · meta {JSON.stringify(feed?.meta)}
        </p>
        {feed?.error ? <pre>{JSON.stringify(feed.error, null, 2)}</pre> : null}
        <ul className="space-y-2">
          {feed?.entries?.map((e) => (
            <li key={e.id} className="rounded border p-2">
              <div>
                [{e.source?.key}] {e.blocks?.[0]?.rendered?.replace(/<[^>]+>/g, "")}
              </div>
              <div>
                seen_at={String(e.seen_at)} read_at={String(e.read_at)}
              </div>
              <button className="underline" onClick={() => mark("seen", [e.id])}>
                seen
              </button>{" "}
              <button className="underline" onClick={() => mark("read", [e.id])}>
                read
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function decodeSub(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub;
  } catch {
    return "?";
  }
}
