"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import FileFromTemplateCommand = require("./commands/fileFromTemplateCommand");
import TemplateFromFileCommand = require("./commands/templateFromFileCommand");
import TemplatesManager from "./templatesManager";

/**
 * Main extension entry point.
 * This method is called when the extension is activated (used by the first time)
 * @export
 * @param {vscode.ExtensionContext} context
 */
export function activate(context: vscode.ExtensionContext) {

    // Initializes the template manager.
    const templatesManager = new TemplatesManager(vscode.workspace.getConfiguration("fileTemplates"));
    templatesManager.createTemplatesDirIfNotExists();

    // register extension commands
    const fftCommand = FileFromTemplateCommand.run.bind(undefined, templatesManager);
    const fftCommandDisposable = vscode.commands.registerCommand("extension.fileFromTemplate", fftCommand);
    context.subscriptions.push(fftCommandDisposable);

    const tffCommand =  TemplateFromFileCommand.run.bind(undefined, templatesManager);
    const tffCommandDisposable = vscode.commands.registerCommand("extension.templateFromFile", tffCommand);
    context.subscriptions.push(tffCommandDisposable);

}

// this method is called when your extension is deactivated
// export function deactivate() {
// }
