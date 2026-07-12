# private.md — multiplayer infrastructure notes (MEGA TAG + the mp-* games)

> ⚠️ **This repo is public** (it's a GitHub Pages site), so treat this file as
> documentation, not a vault. There are currently **zero secrets in here — and
> none must ever be added**. If you later create accounts/keys for a private
> broker, keep the credentials in a password manager and only note *where*
> they live here.

## What the multiplayer games use today (no accounts, no credentials)

All seven massively-multiplayer games (`mega-tag`, `mp-draw`, `mp-clicker`,
`mp-plaza`, `mp-race`, `mp-snake`, `mp-quiz`) share the same transport:
**MQTT over WebSocket to free public brokers**.
No signup was needed; nothing was provisioned; there is nothing to leak.

| Purpose | Endpoint | Provider | Cost / account |
| --- | --- | --- | --- |
| Primary broker | `wss://broker.emqx.io:8084/mqtt` | EMQX public sandbox | free · none |
| Fallback 1 | `wss://broker.hivemq.com:8884/mqtt` | HiveMQ public sandbox | free · none |
| Fallback 2 | `wss://test.mosquitto.org:8081` | Eclipse Mosquitto test | free · none |

- Each game tries them in order and reconnects with fallback rotation.
- If none are reachable, it drops into **OFFLINE mode** (AI bots only) and says so in the status pill.
- The MQTT client is hand-written inside each game file (MQTT 3.1.1, QoS 0,
  keepalive, retain flag on state topics) — no external libraries.

## Topic namespace

```
wizzed/megatag/v2/main/s/<playerId>       ← MEGA TAG player state (~7 Hz JSON)
wizzed/<slug>/v1/main/p|s/<playerId>      ← other games' player state (~5.5 Hz JSON)
wizzed/<slug>/v1/main/seg/<playerId>      ← mp-draw stroke segments (events)
wizzed/<slug>/v1/main/say|emo/<playerId>  ← mp-plaza chat / emotes (events)
wizzed/<slug>/v1/main/state/<what>        ← RETAINED shared-state snapshots (see below)
```

Player state payloads carry id, name, position, AI flag, score etc. Peers not
heard from for 6s are pruned. Bots are simulated by the **bot host** (the human
with the lexicographically-lowest id) and published with `ai: 1`, so every
client agrees on who is a robot.

## Late-joiner sync (retained state snapshots)

Games with shared world state publish it as **MQTT retained messages** — the
broker stores the last message per topic and replays it to every new
subscriber, so someone joining later (even after everyone left) resumes from
the current state instead of a blank world. The bot host publishes these on a
short interval, only when the state changed:

| Topic (under `wizzed/<slug>/v1/main/`) | Game | Payload |
| --- | --- | --- |
| `state/canvas` | mp-draw | `{t:'snap', i, ts, d}` — downscaled PNG data-URL of the whole canvas (≤ ~110 KB, every 5s) |
| `state/total` | mp-clicker | `{t:'tot', i, tot, ts}` — all-time global click total (max-merge, every 2.5s) |
| `state/chat` | mp-plaza | `{t:'chat', i, hist, ts}` — last 8 chat lines (every 1.5s) |
| `state/food` | mp-snake | `{t:'food', i, fm, fe, ts}` — eaten pellet indices for the current food-minute (every 2s) |

mega-tag / mp-race / mp-quiz need no retained state: everything a late joiner
needs (who is IT, positions, scores, the wall-clock round/question index) is
re-derivable from the continuous ~5–7 Hz player publishes within ~200 ms.
mp-snake peers additionally piggy-back the pellets they personally ate
(`fm`/`fe`) on their regular state messages so live players converge too.

## Important caveats (public sandbox brokers)

- **Everything published is public.** Anyone can subscribe to the topic and see
  player names/positions. Never put personal data in names.
- No delivery guarantees, no persistence, occasional restarts, fair-use rate limits.
  Fine for a toy arena; not for anything that matters.
- "1,000,000 players" is the design ceiling of the sharding idea (rooms/topics),
  not a promise from a free sandbox broker. Practically expect dozens–hundreds.

## Upgrading to your own broker later (when you want reliability)

Any MQTT broker with WebSocket + TLS works. Two easy free tiers:

1. **EMQX Cloud Serverless** (emqx.com) — free tier, gives you
   `wss://<deployment>.emqxsl.com:8084/mqtt` + username/password auth.
2. **HiveMQ Cloud** (hivemq.com) — free tier, similar.

Steps:
- Create the deployment, note the `wss://` URL and credentials **in your password
  manager** (not in this repo).
- The game already supports an override without code changes:
  `games/mega-tag.html?broker=wss://your-broker-url`
- For a permanent switch, edit the `BROKERS` list at the top of the game's script
  (and add username/password support to the CONNECT packet — the flags byte
  becomes `0xC2` and the payload gains user/pass strings; ~5 lines).
- Self-host option: any `mosquitto` with `listener 8081` + `protocol websockets`
  behind TLS. A ~100-line reference WebSocket broker used for testing lives in
  the dev notes (mini-broker.js) if you ever want a tiny custom one.

## Local testing

Run any WS MQTT broker locally and open
`games/mega-tag.html?broker=ws://localhost:PORT` in two tabs — they will see
each other, and the AI bot host election/labels can be observed live.
