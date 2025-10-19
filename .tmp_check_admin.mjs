import { pathToFileURL } from "node:url";
(async () => {
  try {
    const clientUrl = pathToFileURL(process.env.CLIENT_PATH);
    const mod = await import(clientUrl.href);
    const prisma = new mod.PrismaClient();
    const admin = await prisma.user.findFirst({ where: { role: "admin" } });
    console.log("ADMIN_FOUND=" + (admin ? "yes" : "no"));
    if (admin) console.log("ADMIN_EMAIL=" + admin.email);
    await prisma[""]();
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
