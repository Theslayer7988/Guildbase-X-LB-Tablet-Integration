/*
 * Guildbase embed loader — same approach as Guildbase's official FiveM resource.
 *
 * Guildbase sends "frame-ancestors *", which never matches FiveM's nui:// root,
 * so <iframe src="https://guildbase.gg/..."> is blocked. Instead we fetch the
 * page, add <base href="https://guildbase.gg/">, render it with srcdoc, and
 * route link clicks / form submits back through fetch.
 */
window.GBEmbed = function (frame, opts = {}) {
    const BASE = 'https://guildbase.gg';
    let current = null;

    const injected = '<script>' +
        'document.addEventListener("keydown",function(e){if(e.key==="Escape"||e.keyCode===27){e.preventDefault();parent.postMessage({type:"guildbase",action:"close"},"*");}});' +
        'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");' +
        'if(a&&a.href&&!a.href.startsWith("javascript:")&&a.getAttribute("href")!=="#"&&!a.hasAttribute("download")){e.preventDefault();parent.postMessage({type:"guildbase",action:"navigate",url:a.href},"*");}});' +
        'document.addEventListener("submit",function(e){var f=e.target;e.preventDefault();var fd=new FormData(f);var d={};' +
        'fd.forEach(function(v,k){if(typeof v!=="string")return;if(k in d){if(!Array.isArray(d[k]))d[k]=[d[k]];d[k].push(v);}else d[k]=v;});' +
        'parent.postMessage({type:"guildbase",action:"formSubmit",url:f.action||location.href,method:(f.getAttribute("method")||"GET").toUpperCase(),data:d},"*");});' +
        '<\/script>';

    function inject(html) {
        const base = `<base href="${BASE}/">`;
        if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + base);
        else html = base + html;
        if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, injected + '</body>');
        else html += injected;
        return html;
    }

    function show(html) {
        frame.srcdoc = inject(html);
    }

    function fail(err) {
        console.error('[gb-tablet] Guildbase form failed to load:', err);
        opts.onError?.(err);
    }

    function load(url) {
        current = url;
        opts.onLoading?.();
        return fetch(url, { credentials: 'include' })
            .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(show)
            .catch(fail);
    }

    function encode(data) {
        const p = new URLSearchParams();
        Object.entries(data || {}).forEach(([k, v]) => (Array.isArray(v) ? v.forEach((x) => p.append(k, x)) : p.append(k, v)));
        return p;
    }

    function submit(d) {
        let url = d.url || current;
        if (!url) return;
        if (d.method === 'GET') {
            const q = encode(d.data).toString();
            if (q) url += (url.includes('?') ? '&' : '?') + q;
            return load(url);
        }
        opts.onLoading?.();
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: encode(d.data).toString(),
            credentials: 'include',
        })
            .then((r) => (r.redirected ? fetch(r.url, { credentials: 'include' }).then((x) => x.text()) : r.text()))
            .then((html) => {
                show(html);
                if (/submitted|thank you|application received/i.test(html.replace(/<[^>]+>/g, ' ').slice(0, 20000))) opts.onMaybeSubmitted?.();
            })
            .catch(fail);
    }

    function onMessage(e) {
        const d = e.data;
        if (!d || d.type !== 'guildbase') return;
        if (e.source && e.source !== frame.contentWindow) return;
        switch (d.action) {
            case 'close': opts.onClose?.(false); break;
            case 'submitted': opts.onClose?.(true); break;
            case 'navigate': if (d.url) load(d.url); break;
            case 'formSubmit': submit(d); break;
        }
    }
    window.addEventListener('message', onMessage);

    frame.addEventListener('load', () => { if (frame.srcdoc) opts.onLoaded?.(); });

    return {
        load,
        reload: () => current && load(current),
        clear: () => { current = null; frame.removeAttribute('srcdoc'); frame.src = 'about:blank'; },
    };
};
