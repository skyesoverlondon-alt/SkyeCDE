const SHARED_ROUTES = [
  {
    id: 'skycde-hub',
    label: 'SkyeCDE hub',
    href: '../index.html',
    category: 'Hub route',
    description: 'Open the SkyeCDE hub.',
    keywords: ['hub', 'skycde', 'menu']
  },
  {
    id: 'skydexia',
    label: 'SkyDexia',
    href: '../SkyDexia/index.html',
    category: 'IDEia lane',
    description: 'Open the upgraded SkyDex lane.',
    keywords: ['skydex', 'ideia', 'upgrade']
  },
  {
    id: 'superideia',
    label: 'SuperIDEia',
    href: '../SuperIDEia/index.html',
    category: 'IDEia lane',
    description: 'Open the upgraded SuperIDE lane.',
    keywords: ['superide', 'ideia', 'upgrade']
  },
  {
    id: 'skaixuproideia',
    label: 'SkaixuProIDEia',
    href: '../SkaixuProIDEia/index.html',
    category: 'IDEia lane',
    description: 'Open the upgraded SkaixuPro-IDE lane.',
    keywords: ['skaixupro', 'ideia', 'upgrade']
  },
  {
    id: 'kaixusuperideia',
    label: 'KaixuSuperIDEia',
    href: '../KaixuSuperIDEia/index.html',
    category: 'IDEia lane',
    description: 'Open the upgraded KaixuSuper-IDE lane.',
    keywords: ['kaixusuper', 'ideia', 'upgrade']
  },
  {
    id: 'current-skydex',
    label: 'Current SkyDex',
    href: '../../SkyDex/SkyDex4_fixed/index.html',
    category: 'Preserved product',
    description: 'Open the current SkyDex product.',
    keywords: ['skydex', 'current', 'product']
  },
  {
    id: 'current-superide',
    label: 'Current SuperIDE',
    href: '../../SuperIDE/index.html',
    category: 'Preserved product',
    description: 'Open the current SuperIDE product.',
    keywords: ['superide', 'current', 'product']
  },
  {
    id: 'current-skaixupro',
    label: 'Current SkaixuPro-IDE',
    href: '../../SkaixuPro-IDE/SkaixuPro-IDE-Platform/index.html',
    category: 'Preserved product',
    description: 'Open the current SkaixuPro-IDE product.',
    keywords: ['skaixupro', 'current', 'product']
  },
  {
    id: 'current-kaixusuper',
    label: 'Current KaixuSuper-IDE',
    href: '../../KaixuSuper-IDE-(Internal Gate)/index.html',
    category: 'Preserved product',
    description: 'Open the current KaixuSuper-IDE product.',
    keywords: ['kaixusuper', 'current', 'product']
  }
];

export function getSharedSkyeHawkRoutes(currentRouteId) {
  return SHARED_ROUTES.filter(route => route.id !== currentRouteId).map(route => ({ ...route }));
}

export function getHubSkyeHawkRoutes() {
  return SHARED_ROUTES.map(route => ({
    ...route,
    href: route.href.replace(/^\.\.\//, './')
  }));
}