import * as vscode from 'vscode';
import { CustomEditorProvider } from './customEditorProvider';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "kerebron-extension" is now active!');

	context.subscriptions.push(CustomEditorProvider.register(context));

	const disposable = vscode.commands.registerCommand('kerebron-extension.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from kerebron-extension!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
