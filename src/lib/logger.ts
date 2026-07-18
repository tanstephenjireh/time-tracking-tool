export function log(level: 'INFO' | 'WARN' | 'ERROR', event: string, data?: any) {
  const logEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...data
  }
  console.log(JSON.stringify(logEntry))
}
