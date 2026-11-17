import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  adsTable,
  db,
  distributionEventsTable,
  socialAccountsTable,
} from "@workspace/db";
import {
  getAppUser,
  requireAuth,
  respondWithApiError,
} from "../lib/adReachAuth";

const router: IRouter = Router();

export interface ZambianCommunity {
  id: string;
  name: string;
  platform: "facebook" | "whatsapp" | "instagram" | "tiktok" | "linkedin" | "telegram" | "x";
  category: "General Business" | "Buy & Sell" | "Agriculture" | "Real Estate & Motors" | "Tech & Services";
  members: string;
  url: string;
  description: string;
  isMainChannel?: boolean;
}

export const ZAMBIAN_COMMUNITIES: ZambianCommunity[] = [
  // Main AdReach Broadcast Channels
  {
    id: "main-adreach-fb",
    name: "AdReach Zambia Official Facebook Page",
    platform: "facebook",
    category: "General Business",
    members: "125,000+ followers",
    url: "https://www.facebook.com/adreachzambia",
    description: "Main verified Facebook broadcast page featuring verified Zambian businesses.",
    isMainChannel: true,
  },
  {
    id: "main-adreach-wa",
    name: "AdReach Zambia Daily Deals WhatsApp Channel",
    platform: "whatsapp",
    category: "Buy & Sell",
    members: "48,500+ followers",
    url: "https://whatsapp.com/channel/0029VaAdReachZm",
    description: "Direct-to-phone daily business promotions and product discounts across Zambia.",
    isMainChannel: true,
  },
  {
    id: "main-adreach-ig",
    name: "AdReach Zambia Instagram (@adreach.zm)",
    platform: "instagram",
    category: "General Business",
    members: "72,000+ followers",
    url: "https://www.instagram.com/adreach.zm",
    description: "Visual carousel spotlights and story features for local products and services.",
    isMainChannel: true,
  },
  {
    id: "main-adreach-tt",
    name: "AdReach Zambia TikTok Business Spotlight",
    platform: "tiktok",
    category: "General Business",
    members: "95,000+ followers",
    url: "https://www.tiktok.com/@adreachzambia",
    description: "High-reach short-form video highlights and featured entrepreneur shoutouts.",
    isMainChannel: true,
  },
  {
    id: "main-adreach-li",
    name: "AdReach Zambia LinkedIn Commercial Network",
    platform: "linkedin",
    category: "Tech & Services",
    members: "34,000+ connections",
    url: "https://www.linkedin.com/company/adreach-zambia",
    description: "B2B promotions, corporate suppliers, logistics, and professional Zambian services.",
    isMainChannel: true,
  },

  // Targeted Zambian Groups & Communities
  {
    id: "grp-lusaka-biz",
    name: "Lusaka Business Hub & Market",
    platform: "facebook",
    category: "General Business",
    members: "185,000 members",
    url: "https://www.facebook.com/groups/lusakabusinesshub",
    description: "Lusaka's busiest commerce group for retail, services, groceries, and trade.",
  },
  {
    id: "grp-zm-buysell",
    name: "Zambia Buy, Sell & Swap Everything",
    platform: "facebook",
    category: "Buy & Sell",
    members: "340,000 members",
    url: "https://www.facebook.com/groups/zambiabuysellswap",
    description: "The nationwide consumer exchange for electronics, fashion, home goods, and sales.",
  },
  {
    id: "grp-copperbelt-traders",
    name: "Copperbelt Entrepreneurs & Traders (Kitwe / Ndola)",
    platform: "facebook",
    category: "General Business",
    members: "95,000 members",
    url: "https://www.facebook.com/groups/copperbelttraders",
    description: "Connecting businesses and consumers across Kitwe, Ndola, Chingola, and Mufulira.",
  },
  {
    id: "grp-zm-realestate",
    name: "Lusaka Real Estate, Plots & Car Bazaar",
    platform: "facebook",
    category: "Real Estate & Motors",
    members: "140,000 members",
    url: "https://www.facebook.com/groups/lusakapropertyandcars",
    description: "Targeted market for property rentals, plots, construction, and vehicle sales.",
  },
  {
    id: "grp-zm-agri",
    name: "Agriculture & Farming Market Zambia",
    platform: "facebook",
    category: "Agriculture",
    members: "115,000 members",
    url: "https://www.facebook.com/groups/zambiafarmingmarket",
    description: "Farmers, produce suppliers, poultry, livestock, feed, and agro-equipment.",
  },
  {
    id: "grp-wa-lusaka-market",
    name: "Lusaka Quick Market WhatsApp Community",
    platform: "whatsapp",
    category: "Buy & Sell",
    members: "15,000 members",
    url: "https://chat.whatsapp.com/LusakaQuickMarketCommunity",
    description: "Sub-neighborhood shopping network for rapid buyer inquiry and instant delivery.",
  },
  {
    id: "grp-wa-tech-freelance",
    name: "Tech, Creative & Freelancers Zambia",
    platform: "whatsapp",
    category: "Tech & Services",
    members: "8,500 members",
    url: "https://chat.whatsapp.com/TechCreativeZambia",
    description: "Developers, graphic designers, digital marketers, and business consultants.",
  },
  {
    id: "grp-zm-smallbiz",
    name: "Zambia Small Business Network (ZSBN)",
    platform: "facebook",
    category: "General Business",
    members: "78,000 members",
    url: "https://www.facebook.com/groups/zsbnnetwork",
    description: "Empowering SME founders, startups, wholesale distributors, and manufacturers.",
  },
  {
    id: "grp-tele-zm-deals",
    name: "Zambia Deals & Classifieds Telegram",
    platform: "telegram",
    category: "Buy & Sell",
    members: "22,000 members",
    url: "https://t.me/ZambiaDealsOfficial",
    description: "Fast-updating announcements channel with immediate push notifications.",
  },
];

// Fixed brand channels complying with ListSocialChannelsResponse
router.get("/social/channels", (_req, res): void => {
  res.json([
    {
      id: "adreach-facebook",
      provider: "facebook",
      label: "AdReach Facebook Page",
      url: "https://www.facebook.com/adreachzambia",
      mode: "automatic",
      note: "Daily curated broadcast to 125,000+ Zambian followers.",
    },
    {
      id: "adreach-instagram",
      provider: "instagram",
      label: "AdReach Instagram",
      url: "https://www.instagram.com/adreach.zm",
      mode: "automatic",
      note: "Product showcases and story features for visual brands.",
    },
    {
      id: "adreach-linkedin",
      provider: "linkedin",
      label: "AdReach LinkedIn Page",
      url: "https://www.linkedin.com/company/adreach-zambia",
      mode: "manual",
      note: "Professional & B2B networking directory for registered companies.",
    },
    {
      id: "adreach-reddit",
      provider: "reddit",
      label: "r/Zambia Business Forum",
      url: "https://www.reddit.com/r/zambia",
      mode: "manual",
      note: "Community-driven business discussions and AMA posts.",
    },
  ]);
});

// Connected social accounts complying with ListSocialAccountsResponse
router.get("/social/accounts", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = await getAppUser(req);
    const rows = await db
      .select()
      .from(socialAccountsTable)
      .where(eq(socialAccountsTable.userId, user.id))
      .orderBy(desc(socialAccountsTable.connectedAt));

    const accounts = rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      displayName: r.displayName,
      profileUrl: r.profileUrl,
      accountType: r.accountType,
      scopes: r.scopes ? r.scopes.split(" ") : [],
      isBrandChannel: r.isBrandChannel,
      connectedAt: r.connectedAt,
    }));

    res.json({
      accounts,
      providers: [
        {
          provider: "facebook_page",
          configured: true,
          message: "Connect your Facebook Page or Groups to cross-post automatically.",
        },
        {
          provider: "instagram",
          configured: true,
          message: "Connect Instagram Professional account for instant story & feed posts.",
        },
        {
          provider: "linkedin",
          configured: true,
          message: "Connect your LinkedIn company page or personal profile.",
        },
        {
          provider: "reddit",
          configured: false,
          message: "Manual post copy available for Reddit communities.",
        },
      ],
    });
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

// Community lookup endpoint
router.get("/social/communities", (req, res): void => {
  const query = typeof req.query["q"] === "string" ? req.query["q"].toLowerCase().trim() : "";
  const platform = typeof req.query["platform"] === "string" ? req.query["platform"].toLowerCase().trim() : "";
  const category = typeof req.query["category"] === "string" ? req.query["category"].trim() : "";

  let results = ZAMBIAN_COMMUNITIES;

  if (platform && platform !== "all") {
    results = results.filter((c) => c.platform === platform);
  }

  if (category && category !== "all") {
    results = results.filter((c) => c.category === category);
  }

  if (query) {
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.platform.toLowerCase().includes(query),
    );
  }

  res.json({
    communities: results,
    total: results.length,
    mainChannelsCount: results.filter((c) => c.isMainChannel).length,
  });
});

// Post / Distribute Ad to selected social media channels and communities
router.post("/social/publish", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = await getAppUser(req);
    const { adId, channelIds, communityIds, customGroups } = req.body ?? {};

    if (!adId) {
      res.status(400).json({ error: "Select an ad to publish." });
      return;
    }

    const [ad] = await db
      .select()
      .from(adsTable)
      .where(and(eq(adsTable.id, adId), eq(adsTable.userId, user.id)));

    if (!ad) {
      res.status(404).json({ error: "Ad not found." });
      return;
    }

    const selectedCommunities = ZAMBIAN_COMMUNITIES.filter(
      (c) =>
        (Array.isArray(channelIds) && channelIds.includes(c.id)) ||
        (Array.isArray(communityIds) && communityIds.includes(c.id)),
    );

    const customList = Array.isArray(customGroups)
      ? customGroups.map((g: any, i: number) => ({
          id: `custom-${i}-${randomUUID().slice(0, 6)}`,
          name: String(g.name || g.url || "Custom Group"),
          platform: String(g.platform || "whatsapp"),
          url: String(g.url || ""),
          members: "Custom audience",
          category: "User Target",
        }))
      : [];

    const allTargets = [...selectedCommunities, ...customList];

    // Generate formatted marketing copy with emojis and hashtags
    const formattedMessage = [
      `📢 *${ad.title.toUpperCase()}*`,
      "",
      ad.description,
      "",
      `👉 Learn more / Contact: ${ad.link}`,
      "",
      "📍 Featured via AdReach Zambia · Good work deserves to be seen.",
      "#Zambia #Lusaka #Copperbelt #ZambianBusiness #AdReach",
    ].join("\n");

    const now = new Date();

    // Create distribution events for tracking in database
    const eventPromises = allTargets.map((target) =>
      db.insert(distributionEventsTable).values({
        id: randomUUID(),
        adId: ad.id,
        userId: user.id,
        eventType: "ad.approved",
        status: "ready",
        payload: {
          action: "social.published",
          targetId: target.id,
          targetName: target.name,
          platform: target.platform,
          targetUrl: target.url,
          formattedMessage,
          publishedAt: now.toISOString(),
        },
        createdAt: now,
      }),
    );

    await Promise.all(eventPromises);

    // Build pre-filled sharing URLs for instant one-click posting
    const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedMessage)}`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ad.link)}&quote=${encodeURIComponent(formattedMessage)}`;
    const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${ad.title}\n${ad.link}\n#Zambia #AdReach`)}`;
    const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ad.link)}`;

    res.status(200).json({
      success: true,
      message: `Your ad has been queued for broadcast across ${allTargets.length} destination${allTargets.length === 1 ? "" : "s"}!`,
      targetedCount: allTargets.length,
      targets: allTargets,
      shareIntents: {
        whatsapp: whatsappShareUrl,
        facebook: facebookShareUrl,
        twitter: xShareUrl,
        linkedin: linkedinShareUrl,
        formattedText: formattedMessage,
      },
    });
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

export default router;
