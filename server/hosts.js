// Api/hosts.js — Lista blanca de hosts de reproducción.
//
// Seguridad: solo se permiten fuentes cuyo host coincida con esta lista.
// Cualquier iframe/URL que venga de un scraping y no esté acá se descarta,
// así el reproductor nunca muestra ventanas raras (ads, +18, minería...).
// Si algún hoster legítimo queda fuera, basta con agregarlo aquí.

// Sufijos de dominio permitidos (se matchea el hostname exacto o subdominio).
const ALLOWED = [
  // --- Agregadores y players propios de los sitios que scrapeamos ---
  'pelisplushd.bz',
  'embed69.org',
  'poseidonhd2.co',
  'player.poseidonhd2.co',

  // --- Hosters de video embebido (streaming) ---
  'streamwish.to',
  'streamwish.pro',
  'embedwish.com',
  'filemoon.sx',
  'filemoon.to',
  'filemoon.link',
  'voe.sx',
  'voe.plus',
  'dood.re',
  'doodstream.com',
  'dood.wf',
  'dood.so',
  'streamtape.com',
  'streamtape.to',
  'uqload.to',
  'uqload.co',
  'mixdrop.co',
  'mixdrop.ch',
  'mixdrop.to',
  'mixdrop.sx',
  'mixdrop.ag',
  'vidhidepro.com',
  'vidhide.com',
  'vidhideplus.com',
  'morencius.com',
  'hglink.to',
  'bysejikuar.com',
  'streamsb.net',
  'sbplay.one',
  'sbembed.com',
  'sbembed1.com',
  'sbembed2.com',
  'fembed.com',
  'fembed-hd.com',
  'femax20.com',
  'fplayer.info',
  'mp4upload.com',
  'goodstream.one',
  'cloudvideo.tv',
  'vidcloud.co',
  'gounlimited.to',
  'gounlimited.stream',
  'playded.to',
  'onlystream.tv',
  'speedostream.com',
  'mcloud.to',
  'mycloudvideos.to',
  'embedsito.com',
  'embedsito.to',
  'waaw.to',
  'emturbovid.com',
  'vudeo.co',
  'upns.pro',

  // --- Agregadores de video externos compatibles ---
  'vidsrc.me',
  'vidsrc.to',
  'vidsrc.net',
  'multiembed.mov',
  '2embed.cc',
]

// Nombres amigables para mostrar en el selector de servidores.
const NAMES = {
  'streamwish.to': 'Streamwish',
  'streamwish.pro': 'Streamwish',
  'embedwish.com': 'Streamwish',
  'filemoon.sx': 'Filemoon',
  'filemoon.to': 'Filemoon',
  'filemoon.link': 'Filemoon',
  'voe.sx': 'VOE',
  'voe.plus': 'VOE',
  'dood.re': 'Doodstream',
  'doodstream.com': 'Doodstream',
  'dood.wf': 'Doodstream',
  'dood.so': 'Doodstream',
  'streamtape.com': 'Streamtape',
  'streamtape.to': 'Streamtape',
  'uqload.to': 'Uqload',
  'uqload.co': 'Uqload',
  'mixdrop.co': 'Mixdrop',
  'mixdrop.ch': 'Mixdrop',
  'mixdrop.to': 'Mixdrop',
  'mixdrop.sx': 'Mixdrop',
  'mixdrop.ag': 'Mixdrop',
  'vidhidepro.com': 'VidHide',
  'vidhide.com': 'VidHide',
  'vidhideplus.com': 'VidHide',
  'morencius.com': 'VidHide',
  'hglink.to': 'Streamwish',
  'bysejikuar.com': 'Bysejikuar',
  'streamsb.net': 'StreamSB',
  'sbplay.one': 'StreamSB',
  'sbembed.com': 'StreamSB',
  'sbembed1.com': 'StreamSB',
  'sbembed2.com': 'StreamSB',
  'fembed.com': 'Fembed',
  'fembed-hd.com': 'Fembed',
  'femax20.com': 'Fembed',
  'fplayer.info': 'Fembed',
  'mp4upload.com': 'MP4Upload',
  'goodstream.one': 'GoodStream',
  'cloudvideo.tv': 'CloudVideo',
  'vidcloud.co': 'VidCloud',
  'gounlimited.to': 'GoUnlimited',
  'gounlimited.stream': 'GoUnlimited',
  'playded.to': 'PlayDed',
  'onlystream.tv': 'OnlyStream',
  'speedostream.com': 'SpeedoStream',
  'mcloud.to': 'MCloud',
  'mycloudvideos.to': 'MCloud',
  'embedsito.com': 'Embedsito',
  'embedsito.to': 'Embedsito',
  'vidsrc.me': 'VidSrc',
  'vidsrc.to': 'VidSrc',
  'vidsrc.net': 'VidSrc',
  'multiembed.mov': 'MultiEmbed',
  '2embed.cc': '2Embed',
  'embed69.org': 'Embed69',
  'pelisplushd.bz': 'PelisPlus HD',
  'poseidonhd2.co': 'Poseidon',
  'player.poseidonhd2.co': 'Poseidon',
  'waaw.to': 'Waaw',
  'emturbovid.com': 'EmTurboVid',
  'vudeo.co': 'VuDeo',
  'upns.pro': 'Upns',
}

// ¿La URL es de un host permitido?
export function isAllowed(url) {
  if (typeof url !== 'string') return false
  let u
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  const host = u.hostname.toLowerCase()
  return ALLOWED.some((s) => host === s || host.endsWith(`.${s}`))
}

// Nombre legible del host (para el selector de servidores).
export function hostName(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    const parts = host.split('.')
    for (let i = 0; i < parts.length - 1; i++) {
      const cand = parts.slice(i).join('.')
      if (NAMES[cand]) return NAMES[cand]
    }
    const root = parts.slice(-2).join('.')
    const base = root.split('.')[0]
    return base.charAt(0).toUpperCase() + base.slice(1)
  } catch {
    return 'Servidor'
  }
}