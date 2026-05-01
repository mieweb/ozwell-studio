const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function processText(
  arr: Uint8Array,
  dispatchEvent: (event: MessageEvent) => void,
): Uint8Array {
  let retry = true;
  while (retry) {
    retry = false;

    const asText = decoder.decode(arr);

    const parts = asText.split('\r\n');
    const headers = [];
    for (let i = 0; i < parts.length; i++) {
      headers.push(parts[i]);
      if (parts[i] === '') {
        break;
      }
    }

    if (headers.length >= parts.length) {
      return arr;
    }

    const contentLenLine = headers.find((line) =>
      line.startsWith('Content-Length: ')
    );
    if (!contentLenLine) {
      return arr;
    }

    const contentLength = +contentLenLine.substring('Content-Length: '.length)
      .trim();
    if (contentLength === 0) {
      return arr;
    }

    const headersSize = encoder.encode(headers.join('\r\n')).length + 2;
    const rest = arr.subarray(headersSize);

    if (rest.length < contentLength) {
      return arr;
    }

    const line = decoder.decode(rest.subarray(0, contentLength));
    arr = rest.subarray(contentLength);

    // console.log('LSP says: ', line);

    const event = new MessageEvent('message', {
      data: line,
    });
    dispatchEvent(event);

    retry = true;
  }

  return arr;
}
