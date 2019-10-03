"use strict";

import * as fs from "fs-extra";
import * as moment from "moment";
import * as path from "path";
import * as vscode from "vscode";
import { openFolderInExplorer } from "../helpers";
import TemplatesManager from "../templatesManager";
import { start } from "repl";

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

            if(editor) {
                vscode.window.showTextDocument(doc, editor.viewColumn);
            }

        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
    }

    private variableCase(variableString: string, capitalint: number): string {
        if(capitalint == 1) {
            return variableString.toUpperCase();
        } 

        if(capitalint == -1) {
            return variableString.toLowerCase();
        }

        return variableString;
    }

    private async render_template(filename, contents): Promise<string> {
        let fileContents = contents;
        const workspaceSettings = vscode.workspace.getConfiguration("fileTemplates");
        const className = filename.replace(/\.[^/.]+$/, "");
        const expression = /#{([\-\+\w]+)}/g;
        const placeholders = [];

        const userVars = await this.buildVariables(filename);

        let matches = expression.exec(fileContents);
        while (matches) {
            if (placeholders.indexOf(matches[0]) === -1) {
                placeholders.push(matches[0]);
            }
            matches = expression.exec(fileContents);
        }

        for (const placeholder of placeholders) {
            let variableName = /#{([\-\+\w]+)}/g.exec(placeholder)[1];
            const stringCase = (variableName.startsWith("+") ? 1 : (variableName.startsWith("-") ? -1 : 0));

            if(variableName.startsWith("-") || variableName.startsWith("+")) {
                variableName = variableName.substr(1);
            }

            let safePlaceholder = placeholder.replace(/\+/g, "\\+");
            safePlaceholder = safePlaceholder.replace(/\-/g, "\\-");

            const search = new RegExp(safePlaceholder, "g");

            if(variableName.startsWith("-") || variableName.startsWith("+")) {
                variableName = variableName.substr(1);
            }

            if (workspaceSettings && workspaceSettings[variableName]) {
                fileContents = fileContents.replace(search, this.variableCase(workspaceSettings[variableName], stringCase));
            } else if (userVars[variableName]) {
                fileContents = fileContents.replace(search, this.variableCase(userVars[variableName], stringCase));
            } else {
                const replacement = await this.promptVariableValue(variableName);
                fileContents = fileContents.replace(search, replacement);
            }

        }
        return fileContents;
    }

    private getDefaultCompiledVariables(filename): Object {
        const getDefaultCompiledVariables : Object = {};
        const className = filename.replace(/\.[^/.]+$/, "");
        const workspaceRoot = vscode.workspace.rootPath;

        getDefaultCompiledVariables["filename"] = className;
        
        getDefaultCompiledVariables["filepath"] = this.targetFolder.replace(`${workspaceRoot}/`, "");
        getDefaultCompiledVariables["year"] = moment().format("YYYY");
        getDefaultCompiledVariables["date"] = moment().format("D MMM YYYY");

        return getDefaultCompiledVariables;
    }


    
    private async buildVariables(filename): Promise<Object> {
        const workspaceVariableSettings = vscode.workspace.getConfiguration("fileTemplates");
        const expression = /#{([\-\+\w]+)}/g
        const variablesWithPlaceholders : Object = {};
        const compiledVariables : Object = this.getDefaultCompiledVariables(filename);

        if(!workspaceVariableSettings.has("variables"))
        {
            return compiledVariables;
        }

        const configVars = workspaceVariableSettings.get<Object>("variables");
        for(let key in configVars)
        {
            let matches = expression.exec(configVars[key]);
            if(matches === null) {
                // static variable, add to list
                compiledVariables[key] = configVars[key];
                continue;
            }

            while (matches) {
                if (!variablesWithPlaceholders.hasOwnProperty(key)) {
                    variablesWithPlaceholders[key] = {
                        "string": configVars[key],
                        "matches": []
                    }
                }

                variablesWithPlaceholders[key]["matches"].push([matches[0], matches[1]]);
                matches = expression.exec(configVars[key]);
            }

            variablesWithPlaceholders[key]["matches"] = [...new Set(variablesWithPlaceholders[key]["matches"])];
        }

        if(Object.keys(variablesWithPlaceholders).length == 0) {
            return compiledVariables;
        }


        /// TODO: Handle replacement with new placeholder structure.
        let startCount = Object.keys(variablesWithPlaceholders).length;

        do{
            startCount = Object.keys(variablesWithPlaceholders).length;

            for(let variable in variablesWithPlaceholders) {
                let variableArray : Object = variablesWithPlaceholders[variable];
                let toBeReplacedCount : number = variableArray["matches"].length;
                let variableString : String = variableArray["string"];

                for(let placeholder in variableArray["matches"]) {
                    let lookupVarname = variableArray["matches"][placeholder][1];
                    let stringCase = (lookupVarname.startsWith("+") ? 1 : (lookupVarname.startsWith("-") ? -1 : 0));

                    if(lookupVarname.startsWith("-") || lookupVarname.startsWith("+")) {
                        lookupVarname = lookupVarname.substr(1);
                    }

                    if(Object.keys(compiledVariables).indexOf(lookupVarname) !== -1) {
                        toBeReplacedCount--;

                        var placeHolderRegex = variableArray["matches"][placeholder][0];

                        let safePlaceholder = placeHolderRegex.replace(/\+/g, "\\+");
                        safePlaceholder = safePlaceholder.replace(/\-/g, "\\-");
                        
                        const search = new RegExp(safePlaceholder, "g");
                        variableString = variableString.replace(search, this.variableCase(compiledVariables[lookupVarname], stringCase));
                    }
                }

                if(toBeReplacedCount == 0) {
                    // done replacing add it to the compiled variables.
                    compiledVariables[variable] = variableString;
                    delete variablesWithPlaceholders[variable];
                }
            }
        }
        while((Object.keys(variablesWithPlaceholders)).length < startCount && (Object.keys(variablesWithPlaceholders)).length != 0)

        if(Object.keys(variablesWithPlaceholders).length > 0) {
            vscode.window.showInformationMessage('Could not build all placeholders.');
        }

        return compiledVariables;
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
