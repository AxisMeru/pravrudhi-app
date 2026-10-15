import type { Metadata } from "next";

import { pageTitle } from "@/lib/pageTitles";

export const metadata: Metadata = { title: pageTitle("dataHandling") };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
