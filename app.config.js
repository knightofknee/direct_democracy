/**
 * app.json with web-only switches. The web version is hosted on
 * waldgrave.com under /directdemocracy/app, so a web export sets expo-router's
 * base path; native builds never get it (it would be baked into their
 * bundles too). The hosted export is a single-page app: every screen reads
 * the signed-in user and the device's language, so pre-rendered HTML could
 * never match the first render in the browser (React hydration error #418).
 * Export with `npm run export-web`.
 */
module.exports = ({ config }) => {
  if (process.env.WEB_EXPORT !== '1') return config;
  return {
    ...config,
    web: { ...config.web, output: 'single' },
    experiments: { ...config.experiments, baseUrl: '/directdemocracy/app' },
  };
};
