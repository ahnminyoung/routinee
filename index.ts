import { NativeModules, Platform } from 'react-native';

function applyExpoHmrGlobalsPolyfill() {
  if (Platform.OS === 'web') return;

  const g = globalThis as any;
  const sourceCode = NativeModules?.SourceCode as { scriptURL?: string } | undefined;
  const fallbackHref = sourceCode?.scriptURL || 'http://localhost:8081/';

  if (typeof g.window === 'undefined') {
    g.window = g;
  }

  if (typeof g.document === 'undefined') {
    g.document = { currentScript: undefined };
  }

  if (typeof g.location === 'undefined') {
    try {
      const parsed = new URL(fallbackHref);
      g.location = {
        href: parsed.toString(),
        host: parsed.host,
        protocol: parsed.protocol,
        origin: parsed.origin,
      };
    } catch {
      g.location = {
        href: 'http://localhost:8081/',
        host: 'localhost:8081',
        protocol: 'http:',
        origin: 'http://localhost:8081',
      };
    }
  }

  if (!g.window.document) {
    g.window.document = g.document;
  }
  if (!g.window.location) {
    g.window.location = g.location;
  }
}

applyExpoHmrGlobalsPolyfill();

import 'expo-router/entry';
