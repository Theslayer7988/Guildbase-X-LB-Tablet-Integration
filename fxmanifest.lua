fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'gb-tablet'
description 'Guildbase app for LB Tablet - in-game applications, status, mail and staff review'
version '1.0.0'

shared_script 'config.lua'

client_script 'client/main.lua'

server_scripts {
    'server/api.lua',
    'server/main.lua',
}

ui_page 'ui/overlay.html'

files {
    'ui/index.html',
    'ui/overlay.html',
    'ui/embed.js',
    'ui/style.css',
    'ui/app.js',
    'ui/icon.svg',
}

dependency 'lb-tablet'
