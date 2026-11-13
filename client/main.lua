local resource = GetCurrentResourceName()
local tablet = Config.TabletResource
local appId = Config.App.identifier

-- ─── register the app on the tablet ───────────────────────────
-- NOTE: `ui` must be RELATIVE to this resource ("ui/index.html").
-- LB Tablet prefixes the resource itself; "gb-tablet/ui/index.html"
-- gets the prefix twice and the app opens as a blank page.

local registered = false

-- ─── block movement while typing in the app ──────────────────
local inputLocked = false

function SetInputLock(on)
    on = on == true
    if on == inputLocked then return end
    inputLocked = on
    if not on then return end
    CreateThread(function()
        while inputLocked do
            DisableAllControlActions(0)
            DisableAllControlActions(1)
            DisableAllControlActions(2)
            Wait(0)
        end
    end)
end

local function addApp()
    if registered or GetResourceState(tablet) ~= 'started' then return end

    -- clear a stale registration left from an earlier restart
    pcall(function() exports[tablet]:RemoveCustomApp(appId) end)
    Wait(100)

    local ok, added, reason = pcall(function()
        return exports[tablet]:AddCustomApp({
            identifier  = appId,
            name        = Config.App.name,
            description = Config.App.description,
            developer   = Config.App.developer,
            defaultApp  = Config.App.defaultApp ~= false,
            removable   = Config.App.removable == true,
            size        = Config.App.size or 256,
            icon        = Config.App.icon or ('https://cfx-nui-%s/ui/icon.svg'):format(resource),
            ui          = 'ui/index.html',
            onOpen = function()
                exports[tablet]:SendCustomAppMessage(appId, 'opened', {})
            end,
            onClose = function()
                SetInputLock(false)
                pcall(function() exports[tablet]:SendCustomAppMessage(appId, 'closed', {}) end)
            end,
        })
    end)

    if ok and added ~= false then
        registered = true
        print(('^2[gb-tablet]^7 LB Tablet app registered (%s)'):format(appId))
    else
        print(('^1[gb-tablet]^7 Could not add app: %s'):format(tostring(reason or added)))
    end
end

CreateThread(function()
    while GetResourceState(tablet) ~= 'started' do Wait(500) end
    Wait(750)
    addApp()
end)

-- re-register if lb-tablet restarts while we stay up
AddEventHandler('onClientResourceStart', function(res)
    if res ~= tablet then return end
    registered = false
    CreateThread(function() Wait(750) addApp() end)
end)

AddEventHandler('onResourceStop', function(res)
    if res == resource and GetResourceState(tablet) == 'started' then
        pcall(function() exports[tablet]:RemoveCustomApp(appId) end)
    end
end)

-- ─── UI -> server RPC ─────────────────────────────────────────

local pending, nextId = {}, 0

RegisterNetEvent('gb-tablet:rpc', function(reqId, res)
    local cb = pending[reqId]
    if cb then pending[reqId] = nil cb(res) end
end)

local CALLS = {
    'init', 'templates', 'startApply', 'myApps', 'withdraw', 'inbox', 'clearInbox',
    'staffList', 'staffGet', 'staffAction',
    'adminMembers', 'adminMemberAdd', 'adminMemberRole', 'adminMemberRemove',
    'adminRoles', 'adminRoleGet', 'adminRoleSave', 'adminRoleDelete',
    'adminExams', 'adminExamAttempts', 'adminAttempt', 'adminCerts', 'adminCertRevoke',
}

-- ─── full-screen apply form ──────────────────────────────────
-- The Guildbase form opens in this resource's own NUI page instead of
-- inside the tablet's app frame (nested frames can render blank in CEF).

local overlayOpen, overlayShown = false, false

local function releaseFocus()
    overlayOpen = false
    SetNuiFocus(false, false)
end

local function reopenTablet(event, payload)
    SetTimeout(200, function()
        pcall(function() exports[tablet]:ToggleOpen(true) end)
        SetTimeout(700, function()
            pcall(function() exports[tablet]:SendCustomAppMessage(appId, event, payload or {}) end)
        end)
    end)
end

local function openOverlay(res, name)
    overlayOpen, overlayShown = true, false
    pcall(function() exports[tablet]:ToggleOpen(false) end)
    Wait(300)
    SendNUIMessage({ action = 'gb:openApply', url = res.data.embed_url, name = name, expires_at = res.data.expires_at })

    -- Only take focus once the overlay page confirms it is on screen.
    local waited = 0
    while not overlayShown and waited < 2000 do Wait(50) waited = waited + 50 end

    if overlayShown then
        SetNuiFocus(true, true)
        return
    end

    -- Overlay page didn't answer (usually: resource was not fully restarted after
    -- updating, so ui/overlay.html isn't loaded). Give control back and explain.
    print('^1[gb-tablet] Full-screen apply page did not respond. Run "restart gb-tablet" (not ensure) after updating.^0')
    releaseFocus()
    reopenTablet('applyFallback', {})
end

-- 'browser' mode: open the session link in the player's real web browser.
-- (Guildbase's "frame-ancestors *" header blocks the form inside any NUI frame,
--  because NUI pages live under nui://, which "*" does not match.)
local urlOpened

local function openInBrowser(res, name)
    urlOpened = nil
    SendNUIMessage({ action = 'gb:openUrl', url = res.data.embed_url })
    local waited = 0
    while urlOpened == nil and waited < 2000 do Wait(50) waited = waited + 50 end
    local msg = urlOpened and ('%s opened in your web browser. Alt-Tab to fill it in.'):format(name or 'Application')
        or 'Could not open your browser. Ask staff to run "restart gb-tablet".'
    Config.Notify(Config.App.name, msg)
    pcall(function() exports[tablet]:SendCustomAppMessage(appId, 'browserOpened', { ok = urlOpened == true, message = msg }) end)
end

RegisterNUICallback('urlOpened', function(data, cb)
    urlOpened = data and data.ok == true
    cb('ok')
end)

RegisterNUICallback('inputLock', function(data, cb)
    SetInputLock(data and data.lock == true)
    cb({ ok = true })
end)

RegisterNUICallback('overlayShown', function(_, cb)
    overlayShown = true
    cb('ok')
end)

RegisterNUICallback('overlayClosed', function(data, cb)
    cb('ok')
    if not overlayOpen then return end
    releaseFocus()
    if Config.Apply.reopenTablet then
        reopenTablet('applyClosed', { submitted = data and data.submitted })
    end
end)

-- Emergency release if anything ever leaves the mouse stuck
RegisterCommand('gbunstuck', function()
    SendNUIMessage({ action = 'gb:closeApply' })
    releaseFocus()
end, false)

AddEventHandler('onResourceStop', function(res)
    if res == resource and overlayOpen then SetNuiFocus(false, false) end
end)

-- Failsafe: drop the lock if the tablet is no longer open
CreateThread(function()
    while true do
        Wait(1000)
        if inputLocked then
            local ok, open = pcall(function() return exports[tablet]:IsOpen() end)
            if ok and open == false then SetInputLock(false) end
        end
    end
end)

for _, name in ipairs(CALLS) do
    RegisterNUICallback(name, function(data, cb)
        nextId = nextId + 1
        local id = nextId
        if name == 'startApply' and (Config.Apply.mode == 'overlay' or Config.Apply.mode == 'browser') then
            local realCb = cb
            cb = function(res)
                if type(res) == 'table' and res.ok and res.data and res.data.embed_url then
                    res.data.overlay = true
                    realCb(res)
                    local nm = data and data.name
                    if Config.Apply.mode == 'browser' then
                        CreateThread(function() openInBrowser(res, nm) end)
                    else
                        CreateThread(function() openOverlay(res, nm) end)
                    end
                else
                    realCb(res)
                end
            end
        end
        pending[id] = cb
        TriggerServerEvent('gb-tablet:rpc', id, name, data)

        SetTimeout(20000, function()
            if pending[id] then
                pending[id] = nil
                cb({ ok = false, error = 'timeout', message = 'Guildbase took too long to respond.' })
            end
        end)
    end)
end

-- ─── mail notifications ───────────────────────────────────────

RegisterNetEvent('gb-tablet:mail', function(count, subject)
    if Config.Mail.notify then
        Config.Notify(Config.App.name, count > 1 and ('%d new application updates'):format(count) or (subject or 'New application update'))
    end
    pcall(function() exports[tablet]:SendCustomAppMessage(appId, 'mail', { count = count }) end)
end)
