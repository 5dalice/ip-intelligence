"use client";

import { useEffect, useState } from "react";
import {
  readLatestInvestigation,
  type IpData,
} from "@/app/lib/intelligence";

export function useInvestigation() {
  const [data, setData] = useState<IpData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setData(readLatestInvestigation());
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return { data, ready };
}
