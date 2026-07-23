import test, { describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import { fetchEvents } from '../src/lib/resourcesApi';

describe('resourcesApi - fetchEvents', () => {
  afterEach(() => {
    mock.reset();
  });

  test('appends timeMin and timeMax to URL params', async () => {
    process.env.RESOURCES_API_KEY = 'test-api-key';
    const fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({ items: [{ id: 1 }] }));
    });
    
    // Inject mock into global
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    try {
      const generator = fetchEvents('attendee', 'test@example.com', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');
      await generator.next();

      assert.strictEqual(fetchMock.mock.callCount(), 1);
      const url = fetchMock.mock.calls[0].arguments[0] as string;
      
      const parsedUrl = new URL(url);
      assert.strictEqual(parsedUrl.searchParams.get('timeMin'), '2026-01-01T00:00:00Z');
      assert.strictEqual(parsedUrl.searchParams.get('timeMax'), '2026-12-31T23:59:59Z');
      assert.strictEqual(parsedUrl.searchParams.get('attendee'), 'test@example.com');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('does not append timeMax if not provided', async () => {
    process.env.RESOURCES_API_KEY = 'test-api-key';
    const fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({ items: [{ id: 1 }] }));
    });
    
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    try {
      const generator = fetchEvents('creator', 'test2@example.com', '2026-01-01T00:00:00Z');
      await generator.next();

      assert.strictEqual(fetchMock.mock.callCount(), 1);
      const url = fetchMock.mock.calls[0].arguments[0] as string;
      
      const parsedUrl = new URL(url);
      assert.strictEqual(parsedUrl.searchParams.get('timeMin'), '2026-01-01T00:00:00Z');
      assert.strictEqual(parsedUrl.searchParams.has('timeMax'), false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
