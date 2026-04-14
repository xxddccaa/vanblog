import {
  isRevalidateRequestAuthorized,
  isRevalidateTokenConfigured,
} from "../../utils/revalidateAuth";

export default async function handler(req: any, res: any) {
  const providedToken = req.headers?.["x-vanblog-isr-token"];
  if (!isRevalidateRequestAuthorized(providedToken)) {
    const status = isRevalidateTokenConfigured() ? 401 : 503;
    return res.status(status).json({ revalidated: false, message: "ISR token invalid" });
  }

  const path = req.query?.path;
  // console.log("触发增量渲染", path);
  if (!path) {
    return res.status(500).send("触发增量增量渲染失败");
  }
  try {
    await res.revalidate(path);
    return res.json({ revalidated: true });
  } catch (err) {
    // If there was an error, Next.js will continue
    // to show the last successfully generated page
    console.log(err);
    return res.status(500).send("触发增量增量渲染失败");
  }
}
