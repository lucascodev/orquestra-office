export function lineReader(onLine) {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    let end = buffer.indexOf("\n");
    while (end >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line) onLine(line);
      end = buffer.indexOf("\n");
    }
  };
}

export function parseEvent(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
