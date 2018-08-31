const nock = require('nock');
const deepEqual = require('deep-equal');
const _ = require('lodash');

/**
 * Create a nock inspector.
 * @param {Object} options - The request.
 * @param {string} options.method - The method (GET, PUT, etc.).
 * @param {string} options.basePath - Base path of the URL.
 * @param {string} options.endpoint - The endpoint.
 * @param {Object} [options.response] - The default response.
 */

module.exports = function (options){
    return new NockInspector(options)
};

module.exports.cleanAll = () => nock.cleanAll();

module.exports.activeMocks = () => nock.activeMocks();

function NockInspector({method, basePath, endpoint, response}){

    if(response && !response.status){
        response.status = 200;
    }

    if(!method){
        throw new Error('method is required');
    }

    const headersMatch = (request, specRequest) =>
        !specRequest.headers
            ? true
            : deepEqual(specRequest.headers, _.pick(request.headers, _.keys(specRequest.headers)));

    const bodiesMatch = (request, specRequest) =>
        deepEqual(request.body, specRequest.body);

    const inspectorProps = this;

    //the default response
    inspectorProps.response = response;

    //an array of all requests made to the thing
    inspectorProps.requests = [];

    //specific responses and headers that correlate to one another
    inspectorProps.specifics = [];

    //this is the nock itself
    inspectorProps.scope = createScope({method, basePath, endpoint});

    /**
     * Tailor a response for a specific request
     * @param {Object} request - The request.
     * @param {Object} [request.body] - The request body.
     * @param {Object} [request.headers] - The request headers.
     * @param {Object} response - The response.
     * @param {number} [response.status] - The response status.
     * @param {Object} [response.body] - The response body.
     * @param {Object} [response.headers] - The response headers.
     */
    inspectorProps.respondToRequest = function requestResponse(request, response){
        if(!request || !response){
            throw new Error('both a request and a response are required');
        }

        if(!request.body && !request.headers){
            throw new Error('request must have a body or headers');
        }

        if(!response.status){
            response.status = 200;
        }

        const existingSpec = _.findIndex(inspectorProps.specifics, (specific) => deepEqual(specific.request, request));
        if(existingSpec >= 0){
            inspectorProps.specifics[existingSpec] = {request, response};
            return;
        }

        inspectorProps.specifics.push({request, response});
    };

    function createScope({method, basePath, endpoint}) {
        return nock(basePath)[method.toLowerCase()](endpoint).reply(function (uri, requestBody) {
            const requestInfo = {headers: this.req.headers, body: requestBody};
            inspectorProps.requests.push(requestInfo);
            inspectorProps.request = requestInfo;

            const specific = _.find(inspectorProps.specifics, specific => headersMatch(requestInfo, specific.request) && bodiesMatch(requestInfo, specific.request));

            //todo if body is undefined should it be {}? right now it just comes back with no body.
            if(specific){
                return [
                    specific.response.status,
                    specific.response.body,
                    specific.response.headers
                ]
            } else if (inspectorProps.response) {
                return[
                    inspectorProps.response.status,
                    inspectorProps.response.body,
                    inspectorProps.response.headers
                ]
            } else {
                throw new Error('There is no matching or default response');
            }
        }).persist(true);
    }

}
