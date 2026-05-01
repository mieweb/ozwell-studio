import * as vscode from 'vscode';

import { Disposable, disposeAll } from './dispose.js';

interface KerebronDocumentDelegate {
	getFileData(): Promise<Uint8Array>;
}

class KerebronDocument extends Disposable implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;

  private _documentData: Uint8Array;

  private readonly _delegate: KerebronDocumentDelegate;

  private constructor(
		uri: vscode.Uri,
		initialContent: Uint8Array,
		delegate: KerebronDocumentDelegate
	) {
		super();
		this._uri = uri;
		this._documentData = initialContent;
		this._delegate = delegate;
	}

  static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
		delegate: KerebronDocumentDelegate,
	): Promise<KerebronDocument | PromiseLike<KerebronDocument>> {
		// If we have a backup, read that. Otherwise read the resource from the workspace
		const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
		const fileData = await KerebronDocument.readFile(dataFile);
		return new KerebronDocument(uri, fileData, delegate);
	}

  private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		if (uri.scheme === 'untitled') {
			return new Uint8Array();
		}
		return new Uint8Array(await vscode.workspace.fs.readFile(uri));
	}

	public get uri() { return this._uri; }

  public get documentData(): Uint8Array { return this._documentData; }

  private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	/**
	 * Fired when the document is disposed of.
	 */
	public readonly onDidDispose = this._onDidDispose.event;

    private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
		readonly content?: Uint8Array;
	}>());

  public readonly onDidChangeContent = this._onDidChangeDocument.event;

  private readonly _onDidChange = this._register(new vscode.EventEmitter<{
		readonly label: string,
		undo(): void,
		redo(): void,
	}>());

	public readonly onDidChange = this._onDidChange.event;

	dispose(): void {
		this._onDidDispose.fire();
		super.dispose();
	}
}

export class CustomEditorProvider implements vscode.CustomEditorProvider<KerebronDocument>  {
  public static readonly viewType = 'kerebronEditor';

  private readonly webviews = new WebviewCollection();

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new CustomEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(CustomEditorProvider.viewType, provider);

		return providerRegistration;
	}

  constructor(private readonly context: vscode.ExtensionContext) {}

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<KerebronDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  saveCustomDocument(document: KerebronDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method saveCustomDocument not implemented.');
  }
  saveCustomDocumentAs(document: KerebronDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method saveCustomDocumentAs not implemented.');
  }
  revertCustomDocument(document: KerebronDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method revertCustomDocument not implemented.');
  }
  backupCustomDocument(document: KerebronDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    throw new Error('Method backupCustomDocument not implemented.');
  }

  async openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): Promise<KerebronDocument> {
		const document: KerebronDocument = await KerebronDocument.create(uri, openContext.backupId, {
			getFileData: async () => {
				const webviewsForDocument = Array.from(this.webviews.get(document.uri));
				if (!webviewsForDocument.length) {
					throw new Error('Could not find webview to save for');
				}
				const panel = webviewsForDocument[0];
				const response = await this.postMessageWithResponse<number[]>(panel, 'getFileData', {});
				return new Uint8Array(response);
			}
		});

		const listeners: vscode.Disposable[] = [];

		listeners.push(document.onDidChange(e => {
			// Tell VS Code that the document has been edited by the use.
			this._onDidChangeCustomDocument.fire({
				document,
				...e,
			});
		}));

		listeners.push(document.onDidChangeContent(e => {
			// Update all webviews when the document changes
			for (const webviewPanel of this.webviews.get(document.uri)) {
				this.postMessage(webviewPanel, 'update', {
					// edits: e.edits,
					content: e.content,
				});
			}
		}));

		document.onDidDispose(() => disposeAll(listeners));

		return document;
  }

  async resolveCustomEditor(
    document: KerebronDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview, this.context);

    webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

    // Wait for the webview to be properly ready before we init
    webviewPanel.webview.onDidReceiveMessage(e => {
      if (e.type === 'ready') {
        if (document.uri.scheme === 'untitled') {
          this.postMessage(webviewPanel, 'init', {
            untitled: true,
            editable: true,
          });
        } else {
          const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);

          this.postMessage(webviewPanel, 'init', {
            uri: document.uri,
            $to: 'iframe',
            value: document.documentData,
            editable,
          });
        }
      }
    });
  }

  private _requestId = 1;
	private readonly _callbacks = new Map<number, (response: any) => void>();

	private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
		const requestId = this._requestId++;
		const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
		panel.webview.postMessage({ type, requestId, body });
		return p;
	}

  private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
		panel.webview.postMessage({ type, body });
	}

	private onMessage(document: KerebronDocument, message: any) {
	}

	private addNewDoc(document: vscode.TextDocument) {
    const json = {};

		return this.updateTextDocument(document, json);
	}

	private updateTextDocument(document: vscode.TextDocument, json: any) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));

		return vscode.workspace.applyEdit(edit);
	}

  private getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Kerebron</title>
				<style>
					html, body, iframe {
					margin: 0;
					padding: 0;
					width: 100%;
					height: 100%;
					border: none;
					overflow: hidden;
					}
				</style>
			</head>
			<body>
		    <iframe id="kerebron-frame" src="/@kerebron/editor"></iframe>
        <script>
            const vscode = acquireVsCodeApi();
            const frame = document.getElementById('kerebron-frame');

            // Extension -> host -> iframe
            window.addEventListener('message', (event) => {
              const msg = event.data?.body;
              if (!msg || msg.$to !== 'iframe') return;
              frame.contentWindow?.postMessage({ type: event.data.type, body: msg }, '*');
            });

            // Iframe -> host -> extension
            window.addEventListener('message', (event) => {
              if (event.source !== frame.contentWindow) return;
              const msg = event.data;
              if (!msg || msg.$to !== 'extension') return;
              vscode.postMessage(msg);
            });
        </script>
			</body>
			</html>`;
    }
}

class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}
