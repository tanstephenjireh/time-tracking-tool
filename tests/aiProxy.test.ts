import { test, describe, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { callAiProxy } from '../src/lib/aiProxy';

// Setup environment variables so getSsmParam doesn't use AWS
process.env.AI_PROXY_URL = 'http://mock-url.com';
process.env.AI_PROXY_EMAIL = 'mock-email';
process.env.AI_PROXY_API_KEY = 'mock-api-key';

describe('aiProxy', () => {
  const validEvent = {
    summary: 'Test Event',
    description: null,
    attendees: [],
    start: new Date().toISOString(),
    end: new Date().toISOString()
  };

  const validCompanies = [
    { id: '1', name: 'Acme', email_domain: 'acme.com' }
  ];

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restoreAll();
  });

  test('Valid response first try -> fetch called exactly once', async () => {
    const fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({
        status: 'success',
        parsed_output: {
          category: 'PTO',
          client_name: null,
          client_id: null
        }
      }));
    });
    global.fetch = fetchMock as any;

    const result = await callAiProxy(validEvent, validCompanies);
    assert.strictEqual(fetchMock.mock.callCount(), 1);
    assert.strictEqual(result.parsed_output.category, 'PTO');
  });

  test('Invalid then valid -> returns valid result, fetch called twice', async () => {
    let calls = 0;
    const fetchMock = mock.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response(JSON.stringify({
          status: 'success',
          parsed_output: {
            category: '15. PTO', // invalid
            client_name: null,
            client_id: null
          }
        }));
      }
      return new Response(JSON.stringify({
        status: 'success',
        parsed_output: {
          category: 'PTO', // valid
          client_name: null,
          client_id: null
        }
      }));
    });
    global.fetch = fetchMock as any;

    const result = await callAiProxy(validEvent, validCompanies);
    assert.strictEqual(fetchMock.mock.callCount(), 2);
    assert.strictEqual(result.parsed_output.category, 'PTO');
  });

  test('Always invalid -> throws after exhausting attempts, fetch called exactly maxAttempts times', async () => {
    const fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({
        status: 'success',
        parsed_output: {
          category: '15. PTO', // invalid
          client_name: null,
          client_id: null
        }
      }));
    });
    global.fetch = fetchMock as any;

    await assert.rejects(async () => {
      await callAiProxy(validEvent, validCompanies, 3);
    }, /Invalid option|Invalid input/i);
    
    assert.strictEqual(fetchMock.mock.callCount(), 3);
  });

  test('Custom maxAttempts (e.g. pass 5) -> respected', async () => {
    const fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({
        status: 'success',
        parsed_output: {
          category: '15. PTO', // invalid
          client_name: null,
          client_id: null
        }
      }));
    });
    global.fetch = fetchMock as any;

    await assert.rejects(async () => {
      await callAiProxy(validEvent, validCompanies, 5);
    }, /Invalid option|Invalid input/i);
    
    assert.strictEqual(fetchMock.mock.callCount(), 5);
  });

  test('Malformed event -> throws and fetch is never called', async () => {
    const fetchMock = mock.fn(async () => new Response());
    global.fetch = fetchMock as any;

    const malformedEvent = {
      summary: 123, // should be string
      description: null,
      attendees: [],
      start: new Date().toISOString(),
      end: new Date().toISOString()
    };

    await assert.rejects(async () => {
      await callAiProxy(malformedEvent, validCompanies);
    });
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });

  test('Malformed knownCompanies -> throws and fetch is never called', async () => {
    const fetchMock = mock.fn(async () => new Response());
    global.fetch = fetchMock as any;

    const malformedCompanies = [
      { id: '1', name: 'Acme' } // missing email_domain
    ];

    await assert.rejects(async () => {
      await callAiProxy(validEvent, malformedCompanies);
    });
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });

  test('client_name/client_id as null -> accepted', async () => {
    const fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({
        status: 'success',
        parsed_output: {
          category: 'PTO',
          client_name: null,
          client_id: null
        }
      }));
    });
    global.fetch = fetchMock as any;

    const result = await callAiProxy(validEvent, validCompanies);
    assert.strictEqual(result.parsed_output.client_name, null);
    assert.strictEqual(result.parsed_output.client_id, null);
  });

  test('client_name/client_id as number -> rejected', async () => {
    const fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({
        status: 'success',
        parsed_output: {
          category: 'PTO',
          client_name: 123, // invalid
          client_id: 456  // invalid
        }
      }));
    });
    global.fetch = fetchMock as any;

    await assert.rejects(async () => {
      await callAiProxy(validEvent, validCompanies, 1);
    }, /Invalid option|Invalid input/i);
  });
});
