import { CoreEditor } from '@kerebron/editor';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

import '@kerebron/editor/assets/index.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

const element = document.getElementById('app');

const protocol = globalThis.location.protocol === 'http:'
  ? 'ws:'
  : 'wss:';
const yjsUrl = protocol + '//' + globalThis.location.host + '/@kerebron/yjs';

const editor = CoreEditor.create({
  element,
  assetLoad: createAssetLoad('/@kerebron/wasm'),
  editorKits: [
    new AdvancedEditorKit(),
    YjsEditorKit.createFrom(yjsUrl)
  ],
});

const random = Math.random() * 100;
const user = {
  id: 'random:' + random,
  name: 'Anonymous ' + Math.floor(random),
};
editor.chain().changeUser(user).run();

try {
  const params = new URLSearchParams(window.location.search);
  const fileLocation = params.get('path');

  const response = await fetch('/@kerebron/file?path=' + fileLocation);
  const mimeType = response.headers.get('content-type');
  const buffer = await response.bytes();

  await editor.loadDocument(mimeType, buffer);
  const roomId = fileLocation.replaceAll('/', '__');
  editor.chain().changeRoom(roomId).run();
} catch (err) {
  console.error(err);
}

window.addEventListener('message', async (e) => {
  if (e.source !== window.parent) return;

  const { type, body } = e.data ?? {};
  if (body.$to !== 'iframe') return;

  switch (type) {
    case 'init': {
      // editor.setDocument('application/vnd.oasis.opendocument.text', body.value);

      try {
        const fileLocation = body.uri.path;

        const response = await fetch('/@kerebron/file?path=' + fileLocation);
        const mimeType = response.headers.get('content-type');
        const buffer = await response.bytes();

        await editor.loadDocument(mimeType, buffer);
        const roomId = fileLocation.replaceAll('/', '__');
        editor.chain().changeRoom(roomId).run();
      } catch (err) {
        console.error(err);
      }
      return;
    }

    case 'getFileData': {
      const bytes = await editor.getDocument('application/vnd.oasis.opendocument.text');
      window.parent.postMessage(
        { $to: 'extension', type: 'response', requestId, body: Array.from(bytes) },
        '*'
      );
      return;
    }
  }
});

window.parent.postMessage({ $to: 'extension', type: 'ready' }, '*');
window.addEventListener('load', () => {
   window.parent.postMessage({ $to: 'extension', type: 'ready' }, '*');
});
