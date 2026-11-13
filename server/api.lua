-- Thin wrapper around the Guildbase REST API (https://guildbase.gg/docs/api)
GB = {}

local BASE = 'https://guildbase.gg/api/v1'
local apiKey = GetConvar('guildbase_api_key', '')

-- Local limiter so one busy server can't burn the 120 req/min key limit
local WINDOW, LIMIT = 60, 110
local stamps = {}

local function allowRequest()
    local now = os.time()
    local i = 1
    while i <= #stamps do
        if now - stamps[i] >= WINDOW then table.remove(stamps, i) else i = i + 1 end
    end
    if #stamps >= LIMIT then return false end
    stamps[#stamps + 1] = now
    return true
end

local function urlencode(s)
    return (tostring(s):gsub('[^%w%-_%.~]', function(c) return ('%%%02X'):format(c:byte()) end))
end

local function buildQuery(q)
    if not q then return '' end
    local parts = {}
    for k, v in pairs(q) do
        if v ~= nil and v ~= '' then
            if type(v) == 'boolean' then v = v and '1' or '0' end
            parts[#parts + 1] = urlencode(k) .. '=' .. urlencode(v)
        end
    end
    return #parts > 0 and ('?' .. table.concat(parts, '&')) or ''
end

function GB.HasKey()
    return apiKey:sub(1, 8) == 'gb_live_'
end

--- @return table { ok, status, data, meta, error, message, raw }
function GB.Request(method, path, body, query)
    if not GB.HasKey() then
        return { ok = false, error = 'no_api_key', message = 'Guildbase API key is not configured on the server.' }
    end
    if not allowRequest() then
        return { ok = false, error = 'rate_limited', message = 'Guildbase is busy, try again in a moment.' }
    end

    local p = promise.new()
    PerformHttpRequest(BASE .. path .. buildQuery(query), function(status, text, _, errData)
        p:resolve({ status, text or errData })
    end, method, (type(body) == 'string' and body) or (body and json.encode(body)) or '', {
        ['Authorization'] = 'Bearer ' .. apiKey,
        ['Accept']        = 'application/json',
        ['Content-Type']  = 'application/json',
    })

    local res = Citizen.Await(p)
    local status, text = res[1], res[2]
    local decoded
    if text and text ~= '' then
        local okDecode, val = pcall(json.decode, text)
        decoded = okDecode and val or nil
    end

    if type(decoded) ~= 'table' then
        return { ok = false, status = status, error = 'bad_response', message = ('Guildbase returned HTTP %s'):format(status) }
    end

    if GetConvarInt('guildbase_debug', 0) == 1 then
        print(('[gb-tablet] %s %s -> %s %s'):format(method, path, status, text))
    end

    -- Some endpoints wrap results in `data`, some return fields at the top level.
    local is2xx = type(status) == 'number' and status >= 200 and status < 300
    if decoded.success or (is2xx and decoded.success == nil and not decoded.error) then
        local payload = decoded.data
        if payload == nil then
            payload = {}
            for k, v in pairs(decoded) do
                if k ~= 'success' and k ~= 'meta' then payload[k] = v end
            end
        end
        return { ok = true, status = status, data = payload, meta = decoded.meta }
    end

    return {
        ok = false, status = status,
        error = decoded.error or 'error',
        message = decoded.message or 'Request failed',
        errors = decoded.errors,
    }
end

-- Small TTL cache
local cache = {}
function GB.Cached(key, ttl, fn)
    local hit = cache[key]
    if hit and os.time() - hit.t < ttl then return hit.v end
    local v = fn()
    if v and v.ok then cache[key] = { t = os.time(), v = v } end
    return v
end

function GB.Bust(prefix)
    for k in pairs(cache) do
        if k:sub(1, #prefix) == prefix then cache[k] = nil end
    end
end
