import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/dashboard", "/saved", "/applications", "/notifications", "/settings", "/submit", "/login", "/register"],
      },
    ],
    sitemap: appUrl("/sitemap.xml"),
  };
}
