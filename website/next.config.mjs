import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a fully static site to /out so the VPS rsync-based deploy picks
  // up fresh assets. Without `output: 'export'`, `next build` only writes
  // .next/ and the deploy ships a stale out/ from the last manual export.
  output: "export",
  // Static export has no runtime image optimizer; serve images as-is.
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
