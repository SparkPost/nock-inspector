import nock, { Scope, ReplyFnContext } from 'nock';
import isEqual from 'lodash.isequal';
import { ParsedUrlQuery } from 'querystring';

interface Response {
  status: number;
  headers?: { [key: string]: string };
  body?: object;
}

interface Request {
  headers?: { [key: string]: string };
  body?: object;
  query?: object;
}

type Method = 'get' | 'post' | 'put' | 'head' | 'patch' | 'merge' | 'delete' | 'options';

class NockInspector {
  public response: Response;
  public request?: Request;
  public requests: Array<Request> = [];

  private specifics: Array<{ request: Request; response: Response }> = [];
  private numberedResponses: { [key: number]: Response } = {};
  private scope: Scope;

  constructor({
    method = 'get',
    basePath,
    endpoint,
    response,
  }: {
    method?: Method;
    basePath: string;
    endpoint: string;
    response?: Response;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.response = { status: 200, ...response };
    this.scope = nock(basePath)
      .persist()
      [method](endpoint)
      // typescript has issues with this....
      .query(function logQuery(query: ParsedUrlQuery) {
        self.request = { query };
        return true;
      })
      .reply(function reply(this: ReplyFnContext, uri: string, requestBody: object) {
        const requestInfo = { headers: this.req.headers, body: requestBody };
        self.request = { ...self.request, ...requestInfo };
        self.requests.push(self.request);

        //todo if body is undefined should it be {}? right now it just comes back with no body.

        const numberedResponse = self.numberedResponses[self.requests.length];
        if (numberedResponse) {
          return [numberedResponse.status, numberedResponse.body, numberedResponse.headers];
        }

        const specRequest = self.specifics.find(
          ({ request: specRequest }) =>
            self.headersMatch(requestInfo, specRequest) && self.bodiesMatch(requestInfo, specRequest)
        );
        const specResponse = specRequest && specRequest.response;
        if (specResponse) {
          return [specResponse.status, specResponse.body, specResponse.headers];
        }

        const { response: defaultResponse } = self;
        console.log('defaultResponse', JSON.stringify(defaultResponse, null, 4));
        if (defaultResponse) {
          return [defaultResponse.status, defaultResponse.body, defaultResponse.headers];
        }
        throw new Error('There is no matching or default response');
      });
  }

  private headersMatch(request: Request, specRequest: Request): boolean {
    if (!specRequest.headers) {
      return true;
    }
    if (!request.headers) {
      return false;
    }
    // if any headers on the special request don't match the request, return false
    return Object.keys(specRequest.headers).reduce(
      (acc, header) => (specRequest.headers?.[header] === request.headers?.[header] ? acc : false),
      true
    );
  }

  private bodiesMatch(request: Request, specRequest: Request): boolean {
    return isEqual(request.body, specRequest.body);
  }

  // eslint-disable-next-line complexity
  public respondToRequest(request: Request, response: Response): void {
    if (!request || !response) {
      throw new Error('both a request and a response are required');
    }
    if (!request.body && !request.headers) {
      throw new Error('request must have a body or headers');
    }
    if (!response.status) {
      response.status = 200;
    }

    const existingSpecIndex = this.specifics.findIndex(({ request: specRequest }) => isEqual(specRequest, request));
    if (existingSpecIndex >= 0) {
      this.specifics[existingSpecIndex] = { request, response };
      return;
    }

    this.specifics.push({ request, response });
  }

  public respondOnCall(callNumber: number, response: Response): void {
    this.numberedResponses[callNumber] = response;
  }
}

export default function makeNockInspector(options: {
  method?: Method;
  basePath: string;
  endpoint: string;
  response?: Response;
}): NockInspector {
  return new NockInspector(options);
}

export function cleanAll(): void {
  nock.cleanAll();
}
export function activeMocks(): Array<string> {
  return nock.activeMocks();
}
