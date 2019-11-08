import AppManifest from './AppManifest';
import EventEmitter, { useEventEmitterValue } from '../utils/EventEmitter';
import ApiClients from '../http/apiClients';
import FusionClient from '../http/apiClients/FusionClient';
import { useFusionContext } from '../core/FusionContext';
import { useEffect, useState } from 'react';
import TelemetryLogger from '../utils/TelemetryLogger';
import DistributedState, { IDistributedState } from '../utils/DistributedState';
import { IEventHub } from '../utils/EventHub';

type AppRegistration = {
    AppComponent: React.ComponentType;
};

type AppContainerEvents = {
    update: (app: AppManifest[]) => void;
    change: (app: AppManifest | null) => void;
};

export default class AppContainer extends EventEmitter<AppContainerEvents> {
    private _currentApp: IDistributedState<AppManifest | null>;
    private apps: IDistributedState<AppManifest[]>;
    previousApp: AppManifest | null = null;

    get currentApp() {
        return this._currentApp.state;
    }

    private readonly fusionClient: FusionClient;
    private readonly telemetryLogger: TelemetryLogger;

    constructor(apiClients: ApiClients, telemetryLogger: TelemetryLogger, eventHub: IEventHub) {
        super();
        this.fusionClient = apiClients.fusion;
        this.telemetryLogger = telemetryLogger;
        this._currentApp = new DistributedState<AppManifest | null>('currentApp', null, eventHub);
        this._currentApp.on('change', (updatedApp: AppManifest | null) => {
            this.emit('change', updatedApp);
        });

        this.apps = new DistributedState<AppManifest[]>('apps', [], eventHub);
        this.apps.on('change', (apps: AppManifest[]) => {
            this.emit('update', apps);
        });
    }

    updateManifest(appKey: string, manifest: AppManifest): void {
        const existingApp = this.get(appKey);

        // Ensure app key on the manifest
        manifest = {
            ...manifest,
            key: appKey,
        };

        if (existingApp === null) {
            const newApp = manifest;
            this.addOrUpdate(newApp);
            this.fetchIconAsync(appKey);
        } else {
            const updatedApp = { ...existingApp, ...manifest };
            this.addOrUpdate(updatedApp);
        }
    }

    get(appKey: string | null) {
        return this.apps.state.find(app => app.key === appKey) || null;
    }

    getAll() {
        return [...this.apps.state];
    }

    async setCurrentAppAsync(appKey: string | null): Promise<void> {
        if (!appKey) {
            this._currentApp.state = null;
            this.previousApp = this._currentApp.state;
            this.emit('change', null);
            return;
        }

        const app = this.get(appKey);

        if (!app) {
            const { data: manifest } = await this.fusionClient.getAppManifestAsync(appKey);
            const appManifest = manifest as AppManifest;
            this.updateManifest(appKey, appManifest);
            return await this.setCurrentAppAsync(appKey);
        }

        if (!app.AppComponent) {
            await this.fusionClient.loadAppScriptAsync(appKey);
            return await this.setCurrentAppAsync(appKey);
        }

        if (this._currentApp) {
            this.previousApp = this._currentApp.state;
        }

        // Log custom event - new app and prev app
        this.telemetryLogger.trackEvent({
            name: 'App selected',
            properties: {
                previousApp: this._currentApp.state ? this._currentApp.state.name : null,
                selectedApp: app.name,
                currentApp: app.name,
            },
        });

        this._currentApp.state = app;
        this.emit('change', app);
    }

    async getAllAsync() {
        const response = await this.fusionClient.getAppsAsync();
        response.data.forEach(manifest =>
            this.updateManifest(manifest.key, manifest as AppManifest)
        );

        return this.getAll();
    }

    private async fetchIconAsync(appKey: string) {
        const app = this.get(appKey);

        if (!app) {
            return;
        }

        const response = await this.fusionClient.getAppIconAsync(appKey);
        const appWithIcon = { ...app, icon: response.data };
        this.addOrUpdate(appWithIcon);
    }

    private addOrUpdate(app: AppManifest) {
        const existingApp = this.get(app.key);

        if (existingApp) {
            this.apps.state = this.apps.state.map(a => (a.key === app.key ? app : a));
        } else {
            this.apps.state = [...this.apps.state, app];
        }

        this.emit('update', this.apps.state);
    }
}

let appContainerInstance: AppContainer | null = null;

let appContainerPromise: Promise<AppContainer> | null = null;
let setAppContainerSingleton: ((appContainer: AppContainer) => void) | null;
const appContainerFactory = (appContainer: AppContainer) => {
    appContainerInstance = appContainer;

    if (setAppContainerSingleton) {
        setAppContainerSingleton(appContainer);
        setAppContainerSingleton = null;
    }
};

const getAppContainer = (): Promise<AppContainer> => {
    if (appContainerInstance) {
        return Promise.resolve(appContainerInstance);
    }

    if (appContainerPromise) {
        return appContainerPromise;
    }

    appContainerPromise = new Promise(resolve => {
        setAppContainerSingleton = resolve;
    });

    return appContainerPromise;
};

const registerApp = (appKey: string, manifest: AppRegistration): void => {
    getAppContainer().then(appContainer =>
        appContainer.updateManifest(appKey, manifest as AppManifest)
    );
};

const useCurrentApp = () => {
    const { app } = useFusionContext();
    const [currentApp] = useEventEmitterValue(
        app.container,
        'change',
        app => app,
        app.container.currentApp
    );
    return currentApp;
};

const useApps = (): [Error | null, boolean, AppManifest[]] => {
    const { app } = useFusionContext();
    const [apps, setApps] = useState<AppManifest[]>([]);
    const [error, setError] = useState<Error | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    const fetchApps = async () => {
        setIsFetching(true);

        try {
            const allApps = await app.container.getAllAsync();
            setApps(allApps);
        } catch (e) {
            setError(e);
        }

        setIsFetching(false);
    };

    useEffect(() => {
        fetchApps();
        return app.container.on('update', () => setApps(app.container.getAll()));
    }, []);

    return [error, isFetching, apps];
};

export { registerApp, appContainerFactory, AppManifest, useCurrentApp, useApps };
