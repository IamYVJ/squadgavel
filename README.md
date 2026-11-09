# Squadgavel 🔨🏏

A static, peer-to-peer cricket auction game for friends. One person hosts a room, everyone else joins with a 4-letter code, the host picks a player pool (India All-Time, SENA nations, World Greats, …), and everyone bids live. When the auction ends, an algorithm picks each squad's Best XI and crowns the champion.

- **No backend.** Connections are WebRTC via [PeerJS](https://peerjs.com) (public signalling server). The host's browser is the source of truth.
- **Host-authoritative.** Bids go to the host, which validates them and broadcasts state. If the host reloads, use "Resume your room" on the landing page; players auto-reconnect.
- **Pure static files** — `index.html`, `css/`, `js/`.

## How the team rating works

For each squad, every possible 11-player combination is scored and the best is kept:

- 50% **batting** (top 9 ratings, weighted by batting position) + 50% **bowling** (top 6 ratings, weighted)
- −4 with no specialist keeper; −3.5 per missing bowling option below 4
- +0.8 per all-rounder (max 3); chemistry bonus for 4+ players of one nation

The host picks a **format** (All-format, Test, ODI, T20). Each format re-rates every player (`js/formats.js`) and changes the batting/bowling weights used to score teams.

Player data lives in `js/players.js` (approximate, subjective ratings — edit freely). Base price is derived from overall rating.
