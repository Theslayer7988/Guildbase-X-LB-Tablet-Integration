# gb-tablet: Guildbase app for LB Tablet

This resource puts Guildbase on LB Tablet. It's styled after the guildbase.gg dashboard (Lexend font, neutral cards with the purple glow, stage-coloured badges, and the same application page layout) and covers everything Guildbase's public API can do.

| Section | Who sees it | What it does |
|---|---|---|
| **Dashboard** | Everyone | Guild info (members, Pro), open forms, your recent applications, unread mail and the staff queue counts |
| **Apply** | Everyone | Opens the real Guildbase form inside the tablet. No Discord login is needed in game. |
| **My Applications** | Everyone | Shows the status and stage of each application, and lets the player withdraw one |
| **Inbox** | Everyone | Guildbase "received" and stage-update emails, with an in-game notification when one arrives |
| **Review Queue** | Guildbase staff | Filter by status, form, risk or claimed, and search. Approve, reject, move to the next stage, move to any stage, push back, overturn, claim or unclaim, run the AI check, or delete. Guildbase checks each staff member's own role, and the buttons follow their permissions. |
| **Members** | Admins (see below) | Browse by role, add someone by Discord ID, change their role, or remove them |
| **Roles** | Admins | Create, edit (name, colour, linked Discord role, permissions) and delete roles |
| **Exams** | Admins | See every exam, then the attempts with score, grade, violations and manual-grading flags, then one attempt's detail |
| **Certificates** | Admins | Filter by exam or valid/revoked, and revoke a certificate |

### Not possible from the tablet
Guildbase's API doesn't offer these, so they stay on guildbase.gg: building or editing forms and exams, documents, support tickets, workflow and stage setup, guild settings, billing, and analytics.

## Setup
1. **Guildbase Pro** is required for API keys.
2. Go to **Guild Settings â†’ API Keys** and create a key with these scopes:
   - `applications:read` and `staff:review` for the applicant and staff sections
   - `guild:read`, `members:read`, `members:write`, `roles:read`, `roles:write`, `exams:read` and `exams:write` for the admin sections
3. Add these lines to `server.cfg` after `lb-tablet`:
   ```cfg
   set guildbase_api_key "gb_live_xxxxxxxxxxxxxxxx"
   ensure gb-tablet
   ```
   Use `set`, not `setr`. `setr` sends the key to every client.
4. **Choose your admins** in `config.lua`:
   ```lua
   Config.Admin = {
       discordIds = { '123456789012345678' },
       staffPermission = nil,   -- or e.g. 'manage' to also allow staff with that permission
   }
   ```
   The admin sections run with the API key's own permissions, so Guildbase can't tell who is clicking. This list is the only thing controlling who sees them. Every admin action is printed to the server console.
5. Optional: run `gbtemplates` in the server console to list your form slugs, then put the ones you want to show in `Config.AllowedTemplates`.

## Notes
- The API key never leaves the server. The UI calls Lua, and Lua calls Guildbase.
- Guildbase allows 120 requests per minute per key. The resource caches results and limits itself to 110 per minute. Mail is checked with one request for all online players every 60 seconds.
- Add `set guildbase_debug 1` to print every API request and reply to the console.
- **Apply form:** Guildbase sends `frame-ancestors *`, which blocks a plain iframe in FiveM because NUI lives under `nui://`. So the app loads the form the same way Guildbase's official FiveM resource does: it fetches the page, adds a `<base>` tag, shows it with `srcdoc`, and sends link clicks and submits back through `fetch`. `Config.Apply.mode` picks where the form appears: `'tablet'` (inside the app, the default), `'overlay'` (full-screen window) or `'browser'` (the player's real web browser).
- **Risk:** risk has its own column in the review table. Set `Config.ShowRisk = false` to hide risk everywhere. The AI check stays available.
- The Discord ID comes from FiveM's `discord:` identifier by default. Set `Config.DiscordSource = 'custom'` to use another resource's export instead.
- The theme follows the tablet's light/dark setting.
- To preview the UI in a browser, open `ui/index.html`. It loads sample data when it's not running in game.

