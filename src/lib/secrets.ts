import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

let _ssm: SSMClient | null = null;

function getSsmClient() {
  if (!_ssm) {
    // Lazy-init so importing this module doesn't require AWS credentials 
    // immediately (e.g. local dev where every value might be literal)
    _ssm = new SSMClient({});
  }
  return _ssm;
}

const _cache = new Map<string, string>();

export async function getSsmParam(name: string, withDecryption = true): Promise<string> {
  if (!name) return '';
  if (_cache.has(name)) {
    return _cache.get(name)!;
  }

  // To support both SSM parameter paths and literal values
  if (!name.startsWith('/')) {
    return name;
  }

  try {
    const client = getSsmClient();
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: withDecryption,
    });
    const response = await client.send(command);
    const value = response.Parameter?.Value;
    if (value === undefined) throw new Error("Parameter value is undefined");
    _cache.set(name, value);
    return value;
  } catch (error) {
    console.warn(`Failed to fetch SSM parameter ${name}. Error:`, error);
    throw error;
  }
}
