import BaseResourceCollection from './BaseResourceCollection';
import { combineUrls } from '../../utils/url';
import buildQuery from 'odata-query';

export default class PeopleResourceCollection extends BaseResourceCollection {
    protected getBaseUrl(): string {
        return this.serviceResolver.getPeopleBaseUrl();
    }

    apiSignin(): string {
        return combineUrls(this.getBaseUrl(), 'api-signin');
    }

    getPersonDetails(id: string, oDataExpand?: PersonODataExpand[]): string {
        const url = combineUrls(this.getBaseUrl(), 'persons', id);

        if (!oDataExpand) return url;

        const expand = oDataExpand ? oDataExpand.map(s => s) : [];
        const oDataQuery = buildQuery({ expand });

        return `${url}${oDataQuery}`;
    }

    getPersonPhoto(id: string): string {
        return combineUrls(this.getBaseUrl(), 'persons', id, 'photo');
    }

    searchPersons(query: string): string {
        const oDataQuery = buildQuery({ search: query });
        const url = combineUrls(this.getBaseUrl(), 'persons');

        return `${url}${oDataQuery}`;
    }
}

export type PersonODataExpand = 'positions' | 'roles' | 'contracts';
