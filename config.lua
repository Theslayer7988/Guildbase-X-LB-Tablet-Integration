Config = {}

-- ─────────────────────────────────────────────────────────────
--  API KEY
--  Do NOT put the key in this file (it is shared with clients).
--  Put this in server.cfg instead:
--      set guildbase_api_key "gb_live_xxxxxxxxxxxxxxxx"
--  Use `set`, NOT `setr` - `setr` sends the value to every player.
--
--  Key scopes needed (Guild Settings -> API Keys, Pro plan):
--      applications:read   (list templates for the Apply tab)
--      staff:review        (Review tab for your Guildbase staff)
-- ─────────────────────────────────────────────────────────────

Config.TabletResource = 'lb-tablet'

Config.App = {
    identifier  = 'guildbase',
    name        = 'Guildbase',
    description = 'Apply to departments, track your applications and review as staff.',
    developer   = 'Your Community',
    defaultApp  = true,   -- installed on every tablet without the app store
    removable   = false,  -- players can't uninstall it
    size        = 256,    -- "download size" shown in the tablet app store (KB)
    -- App icon: Guildbase's own hosted icon. Set to nil to use the bundled ui/icon.svg.
    icon        = 'https://guildbase.gg/assets/img/guildbase_icon_favicon_w.png',
}

-- Where to get the player's Discord ID (server side)
--   'fivem'  - FiveM's discord: identifier (Discord must be open when launching FiveM)
--   'custom' - an export from another resource that takes (source) and returns the ID
Config.DiscordSource = 'fivem'
Config.CustomDiscordExport = { resource = 'your_resource', export = 'GetPlayerDiscordId' }

-- Name shown in the app header
Config.CommunityName = 'Your Community'

-- Only show these template slugs in the Apply tab (empty = every live template).
-- Get slugs from Guildbase or /gbtemplates in the server console.
-- e.g. { 'lspd-application-a1b2c3', 'sasp-application-d4e5f6' }
Config.AllowedTemplates = {}

-- How the Apply form opens. All in-game modes load the form the same way Guildbase's
-- official FiveM resource does (fetch + inject), which avoids the frame-ancestors block.
--   'tablet'  - inside the tablet app (stays in the Guildbase app)
--   'overlay' - closes the tablet and shows the form in a large full-screen window
--   'browser' - opens the form in the player's real web browser
Config.Apply = {
    mode = 'tablet',
    reopenTablet = true,   -- reopen the tablet on My Applications after the form closes
}

-- Show the Risk column / risk badges in the review screens
Config.ShowRisk = true

-- Show the Review tab to Guildbase staff (needs the staff:review scope)
Config.EnableStaffReview = true

-- ADMIN TABS (Members, Roles, Exams, Certificates)
-- These act with the API key's own scopes, so Guildbase can't check who is
-- clicking. Only the people listed here (or staff holding `staffPermission`)
-- can see them. Key scopes needed: members:read/write, roles:read/write,
-- exams:read/write, guild:read.
Config.Admin = {
    discordIds = {
        -- '123456789012345678',
    },
    -- Also allow Guildbase staff whose role has this application permission.
    -- One of: view, manage, review, overturn, delete, analytics, claim, ai_check
    -- nil = only the Discord IDs above.
    staffPermission = nil,
    logActions = true,   -- print admin actions to the server console
}

-- Poll Guildbase for application emails (stage updates / receipts)
Config.Mail = {
    enabled      = true,
    pollSeconds  = 60,    -- one request covers every online player (max 256 per call)
    keepPerUser  = 50,    -- notices kept per Discord ID
    notify       = true,  -- in-game notification when a notice arrives
}

-- Cache lifetimes (seconds) - keeps you under Guildbase's 120 req/min limit
Config.Cache = {
    templates = 300,
    staff     = 60,
    myApps    = 20,
}

-- Notification used for new mail. Edit for your notify system.
-- Runs on the client.
Config.Notify = function(title, message)
    if GetResourceState('ox_lib') == 'started' then
        exports.ox_lib:notify({ title = title, description = message, type = 'inform', duration = 7000 })
    else
        TriggerEvent('chat:addMessage', { args = { title, message } })
    end
end
