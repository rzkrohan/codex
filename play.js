import yts from "yt-search"
import { ytmp3 } from "yt-downld"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import https from "https"
import http from "http"

const key    = "kyzo_e16fdb825ad20547"
const apiurl = "https://kyzorohan.web.id"

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => resolve(Buffer.concat(chunks)))
      res.on("error", reject)
    }).on("error", reject)
  })
}

async function fetchLyrics(title) {
  try {
    const q   = encodeURIComponent(title)
    const buf = await fetchBuffer(`${apiurl}/api/lyrics?key=${key}&judul=${q}`)
    const res = JSON.parse(buf.toString())
    if (!res.status || !res.data?.length) return null
    const entry = res.data.find(d => !d.instrumental) ?? res.data[0]
    return entry.lyrics ?? null
  } catch {
    return null
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ")
  const lines = []
  let current = ""
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

async function generateYTCard({ thumbnailUrl, title, duration, channelName, views, uploadDate = "baru saja" }) {
  const W = 720, H = 200, THUMB_W = 240, THUMB_H = 135, PAD = 16
  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext("2d")

  ctx.fillStyle = "#0f0f0f"
  ctx.fillRect(0, 0, W, H)

  try {
    const buf = await fetchBuffer(thumbnailUrl)
    const img = await loadImage(buf)
    ctx.save()
    roundRect(ctx, PAD, PAD, THUMB_W, THUMB_H, 8)
    ctx.clip()
    ctx.drawImage(img, PAD, PAD, THUMB_W, THUMB_H)
    ctx.restore()
  } catch {
    ctx.fillStyle = "#3a3a3a"
    roundRect(ctx, PAD, PAD, THUMB_W, THUMB_H, 8)
    ctx.fill()
  }

  ctx.font = "bold 12px Arial"
  const durW = ctx.measureText(duration).width + 16
  const durX = PAD + THUMB_W - durW - 6
  const durY = PAD + THUMB_H - 24
  ctx.fillStyle = "rgba(0,0,0,0.85)"
  roundRect(ctx, durX, durY, durW, 20, 4)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.textBaseline = "middle"
  ctx.fillText(duration, durX + 8, durY + 10)

  const infoX = PAD + THUMB_W + PAD
  const infoW = W - infoX - PAD - 20
  ctx.fillStyle = "#f1f1f1"
  ctx.font = "bold 15px Arial"
  ctx.textBaseline = "top"
  const titleLines = wrapText(ctx, title, infoW).slice(0, 2)
  titleLines.forEach((line, i) => {
    if (i === 1 && ctx.measureText(line).width > infoW) {
      while (ctx.measureText(line + "…").width > infoW) line = line.slice(0, -1)
      line += "…"
    }
    ctx.fillText(line, infoX, PAD + i * 22)
  })

  const avR = 16
  const avY = PAD + titleLines.length * 22 + 14
  ctx.save()
  ctx.beginPath()
  ctx.arc(infoX + avR, avY + avR, avR, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = "#ff0000"
  ctx.fillRect(infoX, avY, avR * 2, avR * 2)
  ctx.fillStyle = "#fff"
  ctx.font = "bold 12px Arial"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(channelName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(), infoX + avR, avY + avR)
  ctx.restore()

  ctx.textAlign = "left"
  ctx.fillStyle = "#aaa"
  ctx.font = "13px Arial"
  ctx.textBaseline = "middle"
  ctx.fillText(channelName, infoX + avR * 2 + 8, avY + avR)
  ctx.textBaseline = "top"
  ctx.fillText(`${views} x ditonton  ·  ${uploadDate}`, infoX, avY + avR * 2 + 10)

  ctx.fillStyle = "#666"
  ;[0, 7, 14].forEach(dy => {
    ctx.beginPath()
    ctx.arc(W - PAD - 4, PAD + 6 + dy, 2.5, 0, Math.PI * 2)
    ctx.fill()
  })

  return canvas.toBuffer("image/png")
}

function formatViews(n) {
  if (!n) return "?"
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " M"
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + " jt"
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + " rb"
  return String(n)
}

let handler = async (m, { sock, text }) => {
  try {
    if (!text) return sock.sendMessage(m.chat, {
      text: "❌ Masukkan judul lagu\n\nContoh:\n.play dj jedag jedug"
    }, { quoted: m })

    await sock.sendMessage(m.chat, { react: { text: "🔎", key: m.key } })

    const search = await yts(text)
    const video  = search.videos[0]
    if (!video) throw new Error("Video tidak ditemukan")

    await sock.sendMessage(m.chat, { react: { text: "⬇️", key: m.key } })

    const [data, cardBuffer, lyrics] = await Promise.all([
      ytmp3(video.url),
      generateYTCard({
        thumbnailUrl: video.thumbnail,
        title:        video.title,
        duration:     video.timestamp,
        channelName:  video.author?.name ?? "Unknown",
        views:        formatViews(video.views),
        uploadDate:   video.ago ?? "baru saja",
      }),
      fetchLyrics(video.title),
    ])

    if (!data?.download) throw new Error("Link download tidak tersedia")

    const MAX     = 2800
    const trimmed = lyrics ? (lyrics.length > MAX ? lyrics.slice(0, MAX).trimEnd() + "\n..." : lyrics) : null
    const caption = trimmed ? `— Lyrics\n${trimmed}` : ""

    await sock.sendMessage(m.chat, {
      image:   cardBuffer,
      caption,
    }, { quoted: m })

    await sock.sendMessage(m.chat, {
      audio:    { url: data.download },
      mimetype: "audio/mpeg",
      ptt:      false,
    })

    await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } })

  } catch (e) {
    console.error("[play]", e)
    await sock.sendMessage(m.chat, {
      text: `❌ Gagal mengambil audio\n\n${e?.message ?? e}`
    }, { quoted: m })
    await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
  }
}

handler.command = ["play"]
handler.limit   = true

export default handler