# In-app notification services compared

Research for issue #2 (map #1: in-app Notifications in Cadence).
All sources checked on **2026-11-09**. Pricing pages and docs change; re-check before signing up. No accounts were created for this research.

## Question

Which third-party service should deliver Cadence's in-app Notifications? Criteria from the map:

- Free or low-cost tier that fits a prototype
- Ready-made React feed component or SDK, and how customisable it is
- DPA with EU data residency available (Notifications carry personal data, AVG applies)
- Ability to grow into email later

Also noted per candidate: how events are sent in, how a user's feed authenticates, real-time support, pricing at small scale.

## Summary table

| | Novu | Courier | Knock | MagicBell |
|---|---|---|---|---|
| Free tier | 10,000 workflow runs/mo, 20 workflows, 3 team members, 24h activity log [N1] | 10,000 sends/mo (Developer) [C1] | 10,000 messages/mo, no hard cap [K1] | 1,000 deliveries/mo, 1 project [M1] |
| Next tier | Pro from $30/mo, 30,000 runs, then $1.20 per 1,000 [N1] | Business, $0.005 per send pay-as-you-go [C1] | Starter $250/mo, 50,000 messages, then $0.005 each [K1] | Startup $249/mo, 50,000 deliveries, then $0.0025 each [M1] |
| React feed | `@novu/react` `<Inbox />`, Bell/Notifications parts, `appearance` API, headless hooks [N2][N3] | `@trycourier/courier-react` `<CourierInbox />`, theme object, custom views [C2] | `@knocklabs/react` feed popover, `renderItem`, CSS variables [K2] | `@magicbell/react` FloatingInbox/Inbox, `ItemComponent`, CSS variables [M2] |
| EU data residency | Yes, EU region in Frankfurt, listed on the Free plan [N1][N4] | Yes, EU datacenter, Business and Enterprise only (not Free) [C1][C3] | No. Docs say "expected by the end of 2026", "coming soon" [K3] | Not stated anywhere found [M3] |
| DPA | Yes, DPA and SCC template at novu.co/dpa, part of Terms of Use [N4][N5] | Yes, linked from Terms of Service, accepted with the Terms (per search summary, DPA text not read) [C4] | Yes, public DPA, Knock Labs Inc. (US); subprocessors all US [K4][K5] | "We provide data processing agreements" on trust page; text not found [M3] |
| Events in | `POST /v1/events/trigger` with workflow `name` and `to` subscriber [N6] | `POST /send` with `to.user_id`, template, `routing.channels: ["inbox"]` [C5] | Workflow trigger via API, also schedules, source events, audiences [K6] | REST API and "Broadcast" primitive [M4] |
| Feed auth | HMAC-SHA256(secret key, subscriberId) passed as `subscriberHash`; static, no expiry [N7] | Backend mints JWT via `/auth/issue-token` with scopes; optional expiry [C6] | RS256 JWT signed by backend ("enhanced security mode"), `sub` claim, exp default 1h in SDK [K7] | HS256 JWT signed with project secret key [M5] |
| Real-time | Yes, live unread count and sync; EU socket `wss://eu.socket.novu.co` [N3][N7] | Yes, "messages arrive in real time" [C2] | Yes, socket connection [K2][K7] | Not described on the pages read (unverified) [M2] |
| Email later | All channels incl. email on Free [N1] | Same send API, add `email` to routing [C2][C5] | All delivery channels on Free [K1] | Email channel via SES, Mailgun, SendGrid, SMTP [M4] |

## Per-candidate notes

### Novu

- **Tier fit**: Free plan gives 10,000 workflow runs a month, 20 workflows, Dev and Prod environments, 3 team members. Activity feed retention is only 24 hours on Free (7 days on Pro). Overage behaviour on Free is not stated on the pricing page (unverified). [N1]
- **React**: `@novu/react` provides `<Inbox />` built from `Bell`, `Notifications`, `InboxContent` and `Preferences`. Styling via an `appearance` prop (base theme, variables, per-element styles or Tailwind classes, icons). For full control the docs point to headless hooks in `@novu/react` or `@novu/js`. [N2][N3]
- **EU and DPA**: EU region in Frankfurt, chosen at account creation; API keys are bound to the region and moving region requires sales. SOC 2 Type II. DPA plus SCC template published; contracting entity Noti-Fire Apps Ltd. d/b/a Novu. The pricing page lists "US + EU data residency" on Free; it does not clearly restate it for Pro and Team, but those plans say "Everything in Free". Subprocessor list not found on the pages read. [N1][N4][N5]
- **Events in**: workflows are triggered with `POST /v1/events/trigger` (EU: `https://eu.api.novu.co`), required fields `name` and `to`. [N6]
- **Feed auth**: HMAC mode must be switched on in the In-App integration for production. Without it, a guessed `subscriberId` can read another user's feed. The hash does not expire, so revocation means rotating the secret key. [N7]
- **Self-hosting**: Enterprise lists self-hosted options. Not needed for this map.

### Courier

- **Tier fit**: Developer plan is free for 10,000 sends a month. Business is pay-as-you-go at $0.005 per send. [C1]
- **React**: `@trycourier/courier-react` (v9, React 18+). Older `@trycourier/react-inbox` packages are deprecated. Theming via `CourierInboxTheme`, own views on top of the SDK, or a fully custom UI on low-level APIs. [C2]
- **EU and DPA**: EU Data Residency is listed only on Business, not on the free Developer plan. Courier's own blog (last modified November 2026) says the EU datacenter is "available on every paid plan" with API base `https://api.eu.courier.com`; the same post places it in AWS eu-west-1 (Ireland), which is a vendor claim not checked against a trust page. The DPA is referenced from the Terms of Service; the DPA text itself was not read (unverified). Privacy policy cites the EU-U.S. Data Privacy Framework. [C1][C3][C4]
- **Implication for a prototype**: an EU-resident prototype needs the paid Business plan from day one. At prototype volumes the cost is small (1,000 sends is $5), but it is a paid account.
- **Feed auth**: backend calls Issue Token with a scope string such as `user_id:<id> inbox:read:messages inbox:write:events`. Omitting `expires_in` gives a token that never expires; SDKs do not refresh tokens. [C6]

### Knock

- **Tier fit**: Free plan, 10,000 messages a month, no hard cap. Knock branding stays on Free. The jump to Starter is $250/month. [K1]
- **React**: `@knocklabs/react` ships `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed`, `NotificationCell`; `renderItem` for custom cells; `--rnf-` CSS variables; dark mode; i18n. [K2]
- **EU and DPA**: Knock's plans documentation says "We expect to support EU data residency by the end of 2026" and labels it "coming soon". The DPA names Knock Labs, Inc. (New York) and the subprocessor list gives USA as the location for every subprocessor. Transfers rely on the EU-U.S. Data Privacy Framework. This fails the EU residency criterion today. [K3][K4][K5]
- **Feed auth**: a stricter model than the other three on paper. Enhanced security mode rejects client requests without an RS256 JWT signed by the backend; `sub` required, `exp` recommended; `onUserTokenExpiring` supports refresh. [K7]
- **Note**: by default "Knock feeds are accessible to anyone who has the feed ID" until enhanced security mode is on. [K2]

### MagicBell

- **Tier fit**: Builder plan is free but only 1,000 deliveries a month and 1 project. Startup is $249/month. [M1]
- **React**: `@magicbell/react` with `ContextProvider`, `FloatingInbox`, `Inbox`, `InlineNotification`, custom `ItemComponent`, CSS variables. Real-time delivery is not described on the library page (unverified). [M2]
- **EU and DPA**: trust page says GDPR compliant and "We provide data processing agreements", but names no hosting region, no EU residency and no SOC 2. No region information found on MagicBell's own pages. Treat EU residency as unavailable until MagicBell confirms otherwise. [M3]
- **Feed auth**: HS256 user JWT signed with the project secret key; `user_email` or `user_external_id` claim. [M5]

## Fit against the criteria

| Criterion | Novu | Courier | Knock | MagicBell |
|---|---|---|---|---|
| Free/low-cost tier for prototype | Meets | Meets (but EU needs paid plan) | Meets | Weak (1,000/mo) |
| React feed component | Meets | Meets | Meets | Meets |
| DPA with EU residency | Meets on Free | Meets on paid Business only | Fails today | Unverified, likely fails |
| Grow into email | Meets | Meets | Meets | Meets |

## Recommendation (proposal, for a human to confirm)

**Recommended: Novu.** It is the only candidate found that offers EU data residency (Frankfurt) on its free plan, with a published DPA/SCC template and SOC 2 Type II, plus a React `<Inbox />` with an `appearance` API and headless hooks, real-time updates, and email on the same workflow model. The Pro step is $30/month if the prototype outgrows the free tier.

Trade-offs to weigh: HMAC subscriber hashes do not expire (weaker than a short-lived JWT), the region is fixed at account creation, the free activity log keeps only 24 hours, and the subprocessor list was not found.

**Runner-up: Courier.** EU datacenter, DPA via its Terms, a current React Inbox SDK with scoped JWTs, and a single send API that already routes to email. The catch is that EU residency requires the paid Business plan (pay-as-you-go, $0.005 per send), so an EU-resident prototype is a paid account from the start.

Knock has a stricter feed auth model (short-lived RS256 JWTs) but does not offer EU residency today; revisit if its "end of 2026" EU launch happens. MagicBell is not recommended: small free tier and no stated EU residency.

## Open points to verify before a decision

- Novu: current subprocessor list (Trust Center or sales), and confirm EU residency stays available on Pro and Team.
- Courier: read the DPA text itself and the subprocessor list; confirm the EU datacenter location on a Courier trust or docs page.
- Knock: check whether EU residency has launched.
- Any sign-up needs the user's confirmation first, and trials use fake seed data only (map #1 notes).

## Sources

All checked 2026-11-09.

- [N1] Novu pricing: https://novu.co/pricing
- [N2] Novu Inbox React styling: https://docs.novu.co/platform/inbox/react/styling
- [N3] Novu Inbox React components: https://docs.novu.co/platform/inbox/react/components
- [N4] Novu security and compliance: https://docs.novu.co/platform/additional-resources/security
- [N5] Novu DPA: https://novu.co/dpa/
- [N6] Novu trigger event API: https://docs.novu.co/api-reference/events/trigger-event
- [N7] Novu Inbox prepare for production (HMAC, EU URLs): https://docs.novu.co/platform/inbox/prepare-for-production
- [C1] Courier pricing: https://www.courier.com/pricing
- [C2] Courier Inbox overview: https://www.courier.com/docs/platform/inbox/inbox-overview
- [C3] Courier blog, EU data residency for notifications (vendor-authored, modified Nov 2026): https://www.courier.com/blog/eu-data-residency-notifications
- [C4] Courier Terms / DPA reference: https://www.courier.com/dpa and privacy policy https://www.courier.com/privacy-policy (DPA text not read)
- [C5] Courier send to inbox: https://www.courier.com/docs/platform/inbox/sending-a-message
- [C6] Courier Inbox authentication: https://www.courier.com/docs/platform/inbox/authentication
- [K1] Knock pricing: https://knock.app/pricing
- [K2] Knock React feed: https://docs.knock.app/in-app-ui/react/feed
- [K3] Knock plans and usage (EU residency status): https://docs.knock.app/manage-your-account/knock-plans
- [K4] Knock DPA: https://knock.app/legal/data-processing-addendum
- [K5] Knock subprocessors: https://knock.app/legal/subprocessors
- [K6] Knock triggering workflows: https://docs.knock.app/send-notifications/triggering-workflows
- [K7] Knock in-app security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication
- [M1] MagicBell pricing: https://www.magicbell.com/pricing
- [M2] MagicBell React library: https://www.magicbell.com/docs/libraries/magicbell-react
- [M3] MagicBell security / trust: https://www.magicbell.com/security
- [M4] MagicBell docs index (channels, broadcast, API): https://www.magicbell.com/docs
- [M5] MagicBell user JWT: https://www.magicbell.com/docs/api/authentication/user
