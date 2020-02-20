Nock Inspector
--------------

This is a wrapper designed to make using nock easier.

create a new nock inspector:
```
nockInspector = require('@sparkpost/nock-inspector');

myInspector = nockInspector({
    method: 'POST'
    basePath: 'https://app.sparkpost.com',
    endpoint: '/an/endpoint',
    //this is the default response - it is optional
    response: {
        //status will default to 200 if none is provided
        status: 200,
        //headers and body are optional
        headers: {
            pig: 'oink',
        },
        body: {
            cow: 'moo'
        }
    }
});
```
This will respond with the default response to all POST requests made to https://app.sparkpost.com/an/endpoint.

Specific replies can also be tailored to specific requests, like so.
```
specialRequest = {
    //either a body or headers object is needed for the request.
    headers: { horse: 'neigh' },
    body: { chicken: 'woof woof'}
};

specialResponse = {
    //status is required
    status: 400,
    //headers and body are optional
    headers: { human: 'yodeleedoo' }
    body: { error: 'the chicken says cluck cluck, not woof woof' }
};

myInspector.respondToRequest(specialRequest, specialResponse);

```

A nock inspector can respond with a specific response on the nth request to it:
```
// responds with the provided response on the second request
myInspector.respondOnCall(2, {
    status: 403,
    body: { error: 'no snakes allowed.' }
});
```

##### Accessing the requests made to the mock

`myInspector.request` is the most recent request intercepted by the mock. Its properties are `headers`, `body`, and `query`.

`myInspector.requests` is an array of requests, each with `headers`, `body`, and `query`. `myInspector.requests[0]` is the first request intercepted by the mock.

##### Listing and cleaning mocks
```
nockInspector = require('@sparkpost/nock-inspector');

//list all active mocks
nockInspector.activeMocks();

//remove all mocks
nockInspector.cleanAll();
```
