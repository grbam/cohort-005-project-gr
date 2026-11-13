// PROTOTYPE, throwaway. Part of "Does Knock hold up against Cadence?".
// Creates the two Knock workflows the prototype triggers, and makes
// new-enrollment off by default for everyone (Instructors opt in).
// Uses the Knock Management API, which needs KNOCK_SERVICE_TOKEN in .env.
// Run: npx tsx scripts/prototype-knock-setup.ts

export {};
process.loadEnvFile(".env");

const token = process.env.KNOCK_SERVICE_TOKEN;
const feedChannelId = process.env.KNOCK_FEED_CHANNEL_ID;
if (!token) throw new Error("Add KNOCK_SERVICE_TOKEN to .env first");

const ENV = "development";
const MAPI = "https://control.knock.app/v1";

async function mapi(method: string, path: string, body?: unknown) {
  const res = await fetch(`${MAPI}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

// 1. Find the in-app feed channel's key (workflow steps reference the key, not the id).
const channels = await mapi("GET", `/channels?environment=${ENV}`);
const list: any[] = channels.entries ?? channels;
const feed = list.find((c) => c.id === feedChannelId);
if (!feed) {
  console.log(list.map((c) => ({ id: c.id, key: c.key, type: c.type })));
  throw new Error("Feed channel from KNOCK_FEED_CHANNEL_ID not found");
}
console.log(`feed channel: key=${feed.key} type=${feed.type}`);

// 2. Upsert + commit the two catalogue workflows.
const workflows = [
  {
    key: "discussion-reply",
    name: "Discussion Reply",
    categories: ["discussions"],
    markdown_body:
      "**{{ actor.name }}** replied to your question: {{ data.excerpt }}",
  },
  {
    key: "new-enrollment",
    name: "New Enrollment",
    categories: ["enrollments"],
    markdown_body: "**{{ actor.name }}** enrolled in {{ data.course_title }}",
  },
];

// Categories must exist in the project's catalog (project-wide, not per environment).
for (const name of new Set(workflows.flatMap((wf) => wf.categories))) {
  await mapi("PUT", `/preference_categories/${name}`);
  console.log(`preference category: ${name}`);
}

for (const wf of workflows) {
  const res = await mapi(
    "PUT",
    `/workflows/${wf.key}?environment=${ENV}&commit=true&commit_message=prototype`,
    {
      workflow: {
        name: wf.name,
        categories: wf.categories,
        steps: [
          {
            type: "channel",
            ref: "in_app_feed_1",
            name: "In-app feed",
            channel_key: feed.key,
            template: {
              markdown_body: wf.markdown_body,
              action_url: "{{ data.url }}",
            },
          },
        ],
      },
    }
  );
  const w = res.workflow;
  console.log(
    `workflow ${w.key}: active=${w.active} valid=${w.valid} categories=${JSON.stringify(w.categories)}`
  );
}

// 3. Environment default preferences: new-enrollment off unless a user opts in.
const current = await mapi("GET", `/environments/${ENV}/defaults`);
console.log("defaults before:", JSON.stringify(current.preference_set));
const merged = {
  ...(current.preference_set ?? {}),
  workflows: {
    ...(current.preference_set?.workflows ?? {}),
    "new-enrollment": false,
  },
};
const after = await mapi("PUT", `/environments/${ENV}/defaults`, {
  preference_set: merged,
});
console.log("defaults after: ", JSON.stringify(after.preference_set));
