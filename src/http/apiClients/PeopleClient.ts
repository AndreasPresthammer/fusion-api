import BaseApiClient from './BaseApiClient';
import ResourceCollections from '../resourceCollections';
import { IHttpClient } from '../HttpClient';
import PersonDetails, {
    PersonAccountType,
    PersonRole,
    PersonBasePosition,
    PersonContract,
    PersonPosition,
    PersonProject,
    PersonRoleScope,
} from './models/people/PersonDetails';
import RoleDefinition from './models/people/RoleDefinition';
import { FusionApiHttpErrorResponse } from './models/common/FusionApiHttpErrorResponse';
import { PersonODataExpand } from '../resourceCollections/PeopleResourceCollection';
import GroupRoleMapping from './models/people/GroupRoleMapping';

export {
    PersonDetails,
    PersonAccountType,
    PersonRole,
    PersonBasePosition,
    PersonContract,
    PersonPosition,
    PersonProject,
    PersonRoleScope,
    PersonODataExpand,
};

export default class PeopleClient extends BaseApiClient {
    constructor(httpClient: IHttpClient, resourceCollection: ResourceCollections) {
        super(httpClient, resourceCollection);

        httpClient.getAsync<void, unknown>(
            resourceCollection.people.apiSignin(),
            { credentials: 'include' },
            async () => Promise.resolve()
        );
    }

    async getPersonDetailsAsync(id: string, oDataExpand?: PersonODataExpand[]) {
        const url = this.resourceCollections.people.getPersonDetails(id, oDataExpand);
        return await this.httpClient.getAsync<PersonDetails, FusionApiHttpErrorResponse>(url, {
            headers: { 'api-version': '3.0' },
        });
    }

    async getRoleDefinitionsAsync() {
        const url = this.resourceCollections.people.roleDefinitions();
        return await this.httpClient.getAsync<RoleDefinition[], FusionApiHttpErrorResponse>(url);
    }

    async getGroupRoleMappingsAsync() {
        const url = this.resourceCollections.people.groupRoleMappings();
        return await this.httpClient.getAsync<GroupRoleMapping[], FusionApiHttpErrorResponse>(url);
    }

    async searchPersons(query: string) {
        const url = this.resourceCollections.people.searchPersons(query);
        return await this.httpClient.getAsync<PersonDetails[], FusionApiHttpErrorResponse>(url, {
            headers: { 'api-version': '2.0' },
        });
    }
}
