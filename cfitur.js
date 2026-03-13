import axios from "axios"

// ISI API MU
global.kyzoapi = {
   url: "https://kyzorohan.web.id",
   key: "kyzo"
}

const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("contoh:\n.cfitur cjs close group")

  const prompt = `buatkan fitur untuk bot whatsapp baileys nodejs

#CASE
case "cmd":
{
...code...
}
break

#PLUGINS ESM
import...
const handler....
...code...
handler.command = ...
export default handler

#PLUGINS CJS
const .... = require("...")
const handler....
...code...
handler.command = ...
module.exports = handler

kirim hanya kode tanpa penjelasan tanpa markdown tanpa komentar`

  const url = `${global.kyzoapi.url}/api/ai?q=${encodeURIComponent(text)}&prompt=${encodeURIComponent(prompt)}&key=${global.kyzoapi.key}`

  try {
    const { data } = await axios.get(url)
    if (!data.status) throw "error"
    const res = data.response
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/```/g, "")
      .trim()
    await conn.sendMessage(m.chat, { text: res }, { quoted: m })
  } catch (e) {
    m.reply("error")
  }
}

handler.command = /^cfitur$/i
export default handler