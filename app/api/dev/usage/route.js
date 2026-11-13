import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { DEV_MODE_ENABLED, FREE_PLAN_LIMITS } from "@/lib/dev-mode";
import { readGeminiUsage } from "@/lib/dev-usage";

export const dynamic = "force-dynamic";

const isoDate = (d) => d.toISOString().slice(0, 10);

// ImageKit account usage for the current calendar month.
// Note: ImageKit's endDate is exclusive, so we pass tomorrow.
async function getImageKitUsage() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const auth = Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString("base64");

  const res = await fetch(
    `https://api.imagekit.io/v1/accounts/usage?startDate=${isoDate(start)}&endDate=${isoDate(end)}`,
    { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`ImageKit usage API returned ${res.status}`);
  const u = await res.json();

  const limits = FREE_PLAN_LIMITS.imagekit;
  return {
    bandwidth: { used: u.bandwidthBytes, limit: limits.bandwidthBytes },
    storage: { used: u.mediaLibraryStorageBytes, limit: limits.storageBytes },
    extensionUnits: { used: u.extensionUnitsCount, limit: limits.extensionUnits },
    resets: limits.resets,
    period: `${isoDate(start)} → today`,
  };
}

async function getClerkUsage() {
  const client = await clerkClient();
  const totalUsers = await client.users.getCount();
  return {
    totalUsers,
    limit: FREE_PLAN_LIMITS.clerk.monthlyRetainedUsers,
  };
}

async function getGeminiUsage() {
  const usage = await readGeminiUsage();
  return {
    ...usage,
    limits: FREE_PLAN_LIMITS.gemini.requestsPerDay,
    resets: FREE_PLAN_LIMITS.gemini.resets,
  };
}

function getConvexInfo() {
  // e.g. "dev:descriptive-oyster-191"
  const deployment = (process.env.CONVEX_DEPLOYMENT || "").split("#")[0].trim();
  const name = deployment.split(":")[1] || null;
  return {
    deployment: name,
    dashboardUrl: name
      ? `https://dashboard.convex.dev/d/${name}`
      : "https://dashboard.convex.dev",
    limits: FREE_PLAN_LIMITS.convex,
  };
}

// Run one source, turning errors into { error } so one failure doesn't hide the rest
const safely = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    return { error: e.message || "Failed to load" };
  }
};

export async function GET() {
  if (!DEV_MODE_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [imagekit, clerk, gemini] = await Promise.all([
    safely(getImageKitUsage),
    safely(getClerkUsage),
    safely(getGeminiUsage),
  ]);

  return NextResponse.json({
    fetchedAt: Date.now(),
    imagekit,
    clerk,
    gemini,
    convex: getConvexInfo(),
  });
}
