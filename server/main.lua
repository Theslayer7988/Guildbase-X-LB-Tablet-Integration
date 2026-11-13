local Handlers = {}

-- ─── helpers ──────────────────────────────────────────────────

local function getDiscordId(src)
    if Config.DiscordSource == 'custom' then
        local e = Config.CustomDiscordExport
        local ok, id = pcall(function() local res = exports[e.resource]; return res[e.export](res, src) end)
        if ok and id then
            id = tostring(id):gsub('^discord:', '')
            if id:match('^%d+$') then return id end
        end
    end
    local id = GetPlayerIdentifierByType(src, 'discord')
    if not id then return nil end
    return (id:gsub('^discord:', ''))
end

local function isSafeId(id)
    return type(id) == 'string' and #id <= 64 and id:match('^[%w%-]+$') ~= nil
end

local function intId(v)
    local n = tonumber(v)
    if n and n > 0 and n == math.floor(n) then return math.floor(n) end
end

local function fail(message, code)
    return { ok = false, error = code or 'error', message = message }
end

local function str(v, max)
    if type(v) ~= 'string' then return nil end
    v = v:gsub('^%s+', ''):gsub('%s+$', '')
    if v == '' then return nil end
    return max and v:sub(1, max) or v
end

local function page(v) return intId(v) or 1 end

local function allowedSlug(slug)
    if #Config.AllowedTemplates == 0 then return true end
    for _, s in ipairs(Config.AllowedTemplates) do
        if s == slug then return true end
    end
    return false
end

local function audit(src, discordId, what)
    if Config.Admin.logActions then
        print(('^5[gb-tablet audit]^7 %s (%s / discord %s): %s'):format(GetPlayerName(src) or '?', src, discordId, what))
    end
end

local function resolveStaff(discordId, force)
    if not Config.EnableStaffReview then return nil end
    if force then GB.Bust('staff:' .. discordId) end
    local res = GB.Cached('staff:' .. discordId, Config.Cache.staff, function()
        return GB.Request('GET', '/staff/resolve', nil, { discord_id = discordId })
    end)
    return res and res.ok and res.data or nil
end

-- Admin tabs (members, roles, exams, certificates) act with the API key's
-- scopes, not a staff member's own Guildbase role, so they are gated here.
local function isAdmin(discordId)
    for _, id in ipairs(Config.Admin.discordIds) do
        if tostring(id) == discordId then return true end
    end
    local perm = Config.Admin.staffPermission
    if perm then
        local staff = resolveStaff(discordId)
        if staff and type(staff.permissions) == 'table' and staff.permissions[perm] == true then return true end
    end
    return false
end

local function getGuild()
    return GB.Cached('guild', Config.Cache.templates, function()
        return GB.Request('GET', '/guild')
    end)
end

-- ─── mail inbox (persisted in resource KVP) ───────────────────

local function inboxKey(discordId) return 'gb_inbox_' .. discordId end

local function loadInbox(discordId)
    local raw = GetResourceKvpString(inboxKey(discordId))
    if not raw then return {} end
    local ok, list = pcall(json.decode, raw)
    return ok and type(list) == 'table' and list or {}
end

local function saveInbox(discordId, list)
    while #list > Config.Mail.keepPerUser do table.remove(list) end
    SetResourceKvp(inboxKey(discordId), json.encode(list))
end

-- ─── everyone ─────────────────────────────────────────────────

function Handlers.init(src, discordId, data)
    local staff = resolveStaff(discordId, data.force)
    local inbox = loadInbox(discordId)
    local unread = 0
    for _, m in ipairs(inbox) do if not m.read then unread = unread + 1 end end

    local guild = getGuild()

    return {
        ok = true,
        data = {
            community = Config.CommunityName,
            playerName = GetPlayerName(src),
            discordId = discordId,
            unread = unread,
            guild = guild and guild.ok and guild.data or nil,
            isAdmin = isAdmin(discordId),
            showRisk = Config.ShowRisk ~= false,
            staff = staff and {
                guild = staff.guild,
                staff = staff.staff,
                permissions = staff.permissions,
                counts = staff.counts,
                templates = staff.templates,
            } or nil,
        },
    }
end

function Handlers.templates()
    local res = GB.Cached('templates', Config.Cache.templates, function()
        return GB.Request('GET', '/templates', nil, { is_active = true, per_page = 100 })
    end)
    if not res.ok then return res end

    local out = {}
    for _, t in ipairs(res.data or {}) do
        if t.status == 'live' and allowedSlug(t.slug) then
            out[#out + 1] = {
                id = t.id, slug = t.slug, name = t.name, description = t.description,
                closes_at = t.closes_at, applications_count = t.applications_count,
                allow_multiple_submissions = t.allow_multiple_submissions,
            }
        end
    end
    return { ok = true, data = out }
end

function Handlers.startApply(_, discordId, data)
    local slug = str(data.slug, 120)
    if not slug or not allowedSlug(slug) then return fail('That application is not available.') end

    local res = GB.Request('POST', '/sessions', { template_slug = slug, discord_id = discordId })
    if not res.ok then return res end

    local d = res.data or {}
    local s = type(d.session) == 'table' and d.session or {}
    local url = d.embed_url or s.embed_url or d.url
    if type(url) ~= 'string' or not url:match('^https://') then
        print(('^1[gb-tablet] /sessions returned no embed_url: %s^0'):format(json.encode(d)))
        return fail('Guildbase did not return a form link. Check the server console.')
    end

    GB.Bust('myapps:' .. discordId)
    return { ok = true, data = { embed_url = url, expires_at = d.expires_at or s.expires_at, template = d.template or s.template } }
end

function Handlers.myApps(_, discordId, data)
    if data.refresh then GB.Bust('myapps:' .. discordId) end
    return GB.Cached('myapps:' .. discordId, Config.Cache.myApps, function()
        return GB.Request('GET', '/ingame/applications', nil, { discord_id = discordId })
    end)
end

function Handlers.withdraw(_, discordId, data)
    if not isSafeId(data.id) then return fail('Invalid application.') end
    local res = GB.Request('POST', ('/ingame/applications/%s/withdraw'):format(data.id), {
        discord_id = discordId, reason = str(data.reason, 1000),
    })
    GB.Bust('myapps:' .. discordId)
    return res
end

function Handlers.inbox(_, discordId, data)
    local list = loadInbox(discordId)
    if data.markRead then
        for _, m in ipairs(list) do m.read = true end
        saveInbox(discordId, list)
    end
    return { ok = true, data = list }
end

function Handlers.clearInbox(_, discordId)
    DeleteResourceKvp(inboxKey(discordId))
    return { ok = true, data = {} }
end

-- ─── staff review (Guildbase enforces each staff member's role) ─

local STAFF_ACTIONS = {
    approve = true, reject = true, move = true, advance = true, pushback = true,
    overturn = true, claim = true, unclaim = true, ['ai-check'] = true, delete = true,
}

local function requireStaff(discordId)
    if not resolveStaff(discordId) then return fail('You are not Guildbase staff for this community.', 'not_staff') end
end

function Handlers.staffList(_, discordId, data)
    local denied = requireStaff(discordId); if denied then return denied end
    local claimed = data.claimed
    if claimed ~= true and claimed ~= false then claimed = nil end
    return GB.Request('GET', '/staff/applications', nil, {
        discord_id  = discordId,
        status      = str(data.status, 20),
        template_id = intId(data.template_id),
        risk_level  = str(data.risk_level, 10),
        search      = str(data.search, 100),
        claimed     = claimed,
        sort        = str(data.sort, 20) or 'submitted_at',
        direction   = data.direction == 'asc' and 'asc' or 'desc',
        page        = page(data.page),
        per_page    = 25,
    })
end

function Handlers.staffGet(_, discordId, data)
    local denied = requireStaff(discordId); if denied then return denied end
    if not isSafeId(data.id) then return fail('Invalid application.') end
    return GB.Request('GET', ('/staff/applications/%s'):format(data.id), nil, { discord_id = discordId })
end

function Handlers.staffAction(src, discordId, data)
    local denied = requireStaff(discordId); if denied then return denied end
    if not isSafeId(data.id) then return fail('Invalid application.') end
    local action = data.action
    if not STAFF_ACTIONS[action] then return fail('Unknown action.') end

    local body = { discord_id = discordId }
    if action == 'reject' then
        body.reason = str(data.reason, 1000)
    elseif action == 'pushback' then
        body.reason = str(data.reason, 1000)
        if not body.reason or #body.reason < 10 then return fail('Push-back reason must be at least 10 characters.') end
    elseif action == 'move' or action == 'overturn' then
        body.stage_id = intId(data.stage_id)
        if not body.stage_id then return fail('Pick a stage.') end
        if action == 'move' then
            body.notes = str(data.notes, 1000)
        else
            body.reason = str(data.reason, 1000)
            if not body.reason then return fail('A reason is required to overturn a decision.') end
        end
    end

    local res
    if action == 'delete' then
        res = GB.Request('DELETE', ('/staff/applications/%s'):format(data.id), body)
    else
        res = GB.Request('POST', ('/staff/applications/%s/%s'):format(data.id, action), body)
    end
    if res.ok then
        resolveStaff(discordId, true)
        if action == 'delete' or action == 'overturn' then audit(src, discordId, ('%s application %s'):format(action, data.id)) end
    end
    return res
end

-- ─── admin: members / roles / exams / certificates ────────────

local function requireAdmin(discordId)
    if not isAdmin(discordId) then return fail('You do not have admin access in this app.', 'not_admin') end
end

local function hexColor(v)
    v = str(v, 7)
    if v and v:match('^#%x%x%x%x%x%x$') then return v end
end

function Handlers.adminMembers(_, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    return GB.Request('GET', '/members', nil, { role_id = intId(data.role_id), page = page(data.page), per_page = 50 })
end

function Handlers.adminMemberAdd(src, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local target = str(tostring(data.discord_id or ''), 20)
    if not target or not target:match('^%d+$') then return fail('Enter a numeric Discord ID.') end
    local res = GB.Request('POST', '/members', { discord_id = target, role_id = intId(data.role_id) })
    if res.ok then audit(src, discordId, 'added member ' .. target) end
    return res
end

function Handlers.adminMemberRole(src, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id); if not id then return fail('Invalid member.') end
    local roleId = intId(data.role_id)
    -- role_id must be sent as JSON null to clear it; json.encode drops nil keys
    local res = GB.Request('PATCH', ('/members/%d'):format(id), roleId and { role_id = roleId } or '{"role_id":null}')
    if res.ok then audit(src, discordId, ('set member %d role -> %s'):format(id, tostring(roleId))) end
    return res
end

function Handlers.adminMemberRemove(src, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id); if not id then return fail('Invalid member.') end
    local res = GB.Request('DELETE', ('/members/%d'):format(id))
    if res.ok then audit(src, discordId, ('removed member %d'):format(id)) end
    return res
end

function Handlers.adminRoles(_, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    return GB.Request('GET', '/roles', nil, { page = page(data.page), per_page = 100 })
end

function Handlers.adminRoleGet(_, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id); if not id then return fail('Invalid role.') end
    return GB.Request('GET', ('/roles/%d'):format(id))
end

function Handlers.adminRoleSave(src, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id)
    local body = {
        name = str(data.name, 50),
        color = hexColor(data.color),
        discord_role_id = str(data.discord_role_id and tostring(data.discord_role_id) or nil, 25),
    }
    if type(data.permissions) == 'table' then
        local perms = {}
        for _, p in ipairs(data.permissions) do
            local v = str(p, 64)
            if v then perms[#perms + 1] = v end
        end
        body.permissions = perms
    end
    if not id and (not body.name or not body.color) then return fail('Name and colour are required.') end

    local res = id and GB.Request('PATCH', ('/roles/%d'):format(id), body) or GB.Request('POST', '/roles', body)
    if res.ok then audit(src, discordId, (id and 'edited role %s' or 'created role %s'):format(body.name or id)) end
    return res
end

function Handlers.adminRoleDelete(src, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id); if not id then return fail('Invalid role.') end
    local res = GB.Request('DELETE', ('/roles/%d'):format(id))
    if res.ok then audit(src, discordId, ('deleted role %d'):format(id)) end
    return res
end

function Handlers.adminExams(_, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    return GB.Request('GET', '/exams', nil, { page = page(data.page), per_page = 50 })
end

function Handlers.adminExamAttempts(_, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id); if not id then return fail('Invalid exam.') end
    return GB.Request('GET', ('/exams/%d/attempts'):format(id), nil, { status = str(data.status, 20), page = page(data.page), per_page = 50 })
end

function Handlers.adminAttempt(_, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id); if not id then return fail('Invalid attempt.') end
    return GB.Request('GET', ('/attempts/%d'):format(id))
end

function Handlers.adminCerts(_, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local valid = data.valid
    if valid ~= true and valid ~= false then valid = nil end
    return GB.Request('GET', '/certificates', nil, {
        exam_template_id = intId(data.exam_template_id), valid = valid, page = page(data.page), per_page = 50,
    })
end

function Handlers.adminCertRevoke(src, discordId, data)
    local d = requireAdmin(discordId); if d then return d end
    local id = intId(data.id); if not id then return fail('Invalid certificate.') end
    local res = GB.Request('POST', ('/certificates/%d/revoke'):format(id), { reason = str(data.reason, 500) })
    if res.ok then audit(src, discordId, ('revoked certificate %d'):format(id)) end
    return res
end

-- ─── RPC bridge ───────────────────────────────────────────────

local recent = {}

RegisterNetEvent('gb-tablet:rpc', function(reqId, name, data)
    local src = source
    if type(reqId) ~= 'number' or type(name) ~= 'string' then return end

    -- per-player flood guard: 20 calls / 5s
    local now = GetGameTimer()
    local r = recent[src]
    if not r or now - r.t > 5000 then r = { t = now, n = 0 }; recent[src] = r end
    r.n = r.n + 1
    if r.n > 20 then
        return TriggerClientEvent('gb-tablet:rpc', src, reqId, fail('Slow down a little.', 'rate_limited'))
    end

    local handler = Handlers[name]
    if not handler then return TriggerClientEvent('gb-tablet:rpc', src, reqId, fail('Unknown request.')) end

    local discordId = getDiscordId(src)
    if not discordId then
        return TriggerClientEvent('gb-tablet:rpc', src, reqId, fail(
            'No Discord account linked. Open Discord before launching FiveM, then reconnect.', 'no_discord'))
    end

    CreateThread(function()
        local ok, res = pcall(handler, src, discordId, type(data) == 'table' and data or {})
        if not ok then
            print(('^1[gb-tablet] %s failed: %s^0'):format(name, res))
            res = fail('Something went wrong.')
        end
        TriggerClientEvent('gb-tablet:rpc', src, reqId, res)
    end)
end)

AddEventHandler('playerDropped', function() recent[source] = nil end)

-- ─── mail polling ─────────────────────────────────────────────

local function pollMail()
    local byDiscord, ids = {}, {}
    for _, src in ipairs(GetPlayers()) do
        local d = getDiscordId(tonumber(src))
        if d then
            if not byDiscord[d] then
                byDiscord[d] = {}
                if #ids < 256 then ids[#ids + 1] = d end
            end
            table.insert(byDiscord[d], tonumber(src))
        end
    end
    if #ids == 0 then return end

    local res = GB.Request('POST', '/ingame/mail', { discord_ids = ids })
    if not res.ok then
        if res.error ~= 'rate_limited' then print(('^3[gb-tablet] mail poll: %s^0'):format(res.message)) end
        return
    end

    local grouped = {}
    for _, m in ipairs(res.data and res.data.mail or {}) do
        local d = tostring(m.discord_id)
        grouped[d] = grouped[d] or {}
        table.insert(grouped[d], m)
    end

    for d, mails in pairs(grouped) do
        local list = loadInbox(d)
        for _, m in ipairs(mails) do
            table.insert(list, 1, {
                id = m.id, kind = m.kind, subject = m.subject, message = m.message,
                application_id = m.application_id, created_at = m.created_at, read = false,
            })
        end
        saveInbox(d, list)
        GB.Bust('myapps:' .. d)

        for _, src in ipairs(byDiscord[d] or {}) do
            TriggerClientEvent('gb-tablet:mail', src, #mails, mails[1].subject)
        end
    end
end

CreateThread(function()
    if not GB.HasKey() then
        print('^1[gb-tablet] guildbase_api_key convar is missing or invalid. Add  set guildbase_api_key "gb_live_..."  to server.cfg^0')
        return
    end

    local me = GB.Request('GET', '/me')
    if me.ok then
        print('^2[gb-tablet] Connected to Guildbase.^0')
    else
        print(('^1[gb-tablet] Guildbase key check failed: %s (%s)^0'):format(me.message, me.error))
    end

    if not Config.Mail.enabled then return end
    while true do
        Wait(Config.Mail.pollSeconds * 1000)
        pollMail()
    end
end)

-- ─── console helper: list template slugs ──────────────────────

RegisterCommand('gbtemplates', function(src)
    if src ~= 0 then return end
    local res = GB.Request('GET', '/templates', nil, { per_page = 100 })
    if not res.ok then return print('[gb-tablet] ' .. res.message) end
    for _, t in ipairs(res.data or {}) do
        print(('[gb-tablet] %-40s  %-8s  %s'):format(t.slug, t.status, t.name))
    end
end, true)
