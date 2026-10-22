/** Static export: the player is a client-side app; lessons are JSON files in /public/lessons. */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
