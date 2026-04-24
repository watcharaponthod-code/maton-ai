const GW    = "https://gateway.maton.ai/github"
const MATON = () => process.env.MATON_API_KEY!
const REPO  = () => process.env.GITHUB_REPO!

async function ghReq(method: string, path: string, body?: object) {
  const r = await fetch(`${GW}${path}`, {
    method,
    headers: { Authorization: `Bearer ${MATON()}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  return r.status === 204 ? {} : r.json()
}

export async function commit(filePath: string, content: string, message: string) {
  if (!REPO()) return
  const path = `/repos/${REPO()}/contents/${filePath}`
  let sha: string | undefined
  try { sha = (await ghReq("GET", path)).sha } catch {}
  await ghReq("PUT", path, {
    message,
    content: Buffer.from(content).toString("base64"),
    ...(sha ? { sha } : {}),
  })
}
