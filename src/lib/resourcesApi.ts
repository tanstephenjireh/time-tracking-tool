import { getSsmParam } from './secrets';

const BASE_URL = 'https://script.google.com/macros/s/AKfycbyCo7Iy8rLd3Jw11XY2_L2t-NksVyZ5bOFiDXyB7C4WQuldVZ47kGjcgzeGKvS_q_Uq6Q/exec';

const MAX_RESULTS = 50;
const REQUEST_TIMEOUT = 60000; // 60 seconds
const POLITE_DELAY = 300; // 0.3 seconds
const MAX_RETRIES = 5;

async function getApiKey() {
  return getSsmParam(process.env.RESOURCES_API_KEY || '');
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchResource(resource: string, additionalParams: Record<string, string> = {}) {
  const apiKey = await getApiKey();
  const params = new URLSearchParams({
    apiKey,
    resource,
    ...additionalParams
  });
  
  let items: any[] = [];
  let nextPageToken = null;
  
  do {
    if (nextPageToken) {
      params.set('pageToken', nextPageToken);
    }
    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${resource}: ${response.statusText}`);
    }
    const data = await response.json();
    items = items.concat(data.items || []);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);
  
  return items;
}

export async function fetchEmployees() {
  return fetchResource('employees');
}

export async function fetchCompanies() {
  return fetchResource('companies');
}

async function fetchWithRetry(url: string, attempt = 1): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`All ${MAX_RETRIES} retries failed. Last error: ${error.message}`);
    }
    const waitTime = Math.pow(2, attempt) * 1000;
    console.warn(`Request failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}. Retrying in ${waitTime}ms...`);
    await delay(waitTime);
    return fetchWithRetry(url, attempt + 1);
  }
}

export async function* fetchEvents(filterType: 'attendee' | 'creator', email: string, timeMin?: string) {
  const apiKey = await getApiKey();
  const params = new URLSearchParams({
    apiKey,
    resource: 'events',
    [filterType]: email,
    maxResults: MAX_RESULTS.toString(),
  });
  
  if (timeMin) params.set('timeMin', timeMin);
  
  let nextPageToken = null;
  
  do {
    if (nextPageToken) {
      params.set('pageToken', nextPageToken);
    }
    
    const data = await fetchWithRetry(`${BASE_URL}?${params.toString()}`);
    
    if (data.items && data.items.length > 0) {
      yield data.items;
    }
    
    nextPageToken = data.nextPageToken;
    
    if (nextPageToken) {
      await delay(POLITE_DELAY);
    }
  } while (nextPageToken);
}
