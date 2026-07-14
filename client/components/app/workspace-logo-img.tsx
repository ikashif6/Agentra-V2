"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type WorkspaceLogoImgProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  style?: CSSProperties;
};

export function WorkspaceLogoImg({
  src,
  alt,
  className,
  fallbackSrc = "/agentraa-logo.svg",
  style,
}: WorkspaceLogoImgProps) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const resolved = src && !broken ? src : fallbackSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={cn(className)}
      style={style}
      onError={() => setBroken(true)}
    />
  );
}
