"use strict";

import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import TemplatesManager from "../templatesManager";

/**
 * This command allows the creation of a new template directly from an existing file.
 * This command can be invoked by the Command Palette or in a folder context menu on the explorer view.
 */
export default class TemplateFromFileCommand {
    private manager: TemplatesManager;

    public constructor(manager: TemplatesManager) {
        this.manager = manager;
    }

    public async run(args: any) {
        /**
         * gets the file contents of the current selected file.
         * if this is toggled via context menu, we can get it directly from args,
         * otherwise we will use the current active file in the editor.
         */
        const filePath = args ? args.fsPath : vscode.window.activeTextEditor.document.fileName;
        const fileName = path.basename(filePath);

        // ask for filename
        const inputOptions: vscode.InputBoxOptions = {
            prompt: "Please enter the desired filename",
            value: fileName
        };

        const filename = await vscode.window.showInputBox(inputOptions); //
        if (!filename) {
            return;
        }
        const fileContents = fs.readFileSync(filePath);
        const templateFile = path.join(this.manager.getTemplatesDir(), path.basename(filename));

        try {
            await fs.writeFile(templateFile, fileContents);
            const choice = await vscode.window.showQuickPick(["Yes", "No"], { placeHolder: "Edit the new template?" });
            if (choice === "Yes") {
                const doc = await vscode.workspace.openTextDocument(templateFile);
                const editor = vscode.window.activeTextEditor;
                vscode.window.showTextDocument(doc, editor.viewColumn);
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
    }

}
