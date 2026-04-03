const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = appJson.expo || config || {};

  return {
    ...base,
    extra: {
      ...(base.extra || {}),
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
};

