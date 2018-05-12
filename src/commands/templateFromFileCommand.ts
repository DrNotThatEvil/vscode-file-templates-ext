"use strict";

import fs = require("fs");
import path = require("path");
import vscode = require("vscode");
import TemplatesManager from "../templatesManager";

/**
 * This command allows the creation of a new template directly from an existing file.
 * This command can be invoked by the Command Palette or in a folder context menu on the explorer view.
 * @export
 * @param {TemplatesManager} templatesManager
 * @param {*} args
 * @returns
 */
export function run(templatesManager: TemplatesManager, args: any) {

    /**
     * gets the file contents of the current selected file.
     * if this is toggled via context menu, we can get it directly from args,
     * otherwise we will use the current active file in the editor.
     */
    const filePath = args ? args.fsPath : vscode.window.activeTextEditor.document.fileName;
    const fileName = path.basename(filePath);

    // ask for filename
    const inputOptions = {
        prompt: "Please enter the desired filename",
        value: fileName
    } as vscode.InputBoxOptions;

    vscode.window.showInputBox(inputOptions).then((filename) => {
        const fileContents = fs.readFileSync(filePath);
        const templateFile = path.join(templatesManager.getTemplatesDir(), path.basename(filename));

        fs.writeFile(templateFile, fileContents, (err) => {
            if (err) {
                vscode.window.showErrorMessage(err.message);
            } else {
                vscode.window.showQuickPick(["Yes", "No"], { placeHolder: "Edit the new template?" }).then((choice) => {
                    if (choice === "Yes") {
                        vscode.workspace.openTextDocument(templateFile).then((doc) => {
                            const editor = vscode.window.activeTextEditor;

                            vscode.window.showTextDocument(doc, editor.viewColumn);
                        });
                    }
                });
            }

        });
    });
}
