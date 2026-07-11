# private.md — MEGA TAG infrastructure notes

> ⚠️ **This repo is public** (it's a GitHub Pages site), so treat this file as
> documentation, not a vault. There are currently **zero secrets in here — and
> none must ever be added**. If you later create accounts/keys for a private
> broker, keep the credentials in a password manager and only note *where*
> they live here.

## What MEGA TAG uses today (no accounts, no credentials)

The multiplayer transport is **MQTT over WebSocket to free public brokers**.
No signup was needed; nothing was provisioned; there is nothing to leak.

| Purpose | Endpoint | Provider | Cost / account |
| --- | --- | --- | --- |
| Primary broker | `wss://broker.emqx.io:8084/mqtt` | EMQX public sandbox | free · none |
| Fallback 1 | `wss://broker.hivemq.com:8884/mqtt` | HiveMQ public sandbox | free · none |
| Fallback 2 | `wss://test.mosquitto.org:8081` | Eclipse Mosquitto test | free · none |

- The game tries them in order and reconnects with fallback rotation.
- If none are reachable, it drops into **OFFLINE mode** (AI bots only) and says so in the status pill.
- The MQTT client is hand-written inside `games/mega-tag.html` (MQTT 3.1.1, QoS 0, keepalive 60s) — no external libraries.

## Topic namespace

```
wizzed/megatag/v2/main/s/<playerId>   ← each client publishes its own state (~7 Hz JSON)
```

State payload: `{i, n, x, y, c, it, itS, ai, s}` — id, name, position, hue, is-IT flag,
IT-claim timestamp (latest claim wins), AI flag, score. Peers not heard from for 6s are pruned.
Bots are simulated by the **bot host** (the human with the lexicographically-lowest id)
and published with `ai: 1`, so every client agrees on who is a robot.

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
