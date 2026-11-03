import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-route-du-rhum',
    version: '1.0.0',
    icon: '⛵',
    title: 'Route du Rhum 2026 en direct',
    description: 'Positions, trajectoires et classement de toute la flotte de la Route du Rhum 2026, en direct sur la carte du vent.',
    author: 'Adrien Zucconi',
    repository: 'https://github.com/__RDR_REPO__',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    desktopWidth: 380,
    routerPath: '/route-du-rhum/:boat?',
    private: true,
};

export default config;
