"use strict";

import * as fs from "fs-extra";
import * as moment from "moment";
import * as path from "path";
import * as vscode from "vscode";
import { openFolderInExplorer } from "../helpers";
import TemplatesManager from "../templatesManager";

/**
 * Main command to create a file from a template.
 * This command can be invoked by the Command Palette or in a folder context menu on the explorer view.
 */

export default class FileFromTemplateCommand {
    private manager: TemplatesManager;
    private targetFolder: string;

    public constructor(manager: TemplatesManager) {
        this.manager = manager;
    }

    public async run(args: any) {
        const templates = this.manager.getTemplates();

        // gets the target folder. if its invoked from a context menu,
        // we use that reference, otherwise we use the file system path
        const targetFolder = args ? args.fsPath : vscode.workspace.rootPath;
        this.targetFolder = targetFolder;

        if (templates.length === 0) {
            const optionGoToTemplates: vscode.MessageItem = {
                title: "Open Templates Folder"
            };

            const option = await vscode.window.showInformationMessage("No templates found!", optionGoToTemplates);
            // nothing selected
            if (!option) {
                return;
            }
            openFolderInExplorer(this.manager.getTemplatesDir());
            return;
        }

        // show the list of available templates.
        const selection = await vscode.window.showQuickPick(templates);
        if (!selection) {
            return;
        }
        // nothing selected. cancel
        // ask for filename
        const inputOptions: vscode.InputBoxOptions = {
            prompt: "Please enter the desired file name",
            value: selection,
        };

        const filename = await vscode.window.showInputBox(inputOptions);
        if (!filename) {
            return;
        }
        let fileContents = this.manager.getTemplate(selection);
        fileContents = await this.render_template(filename, fileContents);

        const fullname = path.join(targetFolder, filename);
        try {
            await fs.writeFile(path.join(targetFolder, filename), fileContents);
            const doc = await vscode.workspace.openTextDocument(fullname);
            const editor = vscode.window.activeTextEditor;
            vscode.window.showTextDocument(doc, editor.viewColumn);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
    }

    private async render_template(filename, contents): Promise<string> {
        let fileContents = contents;
        const workspaceSettings = vscode.workspace.getConfiguration("fileTemplates");
        const className = filename.replace(/\.[^/.]+$/, "");
        const expression = /#{(\w+)}/g;
        const placeholders = [];
        let matches = expression.exec(fileContents);
        while (matches) {
            if (placeholders.indexOf(matches[0]) === -1) {
                placeholders.push(matches[0]);
            }
            matches = expression.exec(fileContents);
        }

        for (const placeholder of placeholders) {
            const variableName = /#{(\w+)}/.exec(placeholder)[1];
            const search = new RegExp(placeholder, "g");

            switch (variableName) {
                case "filename":
                    fileContents = fileContents.replace(search, className);
                    break;
                case "filepath":
                    const workspaceRoot = vscode.workspace.rootPath;
                    fileContents = fileContents.replace(search, this.targetFolder.replace(`${workspaceRoot}/`, ""));
                    break;
                case "year":
                    fileContents = fileContents.replace(search, moment().format("YYYY"));
                    break;
                case "date":
                    fileContents = fileContents.replace(search, moment().format("D MMM YYYY"));
                    break;
                default:
                    if (workspaceSettings && workspaceSettings[variableName]) {
                        fileContents = fileContents.replace(search, workspaceSettings[variableName]);
                    } else {
                        const replacement = await this.promptVariableValue(variableName);
                        fileContents = fileContents.replace(search, replacement);
                    }
                    break;
            }
        }
        return fileContents;
    }

    private async promptVariableValue(variableName: string): Promise<string> {
        const variableInput: vscode.InputBoxOptions = {
            prompt: `Please enter the desired value for "${variableName}"`
        };
        const value = await vscode.window.showInputBox(variableInput);
        let replacement;
        if (!value) {
            replacement = variableName.toUpperCase();
        } else {
            replacement = value;
        }
        return replacement;
    }

}
