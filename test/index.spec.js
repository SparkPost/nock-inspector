'use strict';

const chai = require('chai');
const expect = chai.expect;
const nockInspector = require('../index');
const request = require('request-promise');
const _ = require('lodash');
const Promise = require('bluebird');

chai.use(require('chai-as-promised'));

describe('nock inspector', function() {
  let inspectors
    ,postInspector
    ,thisInspector
    ,thatInspector
    ,requestBody
    ,requestHeaders
    ,thisResponseBody
    ,thisResponseHeaders
    ,thatResponseBody;

  const expectHeadersToMatch = (expected, actual) =>
    expect(_.pick(actual, _.keys(expected))).to.deep.equal(expected);

  beforeEach(function() {
    nockInspector.cleanAll();

    requestBody = {
      bashful: 'grumpy',
      sneezy: 'doc'
    };

    requestHeaders = {
      happy: 'sleepy',
      dopey: 'snoopy'
    };

    thisResponseBody = {
      dasher: 'dancer',
      prancer: 'vixen'
    };

    thisResponseHeaders = {
      comet: 'cupid',
      donner: 'blitzen'
    };

    thatResponseBody = { sloth: 'giraffe' };

    inspectors = {
      postInspector: {
        method: 'post',
        basePath: 'https://post.url',
        endpoint: '/postEndpoint',
        response: { body: thisResponseBody, headers: thisResponseHeaders }
      },
      thisInspector: {
        method: 'get',
        basePath: 'http://this.url',
        endpoint: '/thisEndpoint',
        response: { status: 200, body: thisResponseBody }
      },
      thatInspector: {
        method: 'get',
        basePath: 'http://that.url',
        endpoint: '/thatEndpoint',
        response: { body: thatResponseBody }
      }
    };

    postInspector = nockInspector(inspectors.postInspector);
    thisInspector = nockInspector(inspectors.thisInspector);
    thatInspector = nockInspector(inspectors.thatInspector);
  });

  it('should respond with the default response', function() {
    return request({
      uri: `${inspectors.thisInspector.basePath}${inspectors.thisInspector.endpoint}`,
      method: 'GET',
      json: true,
      resolveWithFullResponse: true
    }).then((response) => {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.deep.equal(thisResponseBody);
    });
  });

  it('should log the query params', async function() {
    await request({
      uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}?someParam=some-param-value`,
      method: 'POST',
      body: requestBody,
      headers: requestHeaders,
      json: true,
      resolveWithFullResponse: true
    });
    expect(postInspector.requests[0].query).to.deep.equal({
      someParam: 'some-param-value'
    });
  });

  it('should respond with the default response with headers', function() {
    thisInspector.response.headers = thisResponseHeaders;
    return request({
      uri: `${inspectors.thisInspector.basePath}${inspectors.thisInspector.endpoint}`,
      method: 'GET',
      json: true,
      resolveWithFullResponse: true
    }).then((response) => {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.deep.equal(thisResponseBody);
      expectHeadersToMatch(thisResponseHeaders, response.headers);
    });
  });

  it('should make the request inpsectable', function() {
    return request({
      uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}`,
      method: 'POST',
      body: requestBody,
      headers: requestHeaders,
      json: true,
      resolveWithFullResponse: true
    }).then(() => {
      expect(postInspector.request.body).to.deep.equal(requestBody);
      expectHeadersToMatch(requestHeaders, postInspector.request.headers);
    });
  });

  it('should give a specific response to a specific request', function() {
    postInspector.respondToRequest(
      { body: { hansel: 'gretal' } },
      { status: 202, body: { hag: 'gingerbread house' } }
    );
    return request({
      uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}`,
      method: 'POST',
      body: { hansel: 'gretal' },
      json: true,
      resolveWithFullResponse: true
    }).then((response) => {
      expect(response.statusCode).to.equal(202);
      expect(response.body).to.deep.equal({ hag: 'gingerbread house' });
    });
  });

  it('should give a specific response to a specific request with headers', function() {
    postInspector.respondToRequest(
      { body: { hansel: 'gretal' }, headers: { header1: 'value1' } },
      {
        status: 202,
        body: { hag: 'gingerbread house' }
      }
    );
    return request({
      uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}`,
      method: 'POST',
      body: { hansel: 'gretal' },
      headers: { header1: 'value1' },
      json: true,
      resolveWithFullResponse: true
    }).then((response) => {
      expect(response.statusCode).to.equal(202);
      expect(response.body).to.deep.equal({ hag: 'gingerbread house' });
    });
  });

  it('should respond with a specified response after a specific number of requests', async function() {
    postInspector.respondOnCall(2, {
      status: 213,
      headers: { aHeader: 'the header' },
      body: { info: 'the body' }
    });
    const results = await Promise.map(new Array(3), () =>
      request({
        uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}`,
        method: 'POST',
        body: requestBody,
        headers: requestHeaders,
        json: true,
        resolveWithFullResponse: true
      })
    );
    const expectedUniqueResponse = {
      statusCode: 213,
      body: {
        info: 'the body'
      },
      headers: {
        aHeader: 'the header',
        'content-type': 'application/json'
      }
    };
    expect(results[0]).not.to.deep.include(expectedUniqueResponse);
    expect(results[1]).to.deep.include(expectedUniqueResponse);
    expect(results[2]).not.to.deep.include(expectedUniqueResponse);
  });

  it('should keep all the requests in order', function() {
    const secondRequestBody = { hansel: 'gretal' };
    const secondRequestHeaders = { shrek: 'donkey' };
    return request({
      uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}`,
      method: 'POST',
      body: requestBody,
      headers: requestHeaders,
      json: true,
      resolveWithFullResponse: true
    })
      .then(() =>
        request({
          uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}`,
          method: 'POST',
          body: secondRequestBody,
          headers: secondRequestHeaders,
          json: true,
          resolveWithFullResponse: true
        })
      )
      .then(() => {
        expect(postInspector.requests.length).to.equal(2);
        expect(postInspector.requests[0].body).to.deep.equal(requestBody);
        expectHeadersToMatch(requestHeaders, postInspector.requests[0].headers);
        expect(postInspector.requests[1].body).to.deep.equal(secondRequestBody);
        expectHeadersToMatch(
          secondRequestHeaders,
          postInspector.requests[1].headers
        );
      });
  });

  it('should allow multiple nocks for the same base path', function() {
    const basePath = 'http://same.url';
    thisInspector = nockInspector({ ...inspectors.thisInspector, basePath });
    thatInspector = nockInspector({ ...inspectors.thatInspector, basePath });
    return request({
      uri: `${basePath}${inspectors.thatInspector.endpoint}`,
      method: 'GET',
      json: true,
      resolveWithFullResponse: true
    })
      .then((response) => {
        expect(response.body).to.deep.equal(thatResponseBody);
        expect(thatInspector.requests.length).to.equal(1);
      })
      .then(() =>
        request({
          uri: `${basePath}${inspectors.thisInspector.endpoint}`,
          method: 'GET',
          json: true,
          resolveWithFullResponse: true
        })
      )
      .then((response) => {
        expect(response.body).to.deep.equal(thisResponseBody);
        expect(thisInspector.requests.length).to.equal(1);
      });
  });

  it('should list active mocks', function() {
    expect(nockInspector.activeMocks()).to.deep.equal([
      'POST https://post.url:443/postEndpoint',
      'GET http://this.url:80/thisEndpoint',
      'GET http://that.url:80/thatEndpoint'
    ]);
  });

  it('should clean all mocks', function() {
    nockInspector.cleanAll();
    expect(nockInspector.activeMocks().length).to.equal(0);
  });

  it('should overwrite existing specific responses to requests', function() {
    postInspector.respondToRequest(
      { body: { hansel: 'gretal' } },
      { status: 202, body: { hag: 'gingerbread house' } }
    );
    postInspector.respondToRequest(
      { body: { hansel: 'gretal' } },
      {
        status: 404,
        body: { error: 'gingerbread house not found' }
      }
    );
    return expect(
      request({
        uri: `${inspectors.postInspector.basePath}${inspectors.postInspector.endpoint}`,
        method: 'POST',
        body: { hansel: 'gretal' },
        json: true,
        resolveWithFullResponse: true
      })
    ).to.be.rejected.then((response) => {
      expect(response.statusCode).to.equal(404);
      expect(response.error).to.deep.equal({
        error: 'gingerbread house not found'
      });
    });
  });

  it('should require a method in the constructor', function() {
    expect(() =>
      nockInspector({
        basePath: 'https://post.url',
        endpoint: '/postEndpoint'
      })
    ).to.throw('method is required');
  });

  it('should require a request and response in respondToRequest()', function() {
    expect(() =>
      postInspector.respondToRequest({ body: { hansel: 'gretal' } })
    ).to.throw('both a request and a response are required');
  });

  it('should require request body or headers in respondToRequest()', function() {
    expect(() =>
      postInspector.respondToRequest(
        {},
        { status: 202, body: { hag: 'gingerbread house' } }
      )
    ).to.throw('request must have a body or headers');
  });
});
