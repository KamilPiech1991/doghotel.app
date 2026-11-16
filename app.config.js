// Adres bazowy strony. Dla GitHub Pages: /doghotel.app (ustawiane w workflow przez EXPO_BASE_URL).
const baseUrl = process.env.EXPO_BASE_URL ?? '';

module.exports = {
  expo: {
    name: 'Psotelgracja',
    slug: 'psotelgracja',
    scheme: 'psotelgracja',
    version: '0.2.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    plugins: ['expo-router'],
    experiments: { typedRoutes: false, baseUrl },
    web: {
      output: 'single',
      bundler: 'metro',
      favicon: './assets/favicon.png',
      name: 'Psotelgracja – hotel dla psiaków',
      shortName: 'Psotelgracja',
      lang: 'pl',
      themeColor: '#075B39',
      backgroundColor: '#F7FAF8',
    },
    ios: { supportsTablet: true, bundleIdentifier: 'pl.psotelgracja.app' },
    android: { package: 'pl.psotelgracja.app' },
  },
};
