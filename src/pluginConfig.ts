import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-route-du-rhum-routage',
    version: '1.4.0',
    icon: '⛵',
    title: 'Route du Rhum 2026 · flotte et routage',
    description: 'Positions, trajectoires et classement de la Route du Rhum 2026 en direct, avec routage ECMWF (optimale, option Nord, option Sud) des IMOCA et Class40.',
    author: 'Adrien Zucconi',
    repository: 'https://github.com/__RDR_REPO__',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    desktopWidth: 380,
    routerPath: '/route-du-rhum-routage/:boat?',
    private: true,
};

export default config;
